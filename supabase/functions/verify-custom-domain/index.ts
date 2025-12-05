import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyRequest {
  domain_id: string;
}

async function checkDNSRecords(domain: string, expectedTarget: string): Promise<{ configured: boolean; error?: string }> {
  try {
    // Use Google DNS-over-HTTPS to check CNAME records
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const data = await response.json();

    if (data.Status !== 0) {
      return { configured: false, error: "DNS lookup failed - domain not found or DNS not configured" };
    }

    if (!data.Answer || data.Answer.length === 0) {
      // No CNAME found, check for A records (might be apex domain)
      const aResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
      const aData = await aResponse.json();

      if (aData.Status !== 0 || !aData.Answer || aData.Answer.length === 0) {
        return { configured: false, error: "No DNS records found. Please add a CNAME record pointing to your Netlify site." };
      }

      return { configured: false, error: "Found A record but CNAME is required. Please use a subdomain or configure Netlify DNS." };
    }

    // Check if CNAME points to the expected target
    const cnameRecord = data.Answer.find((record: any) => record.type === 5); // Type 5 is CNAME
    if (!cnameRecord) {
      return { configured: false, error: "DNS records found but no CNAME record detected" };
    }

    // Normalize CNAME value (remove trailing dot if present)
    let cnameValue = cnameRecord.data.toLowerCase().replace(/\.$/, '');
    const normalizedTarget = expectedTarget.toLowerCase().replace(/\.$/, '');

    if (!cnameValue.includes(normalizedTarget)) {
      return {
        configured: false,
        error: `CNAME points to ${cnameValue} but should point to ${normalizedTarget}`
      };
    }

    return { configured: true };
  } catch (error) {
    console.error("DNS check error:", error);
    return {
      configured: false,
      error: `DNS verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { domain_id } = await req.json() as VerifyRequest;

    if (!domain_id) {
      return new Response(
        JSON.stringify({ error: "domain_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get domain details
    const { data: domain, error: domainError } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (domainError || !domain) {
      return new Response(
        JSON.stringify({ error: "Domain not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the Netlify site URL for this business (you should store this in settings)
    // For now, we'll use a placeholder - you'll need to configure this
    const netlifyUrl = Deno.env.get("NETLIFY_SITE_URL") || "your-app.netlify.app";

    // Check DNS records
    const dnsCheck = await checkDNSRecords(domain.domain, netlifyUrl);

    // Update domain status
    const updateData: any = {
      last_checked_at: new Date().toISOString(),
      dns_configured: dnsCheck.configured,
    };

    if (dnsCheck.configured) {
      updateData.status = "verified";
      updateData.verified_at = new Date().toISOString();
      updateData.error_message = null;
      updateData.cname_verified_at = new Date().toISOString();
      updateData.ssl_certificate_status = "provisioning";
    } else {
      updateData.status = "failed";
      updateData.error_message = dnsCheck.error;
    }

    const { error: updateError } = await supabase
      .from("custom_domains")
      .update(updateData)
      .eq("id", domain_id);

    if (updateError) {
      throw updateError;
    }

    // If DNS is configured and domain hasn't been added to Netlify yet, add it now
    let netlifyResult = null;
    if (dnsCheck.configured && !domain.netlify_domain_id) {
      try {
        const addDomainResponse = await fetch(
          `${supabaseUrl}/functions/v1/add-domain-to-netlify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ domain_id }),
          }
        );

        if (addDomainResponse.ok) {
          netlifyResult = await addDomainResponse.json();
        } else {
          const errorData = await addDomainResponse.json();
          console.error("Failed to add domain to Netlify:", errorData);
          netlifyResult = { success: false, error: errorData.error };
        }
      } catch (netlifyError) {
        console.error("Error calling add-domain-to-netlify:", netlifyError);
        netlifyResult = {
          success: false,
          error: netlifyError instanceof Error ? netlifyError.message : "Failed to add domain to platform",
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: dnsCheck.configured,
        error: dnsCheck.error,
        domain: domain.domain,
        netlify_status: netlifyResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error verifying domain:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

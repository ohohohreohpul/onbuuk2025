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
    console.log(`[DNS Check] Checking domain: ${domain}, expected target: ${expectedTarget}`);

    // Use Google DNS-over-HTTPS to check CNAME records
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const data = await response.json();

    if (data.Status !== 0) {
      console.log(`[DNS Check] DNS lookup failed for ${domain}, status: ${data.Status}`);
      return { configured: false, error: "DNS lookup failed - domain not found or DNS not configured" };
    }

    if (!data.Answer || data.Answer.length === 0) {
      console.log(`[DNS Check] No CNAME found for ${domain}, checking for A records`);
      // No CNAME found, check for A records (might be apex domain)
      const aResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
      const aData = await aResponse.json();

      if (aData.Status !== 0 || !aData.Answer || aData.Answer.length === 0) {
        console.log(`[DNS Check] No A records found for ${domain}`);
        return { configured: false, error: "No DNS records found. Please add a CNAME record pointing to your Netlify site." };
      }

      console.log(`[DNS Check] A record found but CNAME required for ${domain}`);
      return { configured: false, error: "Found A record but CNAME is required. Please use a subdomain or configure Netlify DNS." };
    }

    // Check if CNAME points to the expected target
    const cnameRecord = data.Answer.find((record: any) => record.type === 5); // Type 5 is CNAME
    if (!cnameRecord) {
      console.log(`[DNS Check] DNS records found but no CNAME for ${domain}`);
      return { configured: false, error: "DNS records found but no CNAME record detected" };
    }

    // Normalize CNAME value (remove trailing dot if present)
    let cnameValue = cnameRecord.data.toLowerCase().replace(/\.$/, '');
    const normalizedTarget = expectedTarget.toLowerCase().replace(/\.$/, '');

    console.log(`[DNS Check] CNAME value: ${cnameValue}, normalized target: ${normalizedTarget}`);

    if (!cnameValue.includes(normalizedTarget)) {
      console.log(`[DNS Check] CNAME mismatch for ${domain}`);
      return {
        configured: false,
        error: `CNAME points to ${cnameValue} but should point to ${normalizedTarget}`
      };
    }

    console.log(`[DNS Check] DNS verification successful for ${domain}`);
    return { configured: true };
  } catch (error) {
    console.error("[DNS Check] Error:", error);
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

    console.log(`[Verify Domain] Starting verification for domain_id: ${domain_id}`);

    if (!domain_id) {
      console.log("[Verify Domain] Error: domain_id is required");
      return new Response(
        JSON.stringify({ error: "domain_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get domain details
    console.log(`[Verify Domain] Querying database for domain_id: ${domain_id}`);
    const { data: domain, error: domainError } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (domainError) {
      console.error(`[Verify Domain] Database error for domain_id ${domain_id}:`, domainError);
      return new Response(
        JSON.stringify({
          error: "Database error: Unable to fetch domain details",
          details: domainError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!domain) {
      console.log(`[Verify Domain] Domain not found in database for domain_id: ${domain_id}`);
      return new Response(
        JSON.stringify({ error: "Domain not found in database" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Verify Domain] Found domain: ${domain.domain}`);

    // Get the Netlify site URL for this business (you should store this in settings)
    // For now, we'll use a placeholder - you'll need to configure this
    const netlifyUrl = Deno.env.get("NETLIFY_SITE_URL") || "your-app.netlify.app";
    console.log(`[Verify Domain] Using Netlify URL: ${netlifyUrl}`);

    // Check DNS records
    const dnsCheck = await checkDNSRecords(domain.domain, netlifyUrl);
    console.log(`[Verify Domain] DNS check result for ${domain.domain}:`, dnsCheck);

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
      console.log(`[Verify Domain] DNS configured, adding ${domain.domain} to Netlify`);
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

        const responseData = await addDomainResponse.json();

        if (addDomainResponse.ok) {
          console.log(`[Verify Domain] Successfully added ${domain.domain} to Netlify:`, responseData);
          netlifyResult = { success: true, ...responseData };
        } else {
          console.error(`[Verify Domain] Failed to add domain to Netlify (HTTP ${addDomainResponse.status}):`, responseData);
          netlifyResult = { success: false, error: responseData.error || "Unknown Netlify API error" };
        }
      } catch (netlifyError) {
        console.error("[Verify Domain] Error calling add-domain-to-netlify:", netlifyError);
        netlifyResult = {
          success: false,
          error: netlifyError instanceof Error ? netlifyError.message : "Failed to add domain to platform",
        };
      }
    } else if (dnsCheck.configured && domain.netlify_domain_id) {
      console.log(`[Verify Domain] Domain already added to Netlify (ID: ${domain.netlify_domain_id})`);
    } else {
      console.log(`[Verify Domain] DNS not configured yet, skipping Netlify integration`);
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

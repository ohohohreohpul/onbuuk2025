import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckSSLRequest {
  domain_id?: string;
}

interface NetlifyDomainResponse {
  id: string;
  domain: string;
  ssl: {
    state: string;
    certificate?: any;
  };
}

async function checkSSLStatus(
  netlifyDomainId: string,
  netlifyAccessToken: string,
  netlifySiteId: string
): Promise<{ success: boolean; sslStatus?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${netlifySiteId}/domains/${netlifyDomainId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${netlifyAccessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Netlify API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return { success: false, error: errorMessage };
    }

    const data: NetlifyDomainResponse = await response.json();
    
    return {
      success: true,
      sslStatus: data.ssl?.state || "unknown",
    };
  } catch (error) {
    console.error("Error checking SSL status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check SSL status",
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
    const netlifyAccessToken = Deno.env.get("NETLIFY_ACCESS_TOKEN");
    const netlifySiteId = Deno.env.get("NETLIFY_SITE_ID");

    if (!netlifyAccessToken || !netlifySiteId) {
      return new Response(
        JSON.stringify({
          error: "Netlify credentials not configured. Please set NETLIFY_ACCESS_TOKEN and NETLIFY_SITE_ID environment variables.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { domain_id } = await req.json() as CheckSSLRequest;

    if (domain_id) {
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

      if (!domain.netlify_domain_id) {
        return new Response(
          JSON.stringify({
            error: "Domain has not been added to Netlify yet",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result = await checkSSLStatus(
        domain.netlify_domain_id,
        netlifyAccessToken,
        netlifySiteId
      );

      if (!result.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const sslStatus = result.sslStatus === "issued" ? "active" : "provisioning";
      const domainStatus = result.sslStatus === "issued" ? "active" : "provisioning";

      const { error: updateError } = await supabase
        .from("custom_domains")
        .update({
          ssl_certificate_status: sslStatus,
          status: domainStatus,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", domain_id);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          domain: domain.domain,
          ssl_status: result.sslStatus,
          ssl_certificate_status: sslStatus,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      const { data: domains, error: domainsError } = await supabase
        .from("custom_domains")
        .select("*")
        .not("netlify_domain_id", "is", null)
        .in("ssl_certificate_status", ["pending", "provisioning"]);

      if (domainsError) {
        throw domainsError;
      }

      const results = [];
      for (const domain of domains || []) {
        const result = await checkSSLStatus(
          domain.netlify_domain_id,
          netlifyAccessToken,
          netlifySiteId
        );

        if (result.success) {
          const sslStatus = result.sslStatus === "issued" ? "active" : "provisioning";
          const domainStatus = result.sslStatus === "issued" ? "active" : "provisioning";

          await supabase
            .from("custom_domains")
            .update({
              ssl_certificate_status: sslStatus,
              status: domainStatus,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", domain.id);

          results.push({
            domain: domain.domain,
            ssl_status: result.sslStatus,
            updated: true,
          });
        } else {
          results.push({
            domain: domain.domain,
            error: result.error,
            updated: false,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          checked: results.length,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in check-ssl-status:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AddDomainRequest {
  domain_id: string;
}

interface NetlifyDomainResponse {
  id: string;
  domain: string;
  ssl: {
    state: string;
    certificate?: any;
  };
}

async function addDomainToNetlify(
  domain: string,
  netlifyAccessToken: string,
  netlifySiteId: string
): Promise<{ success: boolean; domainId?: string; sslStatus?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${netlifySiteId}/domains`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${netlifyAccessToken}`,
        },
        body: JSON.stringify({ domain }),
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
      domainId: data.id,
      sslStatus: data.ssl?.state || "pending",
    };
  } catch (error) {
    console.error("Error adding domain to Netlify:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add domain to Netlify",
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
    const { domain_id } = await req.json() as AddDomainRequest;

    if (!domain_id) {
      return new Response(
        JSON.stringify({ error: "domain_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    if (!domain.dns_configured) {
      return new Response(
        JSON.stringify({
          error: "DNS must be configured and verified before adding to Netlify",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await addDomainToNetlify(
      domain.domain,
      netlifyAccessToken,
      netlifySiteId
    );

    if (!result.success) {
      await supabase
        .from("custom_domains")
        .update({
          status: "failed",
          netlify_api_error: result.error,
          error_message: result.error,
        })
        .eq("id", domain_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const updateData: any = {
      netlify_domain_id: result.domainId,
      provisioned_at: new Date().toISOString(),
      status: "provisioning",
      ssl_certificate_status: result.sslStatus === "issued" ? "active" : "provisioning",
      netlify_api_error: null,
      error_message: null,
    };

    if (result.sslStatus === "issued") {
      updateData.status = "active";
    }

    const { error: updateError } = await supabase
      .from("custom_domains")
      .update(updateData)
      .eq("id", domain_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain: domain.domain,
        netlify_domain_id: result.domainId,
        ssl_status: result.sslStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in add-domain-to-netlify:", error);
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
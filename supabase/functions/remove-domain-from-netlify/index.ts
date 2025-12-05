import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RemoveDomainRequest {
  domain_id: string;
}

async function removeDomainFromNetlify(
  netlifyDomainId: string,
  netlifyAccessToken: string,
  netlifySiteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${netlifySiteId}/domains/${netlifyDomainId}`,
      {
        method: "DELETE",
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

      if (response.status === 404) {
        return { success: true };
      }

      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (error) {
    console.error("Error removing domain from Netlify:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove domain from Netlify",
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
    const { domain_id } = await req.json() as RemoveDomainRequest;

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

    if (!domain.netlify_domain_id) {
      await supabase
        .from("custom_domains")
        .delete()
        .eq("id", domain_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Domain was not registered with Netlify. Removed from database.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await removeDomainFromNetlify(
      domain.netlify_domain_id,
      netlifyAccessToken,
      netlifySiteId
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          message: "Failed to remove domain from Netlify. Please try again or contact support.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: deleteError } = await supabase
      .from("custom_domains")
      .delete()
      .eq("id", domain_id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain: domain.domain,
        message: "Domain successfully removed from Netlify and database.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in remove-domain-from-netlify:", error);
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
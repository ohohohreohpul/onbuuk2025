// CORS + JSON helpers for the /agent/v1 surface.
// Agents call cross-origin; allow all origins and the agent key header.

export const agentCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Agent-Key, X-Request-Id",
};

export function agentJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...agentCorsHeaders, "Content-Type": "application/json" },
  });
}

export function agentError(
  message: string,
  status: number,
  details?: unknown,
): Response {
  return agentJson({ error: message, details }, status);
}

export function handleAgentOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: agentCorsHeaders });
  }
  return null;
}
// Guards outbound connections to owner-entered hosts (mail servers, websites):
// public DNS names only, never IP literals, internal names or private addresses.

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
const PRIVATE_V6 = [/^::1?$/, /^f[cd]/i, /^fe[89ab]/i, /^::ffff:/i];

export function isPublicHostName(host: string): boolean {
  const name = host.toLowerCase();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)
    && !/^\d+(\.\d+){3}$/.test(name)
    && !/(^|\.)(localhost|local|internal|supabase\.co|supabase\.net)$/.test(name);
}

/** True when the name resolves and every address is public. */
export async function resolvesPublicly(host: string): Promise<boolean> {
  const name = host.toLowerCase();
  const [v4, v6] = await Promise.all([
    Deno.resolveDns(name, "A").catch(() => [] as string[]),
    Deno.resolveDns(name, "AAAA").catch(() => [] as string[]),
  ]);
  if (v4.length + v6.length === 0) return false;
  return !v4.some((ip) => PRIVATE_V4.some((r) => r.test(ip))) && !v6.some((ip) => PRIVATE_V6.some((r) => r.test(ip)));
}

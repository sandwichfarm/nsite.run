/**
 * Hostname parsing for nsite gateway routing.
 * Extracts npub and optional identifier from the Host header subdomain.
 *
 * Source: Adapted from nsyte/src/lib/gateway.ts extractNpubAndIdentifier()
 * Phase 4 adaptation: string npub only (no normalizeToPubkey — deferred to Phase 5)
 */

export interface SitePointer {
  kind: "root" | "named";
  npub: string;
  identifier?: string;
}

/**
 * Parse subdomain from host string into a SitePointer.
 * Returns null for root domain (no nsite subdomain) or unrecognized patterns.
 *
 * Examples:
 *   "npub1abc.nsite.run"         → { kind: "root", npub: "npub1abc" }
 *   "blog.npub1abc.nsite.run"    → { kind: "named", npub: "npub1abc", identifier: "blog" }
 *   "nsite.run"                  → null (root domain)
 *   "other.nsite.run"            → null (not an npub prefix)
 */
export function extractNpubAndIdentifier(host: string): SitePointer | null {
  // Strip port if present
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  // nsite.run has 2 parts. Subdomains make it 3+.
  if (parts.length < 3) return null;

  // Root site: npub1xxx.nsite.run
  if (parts[0].startsWith("npub1")) {
    return { kind: "root", npub: parts[0] };
  }

  // Named site: identifier.npub1xxx.nsite.run (4+ parts)
  if (parts.length >= 4 && parts[1].startsWith("npub1")) {
    const identifier = parts[0];
    // Validate identifier characters (alphanumeric, hyphens, underscores)
    if (/^[a-zA-Z0-9_-]+$/.test(identifier)) {
      return { kind: "named", npub: parts[1], identifier };
    }
  }

  return null;
}

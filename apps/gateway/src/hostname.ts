/**
 * Hostname parsing for nsite gateway routing.
 * Extracts npub and optional identifier from the Host header subdomain.
 *
 * Supported formats:
 *   Root site:   npub1xxx.nsite.run  → { kind: "root", npub: "npub1xxx" }
 *   Named site:  <pubkeyB36><dTag>.nsite.run  → { kind: "named", pubkeyHex: "...", identifier: "..." }
 *
 * Named site label is a single subdomain, 51-63 chars, all [a-z0-9].
 * First 50 chars are the pubkey encoded as base36, remaining chars are the dTag.
 *
 * Old double-wildcard format (identifier.npub1xxx.nsite.run) returns null — no longer supported.
 */

import { base36Decode } from "@nsite/shared/base36";

export interface SitePointer {
  kind: "root" | "named";
  npub: string;           // bech32 npub for root sites; empty string for named sites
  pubkeyHex?: string;     // hex pubkey for named sites (base36-decoded)
  identifier?: string;    // dTag for named sites
}

const PUBKEY_B36_LENGTH = 50;
const NAMED_SITE_MIN_LENGTH = 51; // 50 pubkey + at least 1 dTag char
const NAMED_SITE_MAX_LENGTH = 63; // 50 pubkey + max 13 dTag chars
const NAMED_SITE_RE = /^[a-z0-9]+$/;

/**
 * Parse subdomain from host string into a SitePointer.
 * Returns null for root domain (no nsite subdomain) or unrecognized patterns.
 *
 * Examples:
 *   "npub1abc.nsite.run"                         → { kind: "root", npub: "npub1abc" }
 *   "<50charBase36>blog.nsite.run"               → { kind: "named", npub: "", pubkeyHex: "...", identifier: "blog" }
 *   "nsite.run"                                  → null (root domain)
 *   "blog.npub1abc.nsite.run"                    → null (old format, not supported)
 */
export function extractNpubAndIdentifier(host: string): SitePointer | null {
  // Strip port if present
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  // nsite.run has 2 parts. Subdomains make it 3+.
  if (parts.length < 3) return null;

  const label = parts[0];

  // Root site: npub1xxx.nsite.run — first part starts with "npub1"
  if (label.startsWith("npub1")) {
    return { kind: "root", npub: label };
  }

  // Named site: single subdomain label (3 parts total), not npub1, length 51-63, all [a-z0-9]
  // Only single-label subdomains qualify — 4+ parts (e.g. blog.npub1abc.nsite.run) fall through to null
  if (
    parts.length === 3 &&
    label.length >= NAMED_SITE_MIN_LENGTH &&
    label.length <= NAMED_SITE_MAX_LENGTH &&
    NAMED_SITE_RE.test(label)
  ) {
    const pubkeyB36 = label.slice(0, PUBKEY_B36_LENGTH);
    const dTag = label.slice(PUBKEY_B36_LENGTH);

    const pubkeyBytes = base36Decode(pubkeyB36);
    if (!pubkeyBytes) return null;

    const pubkeyHex = Array.from(pubkeyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return { kind: "named", npub: "", pubkeyHex, identifier: dTag };
  }

  return null;
}

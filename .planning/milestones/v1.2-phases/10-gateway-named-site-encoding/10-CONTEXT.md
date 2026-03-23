# Phase 10: Gateway Named Site Encoding - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the gateway's hostname parser to use base36 single-label encoding for named sites instead of the deprecated double-wildcard format. Root sites continue using `npub1xxx.nsite.run`. The resolver already handles named sites correctly via `SitePointer` — only `hostname.ts` parsing logic changes, plus a new base36 codec in the shared package.

</domain>

<decisions>
## Implementation Decisions

### Base36 codec
- Hand-rolled implementation (~20 lines), no external library
- Lives in `packages/shared` — both gateway (Deno) and SPA (npm/Phase 11) will need it
- Encode: 32 bytes → 50-char lowercase base36 string (BigInt divmod)
- Decode: 50-char base36 string → 32 bytes (BigInt sum of digit * 36^position)
- Zero-pad to exactly 50 chars on encode

### Hostname parsing
- Root sites: `npub1xxx.nsite.run` — unchanged, npub1 prefix detection stays
- Named sites: single label `<pubkeyB36><dTag>` — 51-63 chars, all `[a-z0-9]`
- Detection: if subdomain is a single label (3 parts total: `label.nsite.run`), not starting with `npub1`, length 51-63, first 50 chars decode to valid 32-byte pubkey → named site
- Extract pubkey from first 50 chars, dTag from remainder
- `SitePointer` interface stays the same (`kind: "root" | "named"`, `npub`, `identifier`)
- BUT: named sites now return hex pubkey instead of npub string (since base36 decodes to raw bytes, not npub). The resolver already converts npub to hex internally — this simplifies it.

### Root site format
- Only `npub1` format for root sites — bare 50-char base36 labels (no dTag) are NOT treated as root sites
- Clean separation: `npub1*` = root, `[a-z0-9]{51,63}` = named

### Backward compatibility
- Old double-wildcard format (`identifier.npub1xxx.nsite.run`) silently returns null from parser
- Falls through to SPA or 404 — no special redirect or error page
- SSL certs can't do `*.*.nsite.run` anyway, so browsers won't reach the gateway with this format

### Claude's Discretion
- Whether to validate that decoded bytes are exactly 32 bytes (they should be by construction)
- Test coverage depth for edge cases (malformed base36, exactly 50 chars, 64+ chars)
- Whether to update `SitePointer.npub` field name to `pubkeyHex` or keep as `npub` with hex value

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### nsite spec (named site encoding)
- NIP PR #1538: https://github.com/nostr-protocol/nips/pull/1538 — defines named site subdomain encoding
- Readable spec: https://github.com/hzrd149/nips/blob/nsite/nsite.md — full nsite NIP with encoding details
- Note: spec currently says base32 but we are using base36 (pending spec update). pubkeyB36 = 50 chars, dTag = 1-13 chars `[a-z0-9]`

### Gateway code
- `apps/gateway/src/hostname.ts` — current parser to replace (extractNpubAndIdentifier)
- `apps/gateway/src/hostname.test.ts` — current tests to update
- `apps/gateway/src/resolver.ts` — uses SitePointer, queries kind 35128 with `#d` filter for named sites

No project-local spec files — encoding details captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SitePointer` interface in `hostname.ts` — `{ kind: "root" | "named", npub: string, identifier?: string }`. Can be kept as-is or renamed.
- `resolver.ts` already handles named sites: line 365-373 uses `pointer.kind === "named"` and `pointer.identifier` to query kind 35128 with `#d` filter.
- `packages/shared/src/` has `sha256.ts`, `validation.ts`, `types.ts` — base36 codec goes alongside these.

### Established Patterns
- `packages/shared` exports via `mod.ts` barrel file
- Gateway imports shared types via `@nsite/shared` import map
- Tests use `@std/assert` with `Deno.test()`

### Integration Points
- `hostname.ts:extractNpubAndIdentifier()` is the ONLY function that needs to change
- `router.ts` calls `extractNpubAndIdentifier(host)` and passes the SitePointer to the resolver
- `resolver.ts` uses `pointer.npub` to decode hex pubkey via `nip19.decode()` — if we return hex directly from hostname parser, this decode step can be simplified
- `hostname.test.ts` needs all tests rewritten for new format

</code_context>

<specifics>
## Specific Ideas

- The SitePointer might benefit from carrying `pubkeyHex` instead of `npub` for named sites, since base36 decodes to raw bytes (hex). The resolver currently does `nip19.decode(pointer.npub)` anyway — returning hex directly would skip that step for named sites.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-gateway-named-site-encoding*
*Context gathered: 2026-03-21*

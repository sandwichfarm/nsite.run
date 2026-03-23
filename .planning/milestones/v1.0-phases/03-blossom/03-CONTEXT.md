# Phase 3: Blossom - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

nsite-only blossom server that stores and serves blobs for nsite manifests via BUD protocol. Ported from the existing blssm.us (sandwichfarm/blssm.us) codebase — a production blossom server already running on the same Bunny Edge Scripting + Bunny Storage stack. Port core modules, strip payment gating, adapt imports to use @nsite/shared and nostr-tools.

</domain>

<decisions>
## Implementation Decisions

### Source and porting strategy
- Port blssm.us handler, auth, storage, and type modules into apps/blossom/src
- Strip payment gating middleware entirely (free public infrastructure)
- Keep all other features: BUD-01, BUD-02, BUD-04 (mirror), BUD-06 (preflight), BUD-08 (NIP-94 metadata), BUD-09 (reporting)
- Skip admin endpoints (price refresh, storage sweep) — admin via Bunny dashboard
- Adapt imports to use @nsite/shared types and constants where applicable
- Switch schnorr verification from @noble/curves to nostr-tools (consistency with relay)

### Auth verification (kind 24242)
- 120-second expiration window (created_at must be within 120s of server time)
- Strict content-type match: auth event's `t` tag must match uploaded blob's actual content type
- Required `x` tag: auth event MUST include x tag with expected SHA-256 hash, verified against computed hash
- Open access: any pubkey can upload with valid auth — no whitelist, no access control restrictions
- Keep blssm.us batch auth event support (multiple x tags in single auth event — nsyte compatibility)

### Manifest reference check (BLSM-05)
- No manifest check on upload path — auth + hash verification is the gate
- Upload-before-manifest is the natural nsyte workflow (upload files, then publish manifest)
- No garbage collection for v1 — keep all uploaded blobs indefinitely
- Manifest reference check deferred to background audit or future version

### Storage
- Keep Bunny Storage metadata pattern from blssm.us (JSON metadata files alongside blobs)
- No libSQL for blossom — relay uses libSQL, blossom uses Bunny Storage only
- Keep sharded storage paths from blssm.us (2-char prefix: blobs/ab/abcd...)
- Env vars: BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_HOSTNAME, BUNNY_STORAGE_USERNAME, BUNNY_CDN_HOSTNAME, SERVER_URL

### Ownership and deletion
- Keep multi-owner blob model from blssm.us
- Multiple pubkeys can upload the same hash (deduplication)
- DELETE removes your ownership; blob deleted from storage only when last owner removes it
- Keep content blocking feature (hash-based block list for illegal/reported content)

### Claude's Discretion
- How to structure the port (which files to split/merge during adaptation)
- Router implementation details (blssm.us router pattern vs new)
- CORS configuration specifics
- Max upload size default
- How to integrate server-info endpoint with nsite-specific information

</decisions>

<specifics>
## Specific Ideas

- blssm.us is the reference implementation: ~/Develop/blssm.us — port from there, not from scratch
- The server should remain compatible with nsyte CLI as an upload target
- Mirror (BUD-04) and report (BUD-09) will be useful for future stages — port them now even if not in current requirements
- Content blocking is important for operating a public service responsibly

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@nsite/shared/sha256`: sha256Hex() utility for hash verification
- `@nsite/shared/types`: NostrEvent, NostrFilter, NsiteKind, ValidationResult
- `@nsite/shared/constants`: ALLOWED_KINDS array
- `@nsite/shared/validation`: isAllowedKind(), validateEventKind()
- Relay's `apps/relay/src/db.ts`: queryEvents() can be used if blossom ever needs to query relay DB directly

### Established Patterns
- BunnySDK.net.http.serve handler shape (synchronous fetch(request): Response)
- esbuild bundling with denoPlugins for Bunny edge runtime
- nostr-tools for event verification (relay already uses @nostr/tools@^2.23.3/pure)
- Rate limiting pattern from relay (apps/relay/src/ratelimit.ts)

### Integration Points
- `apps/blossom/src/main.ts` — current stub, will become the blossom entry point
- `apps/blossom/build.ts` — esbuild config already configured
- Bunny Storage REST API — same as blssm.us uses
- blssm.us source at ~/Develop/blssm.us — the primary reference for porting

### blssm.us Source Structure (port reference)
- `src/auth/nostr.ts` — kind 24242 validation (adapt to nostr-tools)
- `src/auth/schnorr.ts` — replace with nostr-tools verification
- `src/handlers/blob-upload.ts` — strip payment gate, keep core logic
- `src/handlers/blob-get.ts` — port as-is (GET/HEAD with range support)
- `src/handlers/blob-delete.ts` — port as-is (owner verification)
- `src/handlers/blob-list.ts` — port as-is (cursor pagination)
- `src/handlers/mirror.ts` — port as-is (BUD-04)
- `src/handlers/report.ts` — port as-is (BUD-09)
- `src/handlers/upload-check.ts` — port as-is (BUD-06 preflight)
- `src/handlers/server-info.ts` — adapt for nsite-specific info
- `src/storage/client.ts` — port as-is (Bunny Storage REST wrapper)
- `src/storage/metadata.ts` — port as-is (blob metadata + index management)
- `src/middleware/cors.ts` — port as-is
- `src/router.ts` — port or adapt pattern
- `src/types.ts` — merge with @nsite/shared where applicable
- `src/util.ts` — port needed utilities

</code_context>

<deferred>
## Deferred Ideas

- Payment gating (BUD-07) — may add later if storage costs become an issue
- Admin endpoints — manage via Bunny dashboard for v1
- Garbage collection for unreferenced blobs — defer unless storage becomes a concern
- Access control allowlist/blocklist — open access for v1, may restrict later

</deferred>

---

*Phase: 03-blossom*
*Context gathered: 2026-03-13*

# Phase 2: Relay - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

NIP-01 nostr relay scoped to nsite event kinds (15128, 35128, 10002, 10063), persisted in Bunny DB (libSQL), with NIP-11 relay info document. Accepts WebSocket connections, handles EVENT/REQ/CLOSE messages, enforces kind restrictions, and serves relay metadata over HTTP.

</domain>

<decisions>
## Implementation Decisions

### Event signature verification
- Full verification on every EVENT: verify event id (SHA-256 of serialized event) AND schnorr signature
- Use nostr-tools library for event verification and serialization
- Synchronous verification — verify before storing, client gets OK true/false immediately
- Duplicate events (same event id already stored) return OK true silently, no message

### NIP-11 relay info document
- Name: "nsite.run relay"
- Description: "nsite-only relay for kind 15128/35128/10002/10063 events"
- Contact: operator's npub — hardcode placeholder, fill in before deploy
- Include sensible limitation fields (max_message_length, max_filters, max_subscriptions) — Claude picks reasonable values
- Advertise supported NIPs and the kind restriction

### Storage and query scope
- Enforce NIP-01 replaceable event semantics for kind 10002 and 10063 (newer event replaces older for same pubkey+kind)
- Enforce NIP-33 parameterized replaceable event semantics for kind 35128 (pubkey + kind + d-tag = unique, newer replaces older)
- Index all single-letter tags for REQ filter support (#d, #e, #p, #t, etc.)
- Support NIP-09 event deletion (kind 5) — accept kind 5 deletion events that reference stored events by the same pubkey. This adds kind 5 to the accepted kinds list.

### Error and rejection behavior
- Non-allowed kinds: OK false with specific reason ("blocked: kind N not allowed on this relay")
- Basic per-IP rate limiting on EVENT and REQ messages — Claude picks reasonable thresholds
- Malformed WebSocket messages (invalid JSON, wrong format): send NOTICE, then close the connection
- Specific error messages for verification failures: differentiate "invalid: bad event id", "invalid: bad signature", "invalid: missing fields"

### Claude's Discretion
- Rate limit thresholds (events/min, reqs/min per IP)
- NIP-11 limitation values (max message size, max filters, max subscriptions)
- Bunny DB schema design and migration approach
- WebSocket connection management (ping/pong, idle timeout)
- Exact NIP-09 deletion implementation (soft delete vs hard delete)

</decisions>

<specifics>
## Specific Ideas

- The relay should work as a target for nsyte CLI — standard NIP-01 clients should be able to publish nsite manifests to it
- Kind 5 (deletion) support was explicitly requested despite not being in the original requirements — update ALLOWED_KINDS accordingly

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@nsite/shared/types`: NostrEvent, NostrFilter, NsiteKind, ValidationResult interfaces already defined
- `@nsite/shared/constants`: ALLOWED_KINDS array (currently [15128, 35128, 10002, 10063] — will need kind 5 added)
- `@nsite/shared/validation`: isAllowedKind() and validateEventKind() functions ready to use
- `@nsite/shared/sha256`: sha256Hex() utility available

### Established Patterns
- BunnySDK.net.http.serve handler shape (synchronous fetch(request): Response)
- Workspace imports via @nsite/shared/* path
- esbuild bundling with denoPlugins for Bunny edge runtime

### Integration Points
- `apps/relay/src/main.ts` — current stub, will become the relay entry point
- `apps/relay/build.ts` — esbuild config already configured
- Bunny DB (libSQL) available via BunnySDK — not yet used in codebase
- Bunny Edge Scripting WebSocket API for handling upgrades

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-relay*
*Context gathered: 2026-03-13*

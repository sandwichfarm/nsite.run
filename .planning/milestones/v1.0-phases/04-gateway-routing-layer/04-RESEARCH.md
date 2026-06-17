# Phase 4: Gateway Routing Layer - Research

**Researched:** 2026-03-13
**Domain:** Bunny Edge Script request routing — WebSocket proxy, hostname-based dispatch, blossom path dispatch
**Confidence:** HIGH — all critical findings derived from direct code inspection of the project's own relay/blossom (apps/relay, apps/blossom), the nostr.pub reference relay, and the nsyte gateway.ts reference implementation.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | Gateway Edge Script routes root domain requests (no npub subdomain) to SPA | Router logic: no subdomain detected → return stub 200 or SPA response |
| ROUTE-02 | Gateway Edge Script routes npub subdomain requests to nsite resolver | Hostname parsing: `parts[0].startsWith("npub1")` → resolver stub; two-part parse for named sites |
| ROUTE-03 | Gateway Edge Script routes WebSocket upgrade requests to relay | `Upgrade: websocket` header check → `Deno.upgradeWebSocket()` or fetch-based proxy |
| ROUTE-04 | Gateway Edge Script routes blossom endpoints to blossom server | Path match: `/upload`, `/[0-9a-f]{64}`, `/list/`, `/mirror`, `/report`, `/server-info` |
| ROUTE-05 | Gateway Edge Script routes named site subdomains to resolver stub | Hostname parsing: `parts[1].startsWith("npub1")` → named-site resolver stub |
</phase_requirements>

---

## Summary

Phase 4 implements the gateway Edge Script as a pure request router. It replaces the existing stub `apps/gateway/src/main.ts` (which returns a JSON stub for all requests) with a real dispatcher that inspects the `Host` header and request path to route to the correct backend. The actual nsite resolution logic (Phase 5) and SPA serving (Phase 6) are explicitly out of scope — Phase 4 delivers only routing correctness, verified by stub responses that confirm correct dispatch.

The critical open question from STATE.md — whether Bunny Edge Scripts can proxy WebSocket upgrades via `fetch()` — must be resolved during this phase. The pragmatic fallback is to handle WebSocket upgrades natively in the gateway with `Deno.upgradeWebSocket()` and then proxy NIP-01 messages to the relay's pull zone URL via its HTTP WebSocket endpoint. However, the simpler approach (return a stub 503 for WebSocket indicating "relay routing wired") is acceptable for Phase 4's success criteria, deferring live WebSocket proxy to Phase 5.

**Primary recommendation:** Implement the gateway router in `apps/gateway/src/` with: (1) a `router.ts` containing dispatch logic, (2) a `hostname.ts` for npub/identifier parsing, (3) stub response modules for relay/blossom/spa/resolver, and wire them in `main.ts` using the `export default { fetch }` pattern already established by apps/blossom and apps/relay.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno (platform) | 1.46.3 (Bunny-pinned) | Runtime | All apps in this project target Deno on Bunny Edge Scripting |
| TypeScript | esnext/strict | Language | Consistent with relay and blossom apps |
| `@nsite/shared` | workspace | NsiteKind constants, NostrEvent types | Already imported by relay and blossom; avoids duplication |
| esbuild | 0.27.3 (npm) | Bundle for deploy | Same as relay/blossom build.ts |
| @luca/esbuild-deno-loader | 0.11.1 (jsr) | Deno module resolution during bundling | Same as relay/blossom |

### No Additional Libraries Needed

Phase 4 routing is pure URL/header inspection. No crypto, no DB, no nostr library. The gateway deno.json needs no new imports for the routing layer.

The only import needed is `@nsite/shared` (workspace, already in root deno.json) for shared constants. Everything else is Web API: `new URL(request.url)`, `request.headers.get("host")`, `request.headers.get("upgrade")`.

### Entry Point Pattern

Both `apps/relay` and `apps/blossom` use `export default { fetch }` (NOT `BunnySDK.net.http.serve()`). This is the established pattern for this project per the decision logged in STATE.md:

> "export default { fetch } pattern instead of BunnySDK.net.http.serve() — build.ts does not externalize @bunny.net/edgescript-sdk"

The gateway MUST follow this same pattern.

**Installation:** No new packages. Gateway deno.json only needs the workspace shared import:

```json
{
  "name": "@nsite/gateway",
  "version": "0.1.0",
  "exports": "./src/main.ts",
  "imports": {
    "@nsite/shared": "@nsite/shared"
  },
  "tasks": {
    "build": "deno run --allow-read --allow-write --allow-net --allow-run --allow-env build.ts"
  }
}
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/gateway/src/
├── main.ts          # export default { fetch } entry point; creates no deps (stateless router)
├── router.ts        # Route dispatch: host + path inspection, calls stub handlers
├── hostname.ts      # extractNpubAndIdentifier(host) — npub/named-site subdomain parsing
└── stubs/
    ├── relay.ts     # handleRelayStub() → 503 "relay routing wired, resolver not yet live"
    ├── blossom.ts   # handleBlossomStub() → 503 "blossom routing wired"
    ├── resolver.ts  # handleResolverStub() → 503 "nsite resolver not yet live"
    └── spa.ts       # handleSpaStub() → 200 "SPA routing wired"
```

This structure mirrors the blossom app's `router.ts` → `handlers/` pattern. The stubs become real implementations in Phase 5 and Phase 6 without touching `router.ts`.

### Pattern 1: `export default { fetch }` Entry Point

**What:** The main.ts exports a fetch handler object. Bunny Edge Scripting recognizes this pattern.
**When to use:** Always — established by both relay and blossom apps in this project.

```typescript
// apps/gateway/src/main.ts
import { route } from "./router.ts";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await route(request);
    } catch (err) {
      console.error("Gateway error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
```

### Pattern 2: Host-Header Router

**What:** Inspect `Host` header first, then path. Priority order matters:
1. WebSocket upgrade (regardless of host)
2. Blossom paths on root domain
3. npub subdomain (root site)
4. named-site subdomain (identifier.npub1xxx)
5. Root domain / fallback → SPA

**Why priority matters:** A WebSocket upgrade to `wss://nsite.run` must go to relay before the root-domain SPA check. A blossom path like `/upload` on the root domain must go to blossom before the SPA check.

```typescript
// apps/gateway/src/router.ts
import { extractNpubAndIdentifier } from "./hostname.ts";
import { handleRelayStub } from "./stubs/relay.ts";
import { handleBlossomStub } from "./stubs/blossom.ts";
import { handleResolverStub } from "./stubs/resolver.ts";
import { handleSpaStub } from "./stubs/spa.ts";

/** Blossom paths per BUD spec (same as apps/blossom/src/router.ts) */
const BLOSSOM_PATH_RE = /^\/[0-9a-f]{64}/;

function isBlossomPath(pathname: string): boolean {
  return (
    pathname === "/upload" ||
    pathname.startsWith("/list/") ||
    pathname === "/mirror" ||
    pathname === "/report" ||
    pathname === "/server-info" ||
    BLOSSOM_PATH_RE.test(pathname)
  );
}

export async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.hostname;

  // 1. WebSocket upgrade → relay (highest priority, any host)
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return handleRelayStub(request);
  }

  // 2. Blossom endpoints on root domain
  if (isBlossomPath(url.pathname)) {
    return handleBlossomStub(request);
  }

  // 3. npub / named-site subdomain → nsite resolver
  const sitePointer = extractNpubAndIdentifier(host);
  if (sitePointer) {
    return handleResolverStub(request, sitePointer);
  }

  // 4. Root domain (no npub subdomain) → SPA
  return handleSpaStub(request);
}
```

### Pattern 3: Hostname Parsing (npub + named-site)

**What:** Two-step subdomain parse derived from `extractNpubAndIdentifier` in nsyte/src/lib/gateway.ts. The nsite.run domain is two parts, so subdomains start at index 0 (for `npub1xxx.nsite.run`) and at index 0+1 (for `identifier.npub1xxx.nsite.run`).

**Critical correctness requirement:** `parts[0].startsWith("npub1")` for root sites; `parts[1].startsWith("npub1")` for named sites. Do NOT use length checks on the npub — bech32 lengths vary.

```typescript
// apps/gateway/src/hostname.ts
// Source: nsyte/src/lib/gateway.ts extractNpubAndIdentifier()

export interface SitePointer {
  kind: "root" | "named";
  npub: string;             // raw bech32 npub string (decoding deferred to Phase 5)
  identifier?: string;      // only for named sites
}

/**
 * Parse subdomain from host string into a SitePointer.
 * Returns null for root domain (no nsite subdomain).
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
```

**Note on Phase 4 scope:** The `SitePointer` type for Phase 4 only needs `kind`, `npub` (string), and `identifier` — Phase 5 will decode the npub to a hex pubkey using `normalizeToPubkey` from applesauce-core/helpers. Do NOT add applesauce as a Phase 4 dependency — it's heavy and unnecessary for routing stubs.

### Pattern 4: Stub Response Modules

Each stub returns a distinct, verifiable response that confirms routing worked:

```typescript
// apps/gateway/src/stubs/relay.ts
export function handleRelayStub(_request: Request): Response {
  return new Response(
    JSON.stringify({ routed: "relay", status: "stub", note: "WebSocket relay routing wired — resolver not yet live" }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

// apps/gateway/src/stubs/resolver.ts
import type { SitePointer } from "../hostname.ts";
export function handleResolverStub(_request: Request, pointer: SitePointer): Response {
  return new Response(
    JSON.stringify({ routed: "resolver", kind: pointer.kind, npub: pointer.npub, identifier: pointer.identifier ?? null, note: "nsite resolver not yet live" }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

// apps/gateway/src/stubs/blossom.ts
export function handleBlossomStub(_request: Request): Response {
  return new Response(
    JSON.stringify({ routed: "blossom", status: "stub", note: "Blossom routing wired — handler not yet live" }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

// apps/gateway/src/stubs/spa.ts
export function handleSpaStub(_request: Request): Response {
  return new Response(
    JSON.stringify({ routed: "spa", status: "stub", note: "SPA routing wired" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
```

### Anti-Patterns to Avoid

- **Checking blossom paths AFTER subdomain check:** If `npub1xxx.nsite.run/upload` is hit, the subdomain check fires first and routes to the resolver instead of blossom. Check blossom paths before subdomain. (See priority order in Pattern 2.)
- **Using host.split(".").length === 2 to detect root domain:** The subdomain function already returns null for root domain — don't add a separate check.
- **String length check for npub validation:** bech32 npub lengths vary; always use `startsWith("npub1")` as the discriminator.
- **Adding `normalizeToPubkey()` to Phase 4:** Requires applesauce-core, adds bundle weight unnecessarily. Phase 4 stubs only need the string npub for logging — decode in Phase 5.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subdomain extraction | Custom regex/split logic from scratch | Pattern from `nsyte/src/lib/gateway.ts` `extractNpubAndIdentifier()` (already researched, copy directly) | The nsyte reference handles the exact edge cases: `parts[0]` vs `parts[1]`, port stripping, identifier validation |
| Blossom path matching | String comparisons per-route | Copy `BLOB_PATH_RE` and `isBlossomPath()` logic from `apps/blossom/src/router.ts` | Same regex used there, already tested |
| WebSocket detection | Checking multiple headers | Single check: `request.headers.get("upgrade")?.toLowerCase() === "websocket"` (pattern from `apps/relay/src/main.ts`) | The relay already does this correctly |

---

## Common Pitfalls

### Pitfall 1: Named-Site Routing — Wrong Subdomain Index

**What goes wrong:** Using `parts[0]` for all npub lookups misses named sites where `parts[0]` is the identifier (e.g., `blog`). The route falls through to SPA.
**Why it happens:** Root sites have npub at index 0. Named sites have npub at index 1. A naive implementation only checks index 0.
**How to avoid:** Always check `parts[0].startsWith("npub1")` for root AND `parts[1].startsWith("npub1")` for named. See Pattern 3 above.
**Warning signs:** `npub1xxx.nsite.run` routes correctly but `blog.npub1xxx.nsite.run` returns a SPA stub response.

### Pitfall 2: Blossom Path Check Before WebSocket Check

**What goes wrong:** If a client WebSocket-upgrades to `/upload` (unusual but possible), blossom path check fires first and returns 503 instead of routing to the relay.
**How to avoid:** WebSocket upgrade check is always first — before any path or host inspection.

### Pitfall 3: CORS OPTIONS on Blossom Paths

**What goes wrong:** Browser pre-flight OPTIONS requests to blossom endpoints (e.g. OPTIONS /upload) return 503 from the gateway stub because the stub doesn't handle OPTIONS.
**How to avoid:** The blossom stub (and later the real blossom handler) must return 200 for OPTIONS. For Phase 4, add a minimal OPTIONS handler in `handleBlossomStub`:
```typescript
if (request.method === "OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
```

### Pitfall 4: Phase 4 Tests Must Use Host Header, Not URL Hostname

**What goes wrong:** `new URL(request.url)` on a Bunny Edge Script gives `nsite.run` as the host regardless of wildcard subdomain — the real hostname comes from the `Host` header.
**How to avoid:** Router always reads `request.headers.get("host")` (with fallback to `url.hostname`). Unit tests must construct mock Requests with the correct `Host` header:
```typescript
const req = new Request("https://npub1abc.nsite.run/", {
  headers: { "Host": "npub1abc.nsite.run" },
});
```

### Pitfall 5: WebSocket Proxying Is Unconfirmed on Bunny

**From STATE.md blocker:** "Phase 4: Bunny edge script fetch() WebSocket upgrade forwarding is unconfirmed."

**What this means for Phase 4:** The Phase 4 success criterion for ROUTE-03 is a stub 503 confirming relay routing is wired — NOT a live WebSocket proxy. The routing decision happens (gateway correctly identifies WebSocket upgrade requests), but the response is a stub. Live WebSocket proxying is resolved in Phase 5 with the actual relay backend.

**The real question for Phase 5:** Can the gateway call `fetch(relayUrl, { headers: { Upgrade: "websocket" } })` to proxy to the relay's pull zone, or does the CDN handle WebSocket upgrade routing separately? Research this in Phase 5 planning.

---

## Code Examples

Verified patterns from existing codebase:

### Correct Host Header Reading (from apps/relay/src/main.ts)

```typescript
// Source: apps/relay/src/main.ts
if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
  return handleWebSocketUpgrade(request, db);
}
```

### Correct subdomain extraction (from nostr.pub/src/router.ts)

```typescript
// Source: nostr.pub/src/router.ts
export function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
}
```

### Correct npub + identifier extraction (from nsyte/src/lib/gateway.ts)

```typescript
// Source: nsyte/src/lib/gateway.ts lines 83-110
function extractNpubAndIdentifier(hostname: string): AddressPointer | null {
  const parts = hostname.split(".");
  if (parts.length < 2) return null;

  if (parts[0].startsWith("npub")) {
    const pubkey = normalizeToPubkey(parts[0]);
    if (!pubkey) return null;
    return { pubkey, kind: NSITE_ROOT_SITE_KIND, identifier: "" };
  }

  if (parts.length >= 3 && parts[0] && parts[1].startsWith("npub")) {
    const identifier = parts[0];
    const pubkey = normalizeToPubkey(parts[1]);
    if (!pubkey) return null;
    if (/^[a-zA-Z0-9_-]+$/.test(identifier)) {
      return { pubkey, kind: NSITE_NAME_SITE_KIND, identifier };
    }
  }

  return null;
}
```

**Phase 4 adaptation:** Skip `normalizeToPubkey()` (requires applesauce). Use the string npub directly in the SitePointer. Validation is: `startsWith("npub1")` and identifier regex.

### Blossom path regex (from apps/blossom/src/router.ts)

```typescript
// Source: apps/blossom/src/router.ts
const BLOB_PATH_RE = /^\/[0-9a-f]{64}/;
```

### `export default { fetch }` entry pattern (from apps/blossom/src/main.ts)

```typescript
// Source: apps/blossom/src/main.ts
export default {
  async fetch(request: Request): Promise<Response> {
    return route(request, storage, config);
  },
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BunnySDK.net.http.serve()` | `export default { fetch }` | Phase 3 decision | Build.ts does not externalize SDK; consistent with relay/blossom pattern |
| One monolithic edge script | Separate relay/blossom/gateway scripts | Architecture decision | Independent deploy, bundle size headroom |
| Pull zone edge rules for routing | Gateway-as-router (Phase 4) | Deferred to v2 | Code routing is simpler to validate end-to-end; CDN rules optimization is a v2 follow-up |

**Deprecated/outdated:**
- `BunnySDK.net.http.serve()` entry point: Not used in this project. See STATE.md decision. Do not introduce it in the gateway.

---

## Open Questions

1. **WebSocket proxy feasibility on Bunny**
   - What we know: The relay handles WebSocket upgrades natively via `Deno.upgradeWebSocket()`. The gateway needs to either (a) proxy WS to the relay pull zone or (b) have the CDN route WS upgrades directly to the relay pull zone via edge rules.
   - What's unclear: Whether Bunny's `fetch()` from an Edge Script supports forwarding WebSocket upgrade headers to another pull zone.
   - Recommendation: Phase 4 success criterion is a stub 503 — defer live proxy to Phase 5 where the relay is live and testable.

2. **Blossom routing: gateway-as-proxy or CDN-level routing**
   - What we know: Blossom is a separate Edge Script at a separate Bunny pull zone. For Phase 4, stubs are acceptable.
   - What's unclear: In Phase 5, does the gateway proxy blossom requests via `fetch(blossomPullZoneUrl, request)` or do CDN edge rules route `/upload` and `/{sha256}` to the blossom pull zone directly?
   - Recommendation: Implement proxy via `fetch()` in Phase 5. Research whether Bunny allows setting `Host` header in subrequests (to hit the blossom pull zone's CDN URL).

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (key absent). Skipping this section.

---

## Sources

### Primary (HIGH confidence)

- `apps/gateway/src/main.ts` — current gateway stub; entry point pattern to replace
- `apps/relay/src/main.ts` — WebSocket upgrade detection pattern, `export default { fetch }` pattern
- `apps/blossom/src/router.ts` — blossom path regex `BLOB_PATH_RE`, `isBlossomPath` patterns
- `apps/blossom/src/main.ts` — `export default { fetch }` pattern confirmed
- `apps/relay/deno.json` — relay imports for reference
- `apps/blossom/deno.json` — blossom imports for reference
- `packages/shared/src/constants.ts` — ALLOWED_KINDS, bundle size constants
- `.planning/STATE.md` — logged decision: `export default { fetch }` pattern; open blocker: WebSocket proxy unconfirmed
- `nsyte/src/lib/gateway.ts` lines 83–110 — `extractNpubAndIdentifier()` implementation
- `nostr.pub/src/router.ts` — `extractSubdomain()`, Host header reading pattern

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — routing architecture diagram, priority order
- `.planning/research/PITFALLS.md` — Pitfall 5 (npub subdomain parsing), Pitfall 7 (cross-script communication)
- `.planning/research/STACK.md` — library versions, `export default { fetch }` vs BunnySDK note

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; patterns copied from existing relay/blossom apps
- Architecture: HIGH — routing priority order derived from direct code inspection of nsyte gateway reference
- Pitfalls: HIGH — subdomain parsing pitfall documented in PITFALLS.md from nsyte source; WebSocket pitfall documented in STATE.md blocker

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable — Bunny platform and Deno version are locked)

# Project Research Summary

**Project:** nsite.run
**Domain:** Decentralized static site gateway — Nostr + Blossom on Bunny Edge Scripting
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

nsite.run is a unified nsite hosting stack: a nostr relay, a blossom blob server, an nsite content gateway, and a Svelte deploy SPA — all running on Bunny's CDN edge infrastructure at nsite.run. Three working reference implementations exist in the local workspace (nostr.pub for the relay pattern, blssm.us for the blossom pattern, nsyte/src/lib/gateway.ts for the progressive caching and content serving logic), which means this project is largely a composition and integration task rather than greenfield development. The recommended approach is to port each component from its reference implementation, adapt for nsite-specific constraints (kind filtering, nsite-only blob scope), then integrate through standard nostr + blossom protocols.

The most significant architectural decision — already made in PROJECT.md — is to use three separate Bunny Edge Scripts (relay, blossom, gateway) rather than a monolith. This is correct and essential: each bundle must stay under 1MB, each component has an independent deployment cycle, and the relay and blossom must be reachable via standard protocols so the broader nsite ecosystem can use them as infrastructure targets. The gateway acts as the primary router, proxying traffic to the appropriate script. The SPA is a static Svelte build served from Bunny Storage.

The primary technical risks are (1) bundle size creep past 1MB — preventable with a CI gate installed from day one; (2) cross-script communication on Bunny Edge — edge scripts are isolated processes with no in-process IPC, requiring the gateway to call relay and blossom via HTTP over their public pull zone URLs; and (3) a race condition in the progressive caching layer when multiple concurrent requests hit the same cold-cache site — directly fixable with the "promise as mutex" pattern before the first await. All three risks have documented prevention strategies derived from the reference implementations.

## Key Findings

### Recommended Stack

The stack is fully determined by platform constraints and reference implementations. Bunny Edge Scripting pins Deno to version 1.46.3 — no choice is available. All edge scripts are bundled as single ESM files with esbuild@0.20.1 + @luca/esbuild-deno-loader@0.11.1, both pinned to the versions proven working in nostr.pub. The nostr/crypto layer uses @noble/curves@1.8.1 and @noble/hashes@1.6.1 directly (avoiding heavier wrappers). The applesauce-* suite at ^5.1.0 provides relay pool, event loaders, and signer infrastructure for the gateway's manifest resolution and the SPA's auth/publish flows. Svelte 5 + Vite 6 is recommended for the SPA (upgrade from nsite.run's Svelte 4). The SPA is the only Node/pnpm package; all edge script packages are Deno-native with no install step.

**Core technologies:**
- Deno 1.46.3 (platform-pinned): runtime for all edge scripts — no choice, no deviation
- BunnySDK (external): `BunnySDK.net.http.serve()` is the only valid edge script entry point
- esbuild@0.20.1 + @luca/esbuild-deno-loader@0.11.1: bundle Deno TypeScript to single ESM file for Bunny upload
- @libsql/client@0.17.0 (`/web` subpath): Bunny DB HTTP transport — must use `/web`, never the default driver
- @noble/curves@1.8.1 + @noble/hashes@1.6.1: Schnorr signature verification and SHA-256 — use directly, not through nostr-tools
- applesauce-core / relay / loaders / common / signers @^5.1.0: relay pool, manifest loaders, NIP-07/46 signers — all must match major.minor
- Svelte 5 + Vite 6: SPA frontend — runes-based, do not mix Svelte 4 patterns
- Tailwind CSS 3.x: SPA styling — stay on v3, v4 migration is not worth the risk
- Bunny Storage REST API: raw fetch wrapper (StorageClient class) — no SDK, not S3-compatible

**Critical version constraints:**
- `@noble/curves` must stay at 1.8.1 in edge scripts (2.x is a breaking change; validate before upgrading)
- `@libsql/client` import must be `@libsql/client/web`, not `@libsql/client` (native driver bloats bundle ~200KB)
- All applesauce-* packages must share the same `^5.1.x` version lock

### Expected Features

All features in PROJECT.md are confirmed as essential by the nsite NIP spec and reference implementations. The feature dependency graph is clear: relay and blossom must exist before the gateway can cache into them; the gateway's routing layer must work before nsite serving can function; progressive caching builds on working manifest resolution.

**Must have (table stakes — v1 launch):**
- Routing layer: all traffic at nsite.run routed by host/path/WebSocket upgrade
- nsite-only nostr relay: kinds 15128, 35128, 10002, 10063 at wss://nsite.run
- nsite-only blossom server: BUD-01/02 endpoints; only nsite-manifest-referenced blobs
- npub subdomain gateway: resolve and serve `npub1xxx.nsite.run`
- Named site gateway: resolve and serve `blog.npub1xxx.nsite.run`
- Progressive caching: cold/warm-stale/warm-current state machine with loading page
- Update banner injection: non-intrusive, manual click, injected before `</body>`
- SPA deploy UI: NIP-07 + NIP-46 auth, folder/zip/tar.gz upload, file list preview, secret scanning
- Educational content: what is an nsite, how to deploy, links to ecosystem

**Should have (competitive differentiators — add when core is working):**
- Gateway caches manifests into own relay (ecosystem benefit; low implementation cost)
- Gateway caches fetched blobs into own blossom (CDN-like distribution; low implementation cost)
- Profile display on loading page (kind 0 fetch for display name + avatar)

**Defer (v2+):**
- Pull zone edge rules for routing (cost optimization; complex to validate, low urgency at launch)
- Ecosystem gateway listing refresh (update SPA links as nsite ecosystem grows)

**Anti-features to avoid building:**
- General-purpose relay or blossom (storage explosion, scope creep)
- Auto-refresh on update detection (hostile UX; banner + manual click is correct)
- Legacy kind 34128 support (deprecated; adds complexity for no user benefit)
- GitHub Actions auto-deploy integration (the nsite-action already solves this in the ecosystem)

### Architecture Approach

The architecture is a four-package Deno monorepo with a Bunny CDN layer in front. The gateway Edge Script receives all traffic and routes by host header inspection: WebSocket upgrades proxy to the relay pull zone; blossom paths proxy to the blossom pull zone; npub subdomains go to the nsite resolver; root domain serves the SPA from Bunny Storage. The relay and blossom packages have no knowledge of each other and communicate with the gateway exclusively via their public HTTP/WebSocket APIs. This means they can be developed, tested, and deployed independently. The gateway writes back into relay and blossom using standard protocols (NIP-01 EVENT, BUD-02 PUT), so any external tool that speaks nostr+blossom can also benefit.

**Major components:**
1. `packages/relay` — NIP-01 WebSocket nostr relay over Bunny DB (libSQL); kind filter: 15128, 35128, 10002, 10063; port from nostr.pub
2. `packages/blossom` — BUD-01/02 blob server over Bunny Storage (REST); nsite-manifest enforcement; port from blssm.us
3. `packages/gateway` — primary router + nsite resolver + progressive cache state machine; banner injection; SPA delivery; most complex component
4. `packages/spa` — Svelte 5 SPA; NIP-07/46 auth; file upload with secret scanning; educational content; static build to Bunny Storage
5. `packages/shared` — shared TypeScript types (manifest kinds, event types, BUD types) tree-shaken into each bundle at build time

**Key patterns:**
- `BunnySDK.net.http.serve()` is the universal edge script entry point; all shared state lives at module scope
- Host-header router in `router.ts` with no framework — `new URL(request.url)` + `request.headers.get("host")`
- Progressive cache as a three-state machine: cold returns loading page + triggers async resolution; warm-stale serves immediately + background check + banner; warm-current serves immediately + background no-op
- Internal cross-script calls go over HTTP to the public pull zone URL — not in-process (impossible); Bunny pull zone edge rules may replace this at a future optimization pass
- StorageClient wraps Bunny Storage REST API; blobs stored at `blobs/{sha256[0:2]}/{sha256}`

### Critical Pitfalls

Ten pitfalls identified; the top five are must-address-before-shipping:

1. **Bundle size creep past 1MB** — Add CI hard-fail at 1MB (warn at 750KB) for all three edge scripts from day one. Use `@libsql/client/web` only. Generate esbuild metafile (`dist/meta.json`) when a bundle grows unexpectedly.

2. **Cross-script communication is HTTP only, not in-process** — Edge scripts run in isolated processes on separate Bunny worker instances. Gateway must call relay and blossom via their public pull zone URLs. This must be resolved in the infrastructure/routing phase before writing any cross-script feature code. Verify whether Bunny's edge fetch supports WebSocket upgrade forwarding.

3. **Progressive caching race condition** — Two concurrent requests for the same cold-cache site both pass the `backgroundUpdateChecks.has()` guard because the Map check and subsequent `set()` can be interleaved by async/await. Fix: set the Map entry with a Promise as a placeholder synchronously before the first `await`. Write a concurrent request test as the acceptance criterion.

4. **npub subdomain parsing fails on named-site subdomains** — `blog.npub1abc.nsite.run` requires a two-step parse: check `parts[0]` for `npub1` prefix (root site), then check `parts[1]` (named site). Naive `parts[0]` extraction fails silently for named sites. Unit test all four cases before wiring to the relay.

5. **Blossom batch `x` tag auth** — nsyte and other batch clients include multiple `x` tags in a single auth event. Check with `Array.some()`, not `xTags[0]`. Write the multi-`x`-tag test before declaring BUD-02 compliance.

Additional pitfalls requiring phase-specific attention:
- **WebSocket 120s idle timeout**: hard platform limit; document in NIP-11; cannot be worked around
- **libSQL client creation**: must be at module level, not per-request; create once, reuse
- **NIP-42 AUTH timing**: send challenge in both `open` handler and immediately after `upgradeWebSocket()`; use `RELAY_URL` env var, not host header
- **HTML banner injection**: only inject into `text/html` responses; search for last `</body>` (case-insensitive); append as fallback if not found
- **SPA secret scanning false negatives**: scan text files by extension; prioritize dangerous filename patterns over content regex; warn (not block) on regex matches in text content

## Implications for Roadmap

Based on the dependency graph from FEATURES.md, the build order from ARCHITECTURE.md, and the phase-to-pitfall mapping from PITFALLS.md, the following phase structure is recommended. Dependencies are hard: phases 1-3 must be deployed before phase 4 can be integration-tested end-to-end.

### Phase 1: Monorepo and Build Infrastructure

**Rationale:** The bundle size constraint is the single highest-risk platform constraint. A 1MB-exceeded bundle causes silent deploy failures. This infrastructure must be validated before any feature code is written. Setting up the monorepo layout, esbuild build scripts, CI bundle size checks, and shared types package is the prerequisite for all other phases.
**Delivers:** Working monorepo with `packages/relay`, `packages/blossom`, `packages/gateway`, `packages/spa`, `packages/shared`; esbuild build scripts for each edge script; CI pipeline with hard-fail bundle size check; local dev environment; GitHub Actions deploy workflows
**Features addressed:** Monorepo structure (PROJECT.md constraint), bundle size guard (Pitfall 1), shared types (prevents type duplication across all packages)
**Avoids:** Bundle size creep (Pitfall 1), cross-script import confusion (Pitfall 7)
**Research flag:** Standard patterns — Bunny deploy process is well-documented in nostr.pub's build.ts and GitHub Actions workflow. No additional research needed.

### Phase 2: Relay Package

**Rationale:** No dependencies on other packages in this repo. Directly portable from nostr.pub. The relay is required by the gateway (manifest caching) and SPA (manifest publishing). Building it first enables testing in isolation and gives the gateway a real target.
**Delivers:** Working nostr relay at wss://nsite.run; NIP-01 protocol (REQ, EVENT, CLOSE); kind filter 15128/35128/10002/10063; Bunny DB storage via libSQL; NIP-11 info document; NIP-42 auth
**Features addressed:** nsite-only relay, WebSocket endpoint, nsyte CLI compatibility
**Avoids:** libSQL per-request client creation (Pitfall 6), NIP-42 AUTH timing/double-send (Pitfall 8), WebSocket 120s idle timeout documentation (Pitfall 2)
**Research flag:** Well-documented — nostr.pub is the direct reference. Port, adapt kind filter, test. No additional research needed.

### Phase 3: Blossom Package

**Rationale:** No dependencies on relay. Directly portable from blssm.us. Required by gateway (blob caching) and SPA (blob upload target). Can be built in parallel with Phase 2 if resources allow.
**Delivers:** Working blossom server at https://nsite.run blossom endpoints; BUD-01 (blob get), BUD-02 (blob upload), BUD-04 (mirror), BUD-06 (HEAD upload check); Bunny Storage via REST API; NIP-98/blossom auth validation; nsite-manifest-only enforcement
**Features addressed:** nsite-only blossom, nsyte CLI compatibility
**Avoids:** Batch `x` tag auth failure (Pitfall 9), Bunny Storage PUT returning 201 not 200 (Integration Gotchas), missing expiration tag handling
**Research flag:** Well-documented — blssm.us is the direct reference. Remove payment/cashu logic, add nsite-manifest enforcement. No additional research needed.

### Phase 4: Gateway Routing Layer

**Rationale:** Requires relay and blossom to be deployed (Phases 2-3) so cross-script routing can be tested end-to-end. Start with pure routing only — no nsite resolution logic yet. Validates the cross-script HTTP communication pattern before adding complexity.
**Delivers:** Gateway Edge Script that routes: WebSocket upgrades to relay pull zone; blossom paths to blossom pull zone; npub subdomains to a stub 503; root domain to a stub 200. Validates the entire Bunny pull zone + routing architecture before any nsite logic.
**Features addressed:** Routing layer (foundational for all other features), cross-script communication pattern
**Avoids:** Cross-script communication confusion (Pitfall 7), npub subdomain parsing errors (Pitfall 5)
**Research flag:** Needs research — verify whether Bunny's edge script `fetch()` supports WebSocket upgrade forwarding (required for gateway-to-relay WS proxy). If not, Bunny pull zone edge rules must handle WebSocket routing instead of the gateway script. This is the one open architectural question.

### Phase 5: Gateway nsite Resolver and Progressive Caching

**Rationale:** Most complex phase. Builds on working routing (Phase 4). Implements the full cold/warm-stale/warm-current state machine, manifest resolution from external relays, blob serving, and update banner injection.
**Delivers:** Full nsite serving at npub1xxx.nsite.run and blog.npub1xxx.nsite.run; progressive caching state machine; loading page for cold cache; update banner injection; SHA-256 integrity verification; content-type forwarding; index.html and 404.html fallbacks; brotli/gzip decompression
**Features addressed:** npub subdomain gateway, named site gateway, progressive caching (all three states), update banner, loading page with profile, manifest caching write-back, blob caching write-back
**Avoids:** Progressive caching race condition (Pitfall 3), HTML banner injection failures (Pitfall 4), npub subdomain parsing failures (Pitfall 5)
**Research flag:** No additional research needed — nsyte/src/lib/gateway.ts is the direct blueprint for the state machine and serving logic. Implementation complexity is HIGH but documentation is HIGH.

### Phase 6: SPA Deploy Interface

**Rationale:** Requires blossom (upload target) and relay (manifest publish target) to be deployed. Can be developed against Phases 2-3 before Phase 5 is complete — the SPA's integration points are relay and blossom, not the gateway serving logic.
**Delivers:** Svelte 5 SPA at nsite.run root; NIP-07 browser extension auth; NIP-46 bunker auth; folder/zip/tar.gz upload with file list preview; SHA-256 computation in browser; secret scanning (filename patterns + text content regex); manifest event signing and relay publication; educational content from nsite.run; ecosystem gateway links
**Features addressed:** SPA deploy UI, NIP-07/46 auth, secret scanning, educational content, file list preview
**Avoids:** SPA secret scanning false negatives on binary files and nested archives (Pitfall 10), NIP-46 bunker flow not tested end-to-end ("Looks Done But Isn't" checklist)
**Research flag:** NIP-46 bunker auth flow is the one uncertain area. The applesauce-signers `NostrConnectSigner` API is documented but the end-to-end flow (bunker:// URL parsing, relay-based signing handshake) should be traced through the applesauce source before implementation begins.

### Phase Ordering Rationale

- Relay and blossom (Phases 2-3) are independent of each other and of the gateway. Port-first strategy from reference implementations minimizes risk.
- The routing layer (Phase 4) must be proven before the nsite resolver (Phase 5) is written, because the resolver depends on cross-script HTTP calls that behave differently in production than in local dev.
- The SPA (Phase 6) can be developed in parallel with Phase 5 against the deployed relay and blossom from Phases 2-3, reducing overall timeline.
- Phase 1 (infrastructure) is non-negotiable as the first phase. The bundle size constraint is a hard platform limit that would cause silent failures if discovered late.

### Research Flags

Phases requiring deeper research during planning:
- **Phase 4 (Gateway Routing):** Verify Bunny edge script `fetch()` WebSocket upgrade forwarding capability. If not supported, Bunny pull zone edge rules must own WebSocket routing. This decision changes the architecture of the gateway script.

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1 (Infrastructure):** esbuild + Bunny deploy pattern is fully documented in nostr.pub
- **Phase 2 (Relay):** nostr.pub is the direct template; port and adapt
- **Phase 3 (Blossom):** blssm.us is the direct template; port and adapt
- **Phase 5 (nsite Resolver):** nsyte/src/lib/gateway.ts is the direct blueprint
- **Phase 6 (SPA):** NIP-07 is trivial; NIP-46 needs one focused research spike on NostrConnectSigner flow, not a full research phase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependency versions verified from live working codebases (nostr.pub, blssm.us, nsyte) |
| Features | HIGH | Feature set derived from nsite NIP spec, PROJECT.md requirements, and nsyte reference implementation |
| Architecture | HIGH | System design derived from direct code inspection of three reference implementations; component boundaries are clear |
| Pitfalls | HIGH | All critical pitfalls are extracted from actual bugs or defensive patterns in working production code, not speculation |

**Overall confidence:** HIGH

### Gaps to Address

- **WebSocket forwarding on Bunny edge fetch:** The architecture depends on the gateway being able to proxy WebSocket upgrades to the relay pull zone. Whether Bunny's edge `fetch()` supports this is not confirmed from the reference implementations (which do not need to proxy WS). Resolve in Phase 4 feasibility testing; fallback is Bunny pull zone edge rules for WebSocket routing.
- **NIP-46 NostrConnectSigner end-to-end flow:** The applesauce-signers package provides `NostrConnectSigner` but the exact bunker:// handshake flow through the applesauce API is not traced in research. Trace before Phase 6 implementation begins.
- **Bunny pull zone edge rules routing feasibility:** PROJECT.md explicitly flags "research pull zone edge rules as potential cheaper routing alternative." This is deferred to a future optimization pass (v2), but if WebSocket forwarding via edge fetch is unsupported (see gap above), pull zone rules become the Phase 4 solution rather than an optimization.
- **nsite-manifest enforcement in blossom:** The blossom should reject blobs not referenced in any nsite manifest. This requires a relay query per upload. The relay query path (internal HTTP to the relay pull zone) must be validated in Phase 3 integration testing.

## Sources

### Primary (HIGH confidence)

- `/home/sandwich/Develop/nostr.pub/` — Bunny Edge Script relay reference; BunnySDK entry point, WebSocket handling, libSQL pattern, bundle size guard, NIP-42 AUTH timing, esbuild config
- `/home/sandwich/Develop/blssm.us/` — Bunny Edge Script blossom reference; StorageClient REST abstraction, BUD auth validation, batch x-tag handling, Bunny Storage response codes
- `/home/sandwich/Develop/nsyte/src/lib/gateway.ts` — Progressive cache state machine, loading page, update banner injection, file serving, SHA-256 verification
- `/home/sandwich/Develop/nsyte/src/commands/run.ts` — Manifest resolution flow (outbox relays → manifest → blossom server list)
- `/home/sandwich/Develop/nsyte/nsite-nip.md` — Authoritative nsite NIP spec; kind 15128/35128 structure, path tags, resolution flow
- `/home/sandwich/Develop/nsite.run/.planning/PROJECT.md` — Project requirements, routing architecture decisions, out-of-scope list
- `https://jsr.io/@luca/esbuild-deno-loader` — version 0.11.1 confirmed on JSR registry

### Secondary (MEDIUM confidence)

- `https://bunny-launcher.net/edge-scripting/bundling/` — Bunny bundle constraints, Deno 1.46.3 runtime version, 1MB limit
- `https://docs.bunny.net/docs/edge-scripting-limits` — CPU 30s, memory 128MB, 50 subrequests (note: script size listed as 10MB in current docs; 1MB bundle limit in nostr.pub build.ts is a conservative self-imposed safety margin)
- `https://docs.bunny.net/docs/cdn-websockets` — WebSocket concurrent connection limits; 120s idle timeout
- `https://github.com/hzrd149/blossom` — BUD-01 through BUD-11 protocol specifications
- `https://applesauce.build/` — applesauce package list, purpose, typedocs for signers
- WebSearch results: @noble/curves@2.0.1, @noble/hashes@2.0.1, @libsql/client@0.17.0, Svelte 5.53.x, @sveltejs/vite-plugin-svelte@6.x current versions

### Tertiary (LOW confidence)

- `https://github.com/hzrd149/nsite.run` — hzrd149's reference gateway implementation; feature list sparse; not inspected directly

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*

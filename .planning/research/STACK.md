# Stack Research

**Domain:** Decentralized static site gateway on Bunny Edge Scripting
**Researched:** 2026-03-13
**Confidence:** HIGH (all recommendations derived from working reference implementations)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Deno | 1.46.3 (Bunny-pinned) | Runtime for all Edge Scripts | Bunny Edge Scripting runs on Deno 1.x; version is fixed by the platform and cannot be selected. All reference projects (nostr.pub, blssm.us) target this runtime. |
| TypeScript | esnext (strict) | Language for all packages | `"strict": true`, `"lib": ["esnext", "dom", "dom.iterable"]` exactly as used in both reference projects. DOM lib required for Web APIs (fetch, WebSocket, URL, etc.) |
| BunnySDK | external (no npm version) | Edge Script HTTP server entrypoint | `BunnySDK.net.http.serve()` is the only way to register a request handler on Bunny Edge Scripting. Marked `external` in esbuild — platform injects it at runtime. |
| esbuild | 0.20.1 (via deno.land/x) | Bundle Deno TypeScript for Bunny upload | Bunny requires a single <1MB ESM bundle. Both reference projects use `esbuild@v0.20.1` from `deno.land/x/esbuild`. |
| @luca/esbuild-deno-loader | 0.11.1 | Deno module resolution for esbuild | Resolves `npm:`, `jsr:`, `https:` specifiers during bundling. Used by both reference projects via `jsr:@luca/esbuild-deno-loader@0.11`. |
| @libsql/client | 0.17.0 | Bunny DB access for relay event storage | Bunny DB is libSQL-compatible; HTTP transport via `@libsql/client/web`. nostr.pub uses this pattern exactly — `createClient({ url, authToken })` with env vars. |
| Svelte | 5.x (latest ~5.53) | SPA frontend | Project constraint. nsite.run currently uses Svelte 4, but Svelte 5 is the current stable with runes-based reactivity. Upgrade from ^4 to ^5 for new SPA code. |
| Vite | 6.x | SPA build tool | Standard Svelte dev/build toolchain; `@sveltejs/vite-plugin-svelte@^5` or `^6` targets Vite 6. nsite.run uses Vite 5 — upgrading is recommended for new work. |
| Tailwind CSS | 3.x | SPA styling | Already in nsite.run (`tailwindcss@^3.4`). Consistent with existing educational content that will be incorporated. |

### Nostr/Crypto Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @noble/curves | 2.0.1 | Schnorr signature verification (secp256k1) | Event validation in relay and auth in blossom. nostr.pub uses 1.8.1; 2.0 is a breaking change. Stay on 1.8.1 for edge scripts for now — upgrade in a separate pass after verifying bundle compatibility. |
| @noble/hashes | 1.6.1 | SHA-256 for event ID computation, blob hashing | Used by both nostr.pub and blssm.us at this version. Pairs with @noble/curves 1.8.1. |
| applesauce-core | ^5.1.0 | EventStore (in-memory), nostr protocol helpers (kinds, filters, relaySet, npubEncode) | Gateway and SPA need relay interaction. nsyte uses this at ^5.1.0. |
| applesauce-relay | ^5.1.0 | RelayPool for connecting to external nostr relays | Gateway needs to fetch manifests and relay lists from the nostr network. nsyte uses this at ^5.1.0. |
| applesauce-loaders | ^5.1.0 | High-level loaders for profiles, relay lists, replaceable events | Gateway cold-cache resolution needs profile + relay list loading. nsyte uses this at ^5.1.0. |
| applesauce-common | ^5.1.0 | Blossom helpers (`getBlossomServersFromList`, `BLOSSOM_SERVER_LIST_KIND`) | Parsing kind 10063 blossom server lists. Used by nsyte for manifest server extraction. |
| applesauce-signers | ^5.1.0 | `ExtensionSigner` (NIP-07) and `NostrConnectSigner` (NIP-46) | SPA deploy flow only — not used in edge scripts. Provides both signer types from one package. |
| @scure/base | ^1.2.6 | npub/bech32 encoding/decoding | Gateway needs to parse npub subdomains. Used by nsyte. |
| rxjs | ^7.8.2 | Observable patterns for relay subscriptions | Required by applesauce-relay and applesauce-core internals. |

### Infrastructure (Bunny)

| Component | API | Purpose | Notes |
|-----------|-----|---------|-------|
| Bunny DB | `@libsql/client/web` HTTP transport | Relay event persistence | Uses env vars `BUNNY_DB_URL` + `BUNNY_DB_TOKEN`. Schema via libSQL/SQLite DDL. |
| Bunny Storage | REST API (fetch) | Blob persistence for blossom | PUT/GET/HEAD/DELETE via `AccessKey` header. No SDK — raw fetch calls as in blssm.us `StorageClient`. |
| Bunny Pull Zones | CDN config | Traffic routing and CDN caching | WebSocket support required for relay. Wildcard subdomain for npub routing. |
| GitHub Actions | CI/CD | Build and deploy edge scripts | Standard pattern from reference repos (build.ts → upload to Bunny via API). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| deno fmt | Code formatting | `indentWidth: 2`, `lineWidth: 100`, `semiColons: true` per nsyte convention |
| deno check | TypeScript type checking | Run as pre-build check: `deno check src/main.ts` |
| deno test | Unit testing | Run with `--allow-all` flag |
| deno bench | Benchmarking | Used in blssm.us for middleware perf measurement |
| pnpm | Node package manager for SPA | nsite.run uses pnpm (evidence: `node_modules/.pnpm`) |

## Installation

The project is a Deno monorepo. Each package has its own `deno.json`. The SPA package is a Node/pnpm project.

```bash
# Edge script packages (relay, blossom, gateway) — per package deno.json
# No install needed; Deno fetches on first run/build

# SPA package setup
cd packages/spa
pnpm install

# SPA dependencies
pnpm add svelte@^5 vite@^6 @sveltejs/vite-plugin-svelte@^5
pnpm add tailwindcss@^3 postcss autoprefixer
pnpm add -D @types/node

# Nostr for SPA
pnpm add applesauce-signers@^5.1 applesauce-core@^5.1 applesauce-relay@^5.1 applesauce-common@^5.1
pnpm add @noble/curves@^1.8 @noble/hashes@^1.6 @scure/base@^1.2 rxjs@^7.8
```

The edge script deno.json imports (example for gateway package):
```json
{
  "imports": {
    "@noble/curves/": "npm:/@noble/curves@1.8.1/",
    "@noble/hashes/": "npm:/@noble/hashes@1.6.1/",
    "@libsql/client": "npm:@libsql/client@^0.17.0",
    "@libsql/client/": "npm:/@libsql/client@0.17.0/",
    "applesauce-core": "npm:applesauce-core@^5.1.0",
    "applesauce-relay": "npm:applesauce-relay@^5.1.0",
    "applesauce-loaders": "npm:applesauce-loaders@^5.1.0",
    "applesauce-common": "npm:applesauce-common@^5.1.0",
    "@scure/base": "npm:@scure/base@^1.2.6"
  },
  "nodeModulesDir": "auto",
  "compilerOptions": {
    "strict": true,
    "lib": ["esnext", "dom", "dom.iterable"],
    "types": ["./types/bunny-sdk.d.ts"]
  }
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| esbuild 0.20.1 (deno.land/x) | esbuild 0.24+ (npm) | If the deno.land/x version becomes incompatible; pin to whatever reference projects use to avoid divergence |
| @luca/esbuild-deno-loader 0.11 | @deno/esbuild-plugin | @deno/esbuild-plugin is newer and official from Deno team, but reference projects haven't migrated; switch when confirmed working with Bunny's Deno 1.46.3 runtime |
| applesauce-* suite | nostr-tools SimplePool | nostr-tools is simpler but lower-level; applesauce provides the relay pool, loaders, and signer infrastructure needed for gateway resolution and SPA auth in one coherent suite already battle-tested in nsyte |
| @noble/curves + @noble/hashes | nostr-tools crypto | noble is the dependency that nostr-tools itself uses internally; cuts out the middleman. Both reference projects use noble directly. |
| Svelte 5 (new SPA) | SvelteKit | SvelteKit adds SSR complexity; nsite.run SPA is purely client-side. Static export mode works but adds unnecessary abstraction. Plain Svelte + Vite SPA is the right fit. |
| Bunny Storage REST API (custom StorageClient) | S3-compatible SDK | Bunny Storage is not S3-compatible. The REST API is simple enough (PUT/GET/DELETE + AccessKey header) that a thin custom class like blssm.us's StorageClient is the right approach. |
| Tailwind CSS 3.x | Tailwind CSS 4.x | Tailwind 4 has a different configuration model; nsite.run is on v3 and migration adds risk with no benefit for this project's scope. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| nostr-tools for relay/crypto in edge scripts | Adds bundle weight; @noble/curves and @noble/hashes are already the underlying implementation; nostr-tools wraps them with additional overhead that risks the 1MB bundle limit | @noble/curves + @noble/hashes directly |
| NDK (Nostr Dev Kit) | Heavy bundle, designed for rich browser clients; would push edge script bundles over 1MB and includes irrelevant storage/crypto abstractions | applesauce-relay + applesauce-loaders for the minimal relay interaction needed |
| Deno.serve() directly in edge scripts | BunnySDK.net.http.serve() is required on Bunny; Deno.serve() only works in local dev | BunnySDK.net.http.serve() with `@bunny.net/edgescript-sdk` marked external |
| WebSocket libraries (ws, socket.io) | Bunny Edge Scripting uses the native Deno WebSocket API via `request.upgradeWebSocket()`; no library needed, as demonstrated in nostr.pub | Native request.upgradeWebSocket() |
| @noble/curves 2.x in edge scripts (for now) | Breaking change from 1.x; reference projects are on 1.8.1; upgrade needs bundle validation first | @noble/curves@1.8.1 |
| SvelteKit adapter-static for SPA | Adds complexity and build step; plain Svelte + Vite with `index.html` fallback is simpler and matches nsite.run's current setup | Vite with `@sveltejs/vite-plugin-svelte` |
| File system access in edge scripts | Bunny Edge Scripting has NO file system access; all dependencies must be bundled | Bundle everything with esbuild; serve static assets from Bunny Storage |

## Stack Patterns by Variant

**For packages/relay (nostr relay on Bunny DB):**
- Copy nostr.pub architecture: `db.ts` with `createClient({ url, authToken })`, `EventStore` class, `router.ts` dispatch
- Only add kinds: 15128, 35128, 10002, 10063 — filter all other kinds at the store level
- Use `@libsql/client/web` (not the default driver; the `/web` subpath is required for HTTP transport in edge environments)

**For packages/blossom (blossom server on Bunny Storage):**
- Copy blssm.us architecture: `StorageClient` raw fetch wrapper, handler-per-route pattern
- Remove payment/cashu logic (out of scope)
- Add nsite-only allowlist: only store blobs referenced in valid nsite manifests

**For packages/gateway (nsite serving with progressive caching):**
- No database of its own — writes manifest events to relay package's DB, writes blobs to blossom package's storage
- Uses applesauce-relay RelayPool to query external relays for manifest resolution
- Uses applesauce-loaders to fetch user relay lists (kind 10002) and blossom server lists (kind 10063)
- Subdomain parsing pattern from nostr.pub's `extractSubdomain()` (split on `.`, check length >= 3 for nsite.run; needs adjustment for `npub1xxx.nsite.run` vs `blog.npub1xxx.nsite.run`)
- Loading page HTML generation inline (string templates), not a templating library — keeps bundle small

**For packages/spa (Svelte deploy interface):**
- Svelte 5 with runes (`$state`, `$derived`, `$effect`) — do not mix Svelte 4 patterns
- applesauce-signers `ExtensionSigner` for NIP-07, `NostrConnectSigner` for NIP-46
- Build output deployed to Bunny Storage; blssm.us's `handleSpa` shows the pattern for serving SPA assets from storage
- File scanning before upload must run entirely in the browser (no server-side processing of user files beyond what's sent to blossom)

**If bundle approaches 750KB:**
- Identify heavy applesauce-* packages with esbuild metafile analysis (`dist/meta.json`)
- Externalize rxjs or applesauce-core to CDN (jsDelivr/esm.sh) as Bunny allows
- Consider splitting gateway into a separate edge script per concern (relay-only script, blossom-only script, gateway script) — already the planned architecture

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @noble/curves@1.8.1 | @noble/hashes@1.6.1 | Verified together in both nostr.pub and blssm.us |
| @libsql/client@0.17.0 | @libsql/client/web@0.17.0 | Must use `/web` subpath for HTTP transport; `nodeModulesDir: auto` required in deno.json |
| esbuild@0.20.1 (deno.land/x) | @luca/esbuild-deno-loader@0.11 | Verified working together in nostr.pub build.ts |
| applesauce-core@^5.1.0 | applesauce-relay@^5.1.0, applesauce-loaders@^5.1.0, applesauce-common@^5.1.0, applesauce-signers@^5.1.0 | All applesauce packages must be the same major.minor; use matching ^5.1.x across all |
| Svelte@^5 | @sveltejs/vite-plugin-svelte@^5 or ^6, Vite@^6 | Plugin version 4 targets Svelte 5 + Vite 5; version 5+ targets Vite 6 |
| rxjs@^7.8.2 | applesauce-core@^5.1.0, applesauce-relay@^5.1.0 | rxjs is a peer dependency of the applesauce suite |

## Sources

- `/home/sandwich/Develop/nostr.pub/deno.json` — relay dependency versions (HIGH confidence: live code)
- `/home/sandwich/Develop/nostr.pub/build.ts` — esbuild 0.20.1 + @luca/esbuild-deno-loader 0.11 (HIGH confidence: live code)
- `/home/sandwich/Develop/nostr.pub/src/db.ts` — @libsql/client/web pattern (HIGH confidence: live code)
- `/home/sandwich/Develop/blssm.us/deno.json` — blossom dependency versions (HIGH confidence: live code)
- `/home/sandwich/Develop/blssm.us/src/storage/client.ts` — Bunny Storage REST API pattern (HIGH confidence: live code)
- `/home/sandwich/Develop/nsyte/deno.json` — applesauce 5.1.x, @scure/base, rxjs versions (HIGH confidence: live code)
- `/home/sandwich/Develop/nsite.run/package.json` — Svelte 4.x, Vite 5, Tailwind 3.x, pnpm (HIGH confidence: live code)
- https://bunny-launcher.net/edge-scripting/bundling/ — Bunny bundle constraints, Deno 1.46.3, 1MB limit (MEDIUM confidence: third-party Bunny docs mirror)
- https://applesauce.build/ — package list and purpose (MEDIUM confidence: official docs, no versions)
- https://applesauce.build/typedoc/modules/applesauce-signers.html — `ExtensionSigner`, `NostrConnectSigner` class names (MEDIUM confidence: official docs)
- https://jsr.io/@luca/esbuild-deno-loader — version 0.11.1 confirmed (HIGH confidence: JSR registry)
- WebSearch: @noble/curves@2.0.1, @noble/hashes@2.0.1 latest (MEDIUM confidence: npm search result snippet)
- WebSearch: @libsql/client@0.17.0 latest (MEDIUM confidence: npm search result snippet)
- WebSearch: Svelte 5.53.x latest, @sveltejs/vite-plugin-svelte@6.x current (MEDIUM confidence: npm search result snippet)

---
*Stack research for: nsite.run on Bunny Edge Scripting*
*Researched: 2026-03-13*

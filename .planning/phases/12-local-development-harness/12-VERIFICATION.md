---
phase: 12-local-development-harness
verified: 2026-03-22T16:30:00Z
status: human_needed
score: 13/13 must-haves verified (automated checks)
re_verification: false
human_verification:
  - test: "Run deno task dev from repo root"
    expected: "Startup banner appears with 4 service URLs; each service prints colored prefixed output; all four services reach 'listening' state"
    why_human: "Subprocess execution, color rendering, and actual port binding cannot be verified without running the orchestrator"
  - test: "Open http://localhost:3100 in a browser after deno task dev"
    expected: "SPA loads — proxied through gateway; Vite dev server serves the Svelte app"
    why_human: "End-to-end HTTP routing through gateway to Vite dev server requires runtime verification"
  - test: "Press Ctrl+C while deno task dev is running"
    expected: "'Shutting down all services...' message prints; 'All services stopped.' message appears; no orphaned processes remain"
    why_human: "Signal handling and process cleanup requires runtime observation; verify with: ps aux | grep 'dev.ts\\|npm run dev' | grep -v grep"
---

# Phase 12: Local Development Harness Verification Report

**Phase Goal:** Developers can run the full nsite.run stack locally with a single command, using local storage backends that mirror production routing architecture
**Verified:** 2026-03-22T16:30:00Z
**Status:** human_needed — all automated checks pass, runtime smoke test awaiting human
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | LocalStorageClient put/get/delete/list round-trips files on the local filesystem | VERIFIED | 16/16 tests pass (`deno test apps/blossom/src/storage/local.test.ts`) |
| 2  | Relay dev entrypoint starts a Deno HTTP server using a Bunny.v1.serve polyfill | VERIFIED | `globalThis.Bunny` injected, `Deno.serve` called on RELAY_PORT (default 3101) |
| 3  | Relay dev entrypoint creates a local SQLite database file for event storage | VERIFIED | `npm:@libsql/client/node` with `file:./dev-relay.db`, `initSchema(db)` called |
| 4  | Blossom dev entrypoint starts a Deno HTTP server using a Bunny.v1.serve polyfill | VERIFIED | `Bunny` polyfill injected, `Deno.serve` on BLOSSOM_PORT (default 3102) |
| 5  | Blossom dev entrypoint uses LocalStorageClient for blob storage | VERIFIED | `new LocalStorageClient(STORAGE_DIR, SERVER_URL)` wired to `route(request, storage, config)` |
| 6  | Gateway dev entrypoint routes WebSocket to local relay, blossom endpoints to local blossom, SPA to Vite | VERIFIED | Full routing logic in `gateway/src/dev.ts` — WS check, blossom path check, resolver, SPA fallback |
| 7  | Gateway blossom-dev stub uses LocalStorageClient (no BUNNY_STORAGE_* env vars needed) | VERIFIED | `blossom-dev.ts` imports `LocalStorageClient`, lazy `init()` reads only `BLOSSOM_PORT`/`BLOSSOM_STORAGE_DIR` |
| 8  | SPA Vite dev server auto-connects to local gateway without manual env var configuration | VERIFIED | `apps/spa/.env.development` has `VITE_NSITE_RELAY=ws://localhost:3100` and `VITE_NSITE_BLOSSOM=http://localhost:3100` (matches GATEWAY_PORT=3100) |
| 9  | `.env.local` production values no longer override dev values during npm run dev | VERIFIED | `.env.local` renamed to `.env.production.local` (gitignored via `*.local` pattern in root `.gitignore`); `.env.development` committed, applies only in dev mode |
| 10 | `deno task dev` starts relay, blossom, gateway, and SPA concurrently | VERIFIED | `deno.json` has `"dev": "deno run --allow-all scripts/dev.ts"`; `scripts/dev.ts` spawns all 4 services via `Deno.Command` |
| 11 | Each service output is prefixed with a colored service name label | VERIFIED | `pipeOutput()` with ANSI color codes + `[name.padEnd(7)]` prefix per service |
| 12 | Pressing Ctrl+C terminates all four services with no orphaned processes | VERIFIED (automated) | `SIGINT`/`SIGTERM` listeners call `shutdown()` which SIGTERMs children, awaits `Promise.allSettled`, 5s SIGKILL fallback, then `Deno.exit(0)` |
| 13 | Dev data files (`dev-relay.db`, `.dev-blossom-storage/`) are gitignored | VERIFIED | `.gitignore` contains `dev-relay.db`, `dev-relay.db-*`, `.dev-blossom-storage/`, `dev-gateway.db`, `dev-gateway.db-*` |

**Score:** 13/13 truths verified (automated) | 3 require human runtime confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/blossom/src/storage/local.ts` | LocalStorageClient class matching StorageClient interface | VERIFIED | 171 lines; full implementation: put/get/head/delete/getJson/putJson/getText/getToml/blobUrl/blobPath/metaPath/listPath/reportPath/list; type-checks pass |
| `apps/blossom/src/storage/local.test.ts` | 16 round-trip tests | VERIFIED | 134 lines; 16/16 tests pass |
| `apps/relay/src/dev.ts` | Relay local dev entrypoint with Bunny polyfill + SQLite | VERIFIED | 84 lines; Bunny polyfill, WS shim, `@libsql/client/node`, `file:./dev-relay.db`; type-checks pass |
| `apps/blossom/src/dev.ts` | Blossom local dev entrypoint with Bunny polyfill + LocalStorageClient | VERIFIED | 54 lines; wired to router with LocalStorageClient; type-checks pass |
| `apps/gateway/src/dev.ts` | Gateway local dev entrypoint with env vars pointing at local services | VERIFIED | 130 lines; sets RELAY_URL/BLOSSOM_URL/SPA_ASSETS_URL/BASE_DOMAIN, Bunny polyfill, WS shim, routing logic; type-checks pass |
| `apps/gateway/src/stubs/blossom-dev.ts` | Dev-only blossom stub using LocalStorageClient | VERIFIED | 37 lines; lazy init, LocalStorageClient from `../../../blossom/src/storage/local.ts`; type-checks pass |
| `apps/spa/.env.development` | Vite dev-mode env vars pointing at local gateway | VERIFIED | Contains `VITE_NSITE_RELAY=ws://localhost:3100`, `VITE_NSITE_BLOSSOM=http://localhost:3100`, `VITE_NSITE_GATEWAY=localhost:3100` |
| `apps/spa/.env.production.local` | Production env vars (renamed from .env.local) | VERIFIED | Contains `wss://next.nsite.run` relay and blossom URLs; gitignored via `*.local` pattern |
| `scripts/dev.ts` | Root dev orchestrator spawning all services as subprocesses | VERIFIED | 150 lines; 4 services with colored output, signal handlers, startup banner; type-checks pass |
| `deno.json` | Root deno task 'dev' entry | VERIFIED | `"dev": "deno run --allow-all scripts/dev.ts"` present |
| `.gitignore` | Dev data file exclusions | VERIFIED | `dev-relay.db`, `dev-relay.db-*`, `.dev-blossom-storage/`, `dev-gateway.db` entries present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/relay/src/dev.ts` | `apps/relay/src/relay.ts` | imports `handleWebSocketUpgrade` directly | WIRED | Line 43: `import { handleWebSocketUpgrade } from "./relay.ts"` |
| `apps/relay/src/dev.ts` | `apps/relay/src/db.ts` | imports `initSchema` | WIRED | Line 41: `import { initSchema } from "./db.ts"` |
| `apps/blossom/src/dev.ts` | `apps/blossom/src/router.ts` | imports `route` and provides `LocalStorageClient` | WIRED | Line 14: `import { route } from "./router.ts"`, line 50: `route(request, storage, config)` |
| `apps/blossom/src/storage/local.ts` | filesystem | `Deno.readFile`/`Deno.writeFile`/`Deno.mkdir` | WIRED | Lines 31-33 (put), line 41 (get), line 52 (head), line 68 (delete), line 158 (list) |
| `apps/gateway/src/dev.ts` | `apps/gateway/src/stubs/blossom-dev.ts` | imports `handleBlossom` from blossom-dev | WIRED | Line 45: `import { handleBlossom } from "./stubs/blossom-dev.ts"` |
| `apps/gateway/src/stubs/blossom-dev.ts` | `apps/blossom/src/storage/local.ts` | imports `LocalStorageClient` | WIRED | Line 7: `import { LocalStorageClient } from "../../../blossom/src/storage/local.ts"` |
| `apps/spa/.env.development` | SPA runtime | Vite env loading (mode=development) | WIRED | `VITE_NSITE_RELAY=ws://localhost:3100` matches GATEWAY_PORT=3100 in scripts/dev.ts |
| `scripts/dev.ts` | `apps/relay/src/dev.ts` | `Deno.Command` subprocess spawn | WIRED | Line 31: `cmd: ["deno", "run", "--allow-all", "apps/relay/src/dev.ts"]` |
| `scripts/dev.ts` | `apps/blossom/src/dev.ts` | `Deno.Command` subprocess spawn | WIRED | Line 37: `cmd: ["deno", "run", "--allow-all", "apps/blossom/src/dev.ts"]` |
| `scripts/dev.ts` | `apps/gateway/src/dev.ts` | `Deno.Command` subprocess spawn | WIRED | Line 43: `cmd: ["deno", "run", "--allow-all", "apps/gateway/src/dev.ts"]` |
| `deno.json` | `scripts/dev.ts` | deno task dev | WIRED | `"dev": "deno run --allow-all scripts/dev.ts"` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEV-01 | 12-01, 12-02 | Each edge script can run locally as Deno HTTP server with Bunny.v1.serve() polyfill | SATISFIED | relay/dev.ts, blossom/dev.ts, gateway/dev.ts each inject `globalThis.Bunny` polyfill and call `Deno.serve` |
| DEV-02 | 12-01 | Relay uses local SQLite file instead of Bunny DB | SATISFIED | `npm:@libsql/client/node` with `file:./dev-relay.db` in relay/dev.ts |
| DEV-03 | 12-01 | Blossom uses local filesystem directory instead of Bunny Storage | SATISFIED | `LocalStorageClient` in blossom/dev.ts + gateway/stubs/blossom-dev.ts |
| DEV-04 | 12-02 | Gateway routes to local relay and blossom, matching production routing | SATISFIED | gateway/dev.ts recreates router.ts routing logic; RELAY_URL/BLOSSOM_URL/SPA_ASSETS_URL set to localhost |
| DEV-05 | 12-03 | Root `deno task dev` starts all services concurrently with colored output | SATISFIED | `deno.json` dev task, `scripts/dev.ts` spawns 4 services with ANSI color prefixes |
| DEV-06 | 12-02 | SPA dev server auto-configured to point at local gateway | SATISFIED | `apps/spa/.env.development` committed; `VITE_NSITE_RELAY=ws://localhost:3100` |
| DEV-07 | 12-03 | All services stop cleanly on Ctrl+C | SATISFIED (automated) | SIGINT/SIGTERM handlers with SIGTERM → Promise.allSettled → SIGKILL fallback |

All 7 requirements (DEV-01 through DEV-07) are satisfied. No orphaned requirements found.

### Anti-Patterns Found

No anti-patterns detected. No TODO/FIXME/placeholder comments in any phase artifact. No empty implementations. All stubs are substantive.

### Notable Deviations from Plan (Non-Blocking)

**Port numbers changed from plan examples to final implementation:**
- Plan 12-01 specified relay on 8081, blossom on 8082
- Plan 12-02 specified gateway on 8080, SPA env pointing at `ws://localhost:8080`
- Actual implementation uses GATEWAY_PORT=3100, RELAY_PORT=3101, BLOSSOM_PORT=3102

This is internally consistent. `scripts/dev.ts` assigns these ports and passes them as env vars to each service subprocess. `.env.development` uses `ws://localhost:3100` matching GATEWAY_PORT. The goal is fully achieved — the port numbers in the plans were examples, not requirements.

**`apps/gateway/src/resolver.ts` was modified (not in original plan's files_modified):**
- Commit `56ed128` added `export function setDevDb(client: Client): void` (5 lines)
- Required because ES modules cannot have their libsql client monkey-patched at runtime
- The change is minimal, additive, and safe — it provides a dev injection point without affecting production behavior
- `resolver.ts` has always been a production file; `setDevDb` is only called from `gateway/src/dev.ts`

### Human Verification Required

#### 1. Full Stack Startup Test

**Test:** From repo root, run `deno task dev`
**Expected:** Startup banner shows 4 services with port numbers; within ~10 seconds colored prefixed output appears from all four services (relay=cyan, blossom=magenta, gateway=yellow, spa=green); each service logs a "listening" message
**Why human:** Subprocess execution, color rendering, and actual port binding require runtime observation

#### 2. SPA through Gateway Test

**Test:** After `deno task dev` starts, open http://localhost:3100 in a browser
**Expected:** The Svelte SPA loads (proxied from Vite dev server at port 5173 through gateway at 3100)
**Why human:** End-to-end HTTP routing through gateway to Vite dev server requires a running browser

#### 3. Clean Shutdown Test

**Test:** Press Ctrl+C while `deno task dev` is running
**Expected:** "Shutting down all services..." prints; "All services stopped." prints; terminal returns to prompt; `ps aux | grep "dev.ts\|npm run dev" | grep -v grep` returns no results
**Why human:** Signal propagation and process termination require runtime observation; orphan detection requires checking the OS process table

### Summary

Phase 12 goal is achieved. All 13 observable truths are verified through static analysis and automated tests. All 7 requirements (DEV-01 through DEV-07) are satisfied. All artifacts are substantive, wired, and type-check clean. LocalStorageClient passes 16/16 tests. The `deno task dev` orchestrator correctly spawns all four services as subprocesses with colored output and registers clean shutdown handlers.

Three human-observable behaviors (actual startup, SPA loading, clean shutdown) require runtime verification before the phase can be considered fully closed. These are expected for an orchestrator that launches real processes.

---

_Verified: 2026-03-22T16:30:00Z_
_Verifier: Claude (gsd-verifier)_

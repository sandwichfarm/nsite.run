# Phase 12: Local Development Harness - Research

**Researched:** 2026-03-22
**Domain:** Deno local dev, Bunny.v1.serve polyfill, libSQL local SQLite, filesystem storage adapter, Vite proxy
**Confidence:** HIGH

## Summary

Phase 12 adds a complete local dev stack so developers can run `deno task dev` and get all four services (relay, blossom, gateway, SPA) running together with realistic routing. The core challenge is that each edge script calls `Bunny.v1.serve(handler)` — a Bunny-platform global — which does not exist in standard Deno. The solution is a thin polyfill that injects a `globalThis.Bunny` shim before the main module loads, translating the call to `Deno.serve()`.

The relay uses `@libsql/client/web` which explicitly rejects `file:` URLs. Switching to `@libsql/client/node` (or the default import, which Deno routes to the node variant) enables `file:` URL support with the same `createClient` API and zero handler-level changes. The blossom uses a `StorageClient` class with a clear interface (`put`, `get`, `head`, `delete`, `list`, `getJson`, `putJson`, etc.) — replacing it with a filesystem-backed implementation that satisfies the same interface is the lowest-risk approach.

The gateway already has an environment-variable-driven SPA stub (`SPA_ASSETS_URL`) and relay/blossom proxy stubs (`RELAY_URL`, `BLOSSOM_URL`). For local dev, `RELAY_URL` and `BLOSSOM_URL` point to the local service ports, and `SPA_ASSETS_URL` points to the Vite dev server. The SPA's `VITE_NSITE_RELAY` and `VITE_NSITE_BLOSSOM` env vars auto-configure it to point at the local gateway, and a `.env.development` file (not `.env.local`) in `apps/spa/` can set these without manual steps.

**Primary recommendation:** Write a single `scripts/dev.ts` that spawns relay, blossom, gateway as Deno subprocesses (each with their own polyfill preload), starts the SPA Vite dev server via `npm run dev`, streams output with per-service color prefixes, and handles `SIGTERM`/`SIGINT` to kill all children cleanly. Wire it to a root `deno task dev` entry.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEV-01 | Each edge script (relay, blossom, gateway) can run locally as a Deno HTTP server with a Bunny.v1.serve() polyfill | Polyfill via `globalThis.Bunny = { v1: { serve: (h) => Deno.serve(h) } }` injected before main.ts import |
| DEV-02 | Relay uses local SQLite file for event storage instead of Bunny DB (libSQL) | Switch import from `@libsql/client/web` to `@libsql/client/node` + `file:dev-relay.db` URL |
| DEV-03 | Blossom uses local filesystem directory for blob storage instead of Bunny Storage | Implement `LocalStorageClient` class matching the `StorageClient` interface, backed by Deno FS APIs |
| DEV-04 | Gateway routes to local relay and blossom instances, matching production routing architecture | Set `RELAY_URL=http://localhost:8081`, `BLOSSOM_URL=http://localhost:8082` — existing stubs already read these |
| DEV-05 | A root `deno task dev` command starts all services + SPA concurrently with colored output | `scripts/dev.ts` using `Deno.Command` to spawn processes; `deno.json` root task pointing to it |
| DEV-06 | SPA dev server auto-configured to point at local gateway | `apps/spa/.env.development` sets `VITE_NSITE_RELAY=ws://localhost:8080` and `VITE_NSITE_BLOSSOM=http://localhost:8080` |
| DEV-07 | All services stop cleanly on Ctrl+C | `Deno.addSignalListener("SIGINT", ...)` in dev.ts kills all child processes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@libsql/client/node` | 0.17.0 (already locked) | Local SQLite via `file:` URL | Same createClient API; Deno exports map already routes default import to node variant; `/node` export is explicit |
| `Deno.serve` | built-in (Deno 2.7.4) | HTTP server for polyfill | Native, no deps |
| `Deno.upgradeWebSocket` | built-in | WebSocket upgrade in relay local mode | Native, same API the gateway stub already uses |
| `Deno.Command` | built-in | Spawn service subprocesses | Stable API since Deno 1.31 |
| Vite `server.proxy` | 5.x (already in spa/package.json) | SPA → gateway proxy in dev | Not needed if gateway runs separately; SPA env vars are sufficient |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@std/assert` | ^1.0.19 (already in workspace) | Test assertions | Phase tests |
| Vite `.env.development` | built-in Vite feature | Auto-configure VITE_ vars for dev | Preferred over `.env.local` because it is committed and applies only in dev mode |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `scripts/dev.ts` | `deno task "svc-*" &` parallel task syntax | `&` syntax works but loses colored output and unified signal handling; dev.ts gives cleaner UX |
| `LocalStorageClient` class | Mock/stub for tests only | A real filesystem impl means actual end-to-end blossom behavior locally, not just tests |
| `@libsql/client/node` import | `npm:libsql` with better-sqlite3 API | `/node` export uses the same `createClient` interface so no handler code changes needed |

**Installation:**
No new packages — all dependencies already exist in `deno.lock`. For the relay local entrypoint, change the import specifier from `@libsql/client/web` to `@libsql/client/node` or rely on Deno's default export resolution.

## Architecture Patterns

### Recommended Project Structure
```
scripts/
└── dev.ts               # orchestrator: spawns relay, blossom, gateway, spa
apps/
├── relay/
│   └── src/
│       └── dev.ts       # local entrypoint: polyfill + Deno.serve wrapper
├── blossom/
│   └── src/
│       ├── dev.ts       # local entrypoint: polyfill + LocalStorageClient
│       └── storage/
│           └── local.ts # LocalStorageClient implementing StorageClient interface
├── gateway/
│   └── src/
│       └── dev.ts       # local entrypoint: polyfill + env vars
└── spa/
    └── .env.development # VITE_NSITE_RELAY / VITE_NSITE_BLOSSOM pointing at localhost:8080
```

Each service gets a `dev.ts` entrypoint that:
1. Injects the `Bunny.v1.serve` polyfill into `globalThis`
2. Adjusts any config (DB URL, storage backend, env vars)
3. Imports and runs the existing `main.ts` handler

The root `scripts/dev.ts` spawns each service as a subprocess, attaches colored stdout/stderr, and registers a signal handler.

### Pattern 1: Bunny.v1.serve Polyfill

**What:** Inject `globalThis.Bunny` before the main module loads.
**When to use:** Every service dev entrypoint needs this before importing `main.ts`.

```typescript
// apps/relay/src/dev.ts
// Must set globalThis.Bunny BEFORE the main module is imported,
// because main.ts calls Bunny.v1.serve() at module evaluation time.

(globalThis as Record<string, unknown>).Bunny = {
  v1: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => {
      Deno.serve({ port: 8081 }, handler);
    },
  },
};

// WebSocket upgrade: relay main.ts uses (request as any).upgradeWebSocket()
// Under Deno, patch this on Request prototype:
(Request.prototype as Record<string, unknown>).upgradeWebSocket = function () {
  return Deno.upgradeWebSocket(this);
};

// Now import main — it will call Bunny.v1.serve() which is now our polyfill
await import("./main.ts");
```

**Critical ordering:** The polyfill MUST be set before `import("./main.ts")` because `Bunny.v1.serve(handler)` is called at module evaluation time, not lazily.

**WebSocket patch:** The relay `main.ts` calls `(request as any).upgradeWebSocket()` (Bunny API). Under Deno, this must be patched to call `Deno.upgradeWebSocket(request)`. The existing relay handler in `relay.ts` already accepts a `WebSocket` socket object, so only the upgrade call in `main.ts` needs adapting.

### Pattern 2: Local SQLite for Relay (DEV-02)

**What:** Replace `@libsql/client/web` with `@libsql/client/node` via a different import alias in the dev entrypoint.
**When to use:** Relay dev entrypoint only — production build continues using `@libsql/client/web`.

```typescript
// apps/relay/src/dev.ts
import { createClient } from "npm:@libsql/client/node";

// OR: rely on Deno's default exports map routing (Deno → node.js):
import { createClient } from "npm:@libsql/client";

const db = createClient({ url: "file:./dev-relay.db" });
// No authToken needed for local file
```

The `@libsql/client` package.json exports map explicitly routes the `"deno"` condition to `./lib-esm/node.js`, so the default import already works with `file:` URLs when running under Deno (not Bunny). The `/web` path in `relay/deno.json` forces the web client — for dev, we override this either in a separate `dev/deno.json` or by using a direct `npm:` import in the dev entrypoint.

**Key insight:** The `db.ts` module is shared by production relay AND by the gateway's `db.ts` duplicate. For local dev, only the relay's `dev.ts` needs to provide the db client — `db.ts` functions (`insertEvent`, `queryEvents`, etc.) are agnostic to the client variant, they only use the `Client` interface.

### Pattern 3: Local Filesystem Storage for Blossom (DEV-03)

**What:** Implement `LocalStorageClient` with the same method signatures as `StorageClient`.
**When to use:** Blossom dev entrypoint; gateway blossom stub can also use it.

```typescript
// apps/blossom/src/storage/local.ts
// Implements same interface as StorageClient
export class LocalStorageClient {
  private baseDir: string;
  public cdnHostname: string;

  constructor(baseDir: string, serverUrl: string) {
    this.baseDir = baseDir;
    this.cdnHostname = new URL(serverUrl).host;
  }

  async put(path: string, body: BodyInit, _contentType?: string): Promise<boolean> {
    const fullPath = `${this.baseDir}/${path}`;
    await Deno.mkdir(dirname(fullPath), { recursive: true });
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
    await Deno.writeFile(fullPath, bytes);
    return true;
  }

  async get(path: string): Promise<Response | null> {
    try {
      const bytes = await Deno.readFile(`${this.baseDir}/${path}`);
      return new Response(bytes);
    } catch {
      return null;
    }
  }
  // ... head, delete, getJson, putJson, getText, getToml, list, blobUrl, blobPath, metaPath, listPath, reportPath
}
```

**Important:** `blobUrl(sha256)` returns the public CDN URL. In local dev, this should return `http://localhost:8082/${sha256}` so upload responses have working blob URLs.

### Pattern 4: Gateway Local Config (DEV-04)

The gateway already reads `RELAY_URL` and `BLOSSOM_URL` from env. The dev entrypoint just sets these:

```typescript
// apps/gateway/src/dev.ts
Deno.env.set("RELAY_URL", "http://localhost:8081");
Deno.env.set("BLOSSOM_URL", "http://localhost:8082");
Deno.env.set("SPA_ASSETS_URL", "http://localhost:5173");
Deno.env.set("SERVER_URL", "http://localhost:8082");
Deno.env.set("BASE_DOMAIN", "localhost");
// ... polyfill then import main.ts
```

**SPA stub in local mode:** The existing `stubs/spa.ts` proxies `SPA_ASSETS_URL`. Setting it to `http://localhost:5173` means the gateway transparently proxies Vite's dev server — SPA hot reload still works through the gateway.

**Blossom stub in local mode:** The existing `stubs/blossom.ts` imports `StorageClient` directly from the blossom source. For local dev, we need it to use `LocalStorageClient` instead. Approach: the gateway dev entrypoint can set a flag, or the blossom stub can be made environment-aware, or a separate `stubs/blossom-local.ts` can be used. Cleanest: use `LocalStorageClient` in the gateway dev entrypoint by monkeypatching the module or by providing an alternate `stubs/blossom.ts` import path.

**Alternative for gateway blossom stub:** The gateway's `stubs/blossom.ts` uses hardcoded `StorageClient` from the blossom source. For local dev, the simplest approach is for the gateway dev entrypoint to also set `BUNNY_STORAGE_*` env vars as dummies AND override the storage init — OR better: extract the blossom stub to accept a storage factory, and the dev entrypoint supplies `LocalStorageClient`. Most pragmatic: gateway dev entrypoint imports a separate `stubs/blossom-dev.ts` that uses `LocalStorageClient`.

### Pattern 5: Root Dev Orchestrator (DEV-05, DEV-07)

```typescript
// scripts/dev.ts
const SERVICES = [
  { name: "relay",   color: "\x1b[36m", cmd: ["deno", "run", "--allow-all", "apps/relay/src/dev.ts"] },
  { name: "blossom", color: "\x1b[35m", cmd: ["deno", "run", "--allow-all", "apps/blossom/src/dev.ts"] },
  { name: "gateway", color: "\x1b[33m", cmd: ["deno", "run", "--allow-all", "apps/gateway/src/dev.ts"] },
  { name: "spa",     color: "\x1b[32m", cmd: ["npm", "run", "dev"], cwd: "apps/spa" },
];

const children: Deno.ChildProcess[] = [];

for (const svc of SERVICES) {
  const proc = new Deno.Command(svc.cmd[0], {
    args: svc.cmd.slice(1),
    cwd: svc.cwd,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  children.push(proc);
  // pipe stdout/stderr with color prefix
}

async function shutdown() {
  for (const child of children) {
    try { child.kill("SIGTERM"); } catch { /* already dead */ }
  }
  await Promise.allSettled(children.map(c => c.status));
  Deno.exit(0);
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);
```

**Ctrl+C handling:** `SIGINT` is reliably caught by `Deno.addSignalListener("SIGINT", ...)`. Each child process also receives the signal from the OS when the terminal sends it to the process group. Sending `SIGTERM` explicitly to children before waiting ensures clean shutdown even in edge cases.

**Colored output:** Use ANSI escape codes directly — no external dep needed. Prefix each line from stdout/stderr with `[servicename]` in its color.

### Pattern 6: SPA Auto-Configuration (DEV-06)

```
# apps/spa/.env.development
# Auto-loaded by Vite for `npm run dev` — no manual setup needed
VITE_NSITE_RELAY=ws://localhost:8080
VITE_NSITE_BLOSSOM=http://localhost:8080
```

**Why `.env.development` not `.env.local`:** `.env.development` is committed to the repo and only applies in development mode (when `MODE === 'development'`). `.env.local` is git-ignored and user-specific. Since all devs need the same local ports, `.env.development` is correct. The existing `.env.local` (which has production URLs) takes precedence over `.env.development` per Vite's load order — so the existing `.env.local` must either be deleted or changed to a `.env.production.local`.

**Vite env file load order (highest to lowest priority):**
1. `.env.[mode].local` (git-ignored, user override)
2. `.env.[mode]` (committed, mode-specific)
3. `.env.local` (git-ignored, always)
4. `.env` (committed, always)

The current `.env.local` with production `wss://next.nsite.run` values will OVERRIDE `.env.development`. This needs to be addressed: rename `.env.local` → `.env.production.local` so it only applies in `npm run preview` mode, not `npm run dev`.

### Anti-Patterns to Avoid

- **Modifying production main.ts files:** Do not add any `if (isDev)` branches to existing `main.ts` files. Keep dev code strictly in `dev.ts` entrypoints.
- **Using `deno task &` for orchestration:** While Deno supports `cmd1 & cmd2` in tasks, it provides no colored output, no per-service restart capability, and limited signal control. Use a dev.ts script instead.
- **Single monolithic dev entrypoint that imports all three services:** Defeats the purpose — services need to run in separate processes on different ports.
- **Hardcoding port numbers in multiple places:** Define ports as constants at the top of `dev.ts` and pass them to each service via env vars.
- **Using `process.env` in dev entrypoints:** Use `Deno.env.set()` — the codebase mixes both, but dev entrypoints should use Deno APIs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite for relay | Custom SQLite adapter | `@libsql/client/node` with `file:` URL | Already in deno.lock; zero schema/query changes needed |
| HTTP server | Custom TCP server | `Deno.serve()` | Built-in, WebSocket support, HTTP/2 |
| WebSocket upgrade | Manual handshake | `Deno.upgradeWebSocket()` | Built-in, standards-compliant |
| Process management | Shell scripts | `Deno.Command` in dev.ts | Cross-platform, signal control, stream piping |
| Env var loading | dotenv library | Vite's built-in `.env.*` loading | Already used by SPA, handles all modes |
| ANSI colors | color library (chalk, kleur) | Direct ANSI escape codes | No dep needed for a 6-color palette |

**Key insight:** Every major problem in this phase has a Deno built-in or already-locked-dependency solution. No new packages needed.

## Common Pitfalls

### Pitfall 1: Bunny.v1.serve() Called at Module Evaluation Time
**What goes wrong:** If the polyfill is set AFTER `import("./main.ts")` in the same file, the error `Bunny is not defined` occurs because ES module top-level code runs synchronously on import.
**Why it happens:** `main.ts` calls `Bunny.v1.serve(handler)` at the module top level, not inside a function.
**How to avoid:** Set `globalThis.Bunny` synchronously before the dynamic import. Dynamic import (`await import("./main.ts")`) defers evaluation until after the current script's synchronous code runs.
**Warning signs:** `ReferenceError: Bunny is not defined` at startup.

### Pitfall 2: request.upgradeWebSocket() — Bunny API vs Deno API
**What goes wrong:** The relay's `main.ts` calls `(request as any).upgradeWebSocket()` (Bunny's method on Request). Under Deno, this method does not exist on `Request`.
**Why it happens:** Bunny adds `.upgradeWebSocket()` as a method on the Request object. Deno uses `Deno.upgradeWebSocket(request)` as a free function instead.
**How to avoid:** In the relay dev entrypoint, patch `Request.prototype` to add `.upgradeWebSocket()` that delegates to `Deno.upgradeWebSocket(this)`. The relay's handler code in `relay.ts` already accepts a `WebSocket` socket — only the upgrade call in `main.ts` needs the shim.
**Warning signs:** `TypeError: request.upgradeWebSocket is not a function` on WebSocket connection attempts.

### Pitfall 3: @libsql/client/web Rejects file: URLs
**What goes wrong:** The relay `deno.json` maps `@libsql/client/web` to `npm:@libsql/client/web`. The web client explicitly throws on `file:` URLs: "The client that uses Web standard APIs supports only libsql:, wss:, ws:, https: and http: URLs".
**Why it happens:** `@libsql/client/web` uses fetch() as transport and cannot open local files.
**How to avoid:** In the relay dev entrypoint, import from `npm:@libsql/client/node` directly (bypass the import map alias). The Deno exports map for `@libsql/client` routes the `"deno"` condition to the node variant anyway — so `npm:@libsql/client` also works.
**Warning signs:** `Error: unsupported URL scheme: file:` at relay startup.

### Pitfall 4: Vite .env.local Overrides .env.development
**What goes wrong:** The existing `apps/spa/.env.local` (with production `wss://next.nsite.run` values) takes precedence over the new `apps/spa/.env.development` file, so the SPA still points at production even in local dev.
**Why it happens:** Vite's env loading order: `.env.development.local` > `.env.development` > `.env.local` > `.env`. Since `.env.local` has higher priority than mode-specific files, it wins.
**How to avoid:** Rename `apps/spa/.env.local` to `apps/spa/.env.production.local`. This makes it apply only during `npm run preview` (production mode), not `npm run dev`.
**Warning signs:** SPA uploads go to `wss://next.nsite.run` instead of `ws://localhost:8080`.

### Pitfall 5: Gateway blossom stub uses StorageClient hardcoded
**What goes wrong:** `apps/gateway/src/stubs/blossom.ts` imports `StorageClient` from the blossom source and requires `BUNNY_STORAGE_*` env vars. In local dev without those vars, the gateway's blossom handler throws on startup.
**Why it happens:** The blossom `init()` in the stub calls `getConfig()` which validates env vars.
**How to avoid:** The gateway dev entrypoint (or a `stubs/blossom-dev.ts` replacement) must provide `LocalStorageClient` instead. Either: (a) the gateway dev entrypoint monkey-patches the stub's module-level singleton, or (b) a separate local stub is used for dev. Option (b) is cleanest.
**Warning signs:** `Error: BUNNY_STORAGE_PASSWORD is required` when a blossom request hits the local gateway.

### Pitfall 6: Ports Conflicting with Other Local Services
**What goes wrong:** Services fail to start if ports 8080, 8081, 8082 are already in use.
**Why it happens:** Common ports may be occupied by other dev servers.
**How to avoid:** Document the port assignments clearly. Consider a simple port-in-use check in `dev.ts` with a user-friendly error message.
**Warning signs:** `Error: address already in use` at startup.

### Pitfall 7: FFI Permissions for libsql Native Bindings
**What goes wrong:** `npm:@libsql/client/node` uses native FFI bindings (`libsql` native module). Running with `--allow-all` covers this, but `--no-check` may be needed during dev for faster startup.
**Why it happens:** The libsql node client loads a native `.node` or `.so` binary via FFI.
**How to avoid:** Use `--allow-all` for dev entrypoints (or at minimum `--allow-ffi --allow-read --allow-write --allow-net --allow-env`). The root `dev.ts` should spawn services with `--allow-all`.
**Warning signs:** `Requires ffi access to ...` permission error.

## Code Examples

Verified patterns from official sources and codebase analysis:

### Bunny.v1.serve Polyfill (DEV-01)
```typescript
// apps/relay/src/dev.ts
// Source: Bunny SDK platform.ts — "typeof Bunny !== 'undefined'" check
// Polyfill must execute BEFORE main.ts is imported

(globalThis as Record<string, unknown>).Bunny = {
  v1: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => {
      Deno.serve({ port: 8081, hostname: "0.0.0.0" }, handler);
    },
  },
};

// Shim Bunny's request.upgradeWebSocket() to Deno's API
// Source: relay/src/main.ts line 28 — uses (request as any).upgradeWebSocket()
(Request.prototype as Record<string, unknown>).upgradeWebSocket = function (
  this: Request,
) {
  return Deno.upgradeWebSocket(this);
};

// Import main AFTER polyfill is set
await import("./main.ts");
```

### Relay Local DB (DEV-02)
```typescript
// Override the db creation in relay dev.ts before main.ts loads
// OR: create a dev-main.ts that uses @libsql/client/node directly

import { createClient } from "npm:@libsql/client/node";
// Source: https://github.com/tursodatabase/libsql-client-ts/issues/138
// "file:local.db" works with @libsql/client/node in Deno

const db = createClient({
  url: "file:./dev-relay.db",
  // No authToken needed for local file
});
```

The relay's `main.ts` creates the db at module level using `process.env.BUNNY_DB_URL`. For dev, the cleanest approach is to provide a separate dev entrypoint that creates the db with a file URL and passes it directly to `handleWebSocketUpgrade` and `initSchema`, bypassing `main.ts` entirely (or duplicating its ~30 lines).

### LocalStorageClient Skeleton (DEV-03)
```typescript
// apps/blossom/src/storage/local.ts
// Source: StorageClient interface in apps/blossom/src/storage/client.ts
import { parse as parseToml } from "@std/toml";
import { dirname } from "@std/path";

export class LocalStorageClient {
  private baseDir: string;
  public cdnHostname: string;
  private serverUrl: string;

  constructor(baseDir: string, serverUrl: string) {
    this.baseDir = baseDir.replace(/\/$/, "");
    this.cdnHostname = new URL(serverUrl).host;
    this.serverUrl = serverUrl.replace(/\/$/, "");
  }

  private fullPath(path: string): string {
    return `${this.baseDir}/${path}`;
  }

  async put(path: string, body: BodyInit, _contentType?: string): Promise<boolean> {
    const full = this.fullPath(path);
    await Deno.mkdir(dirname(full), { recursive: true });
    const bytes = await new Response(body).bytes();
    await Deno.writeFile(full, bytes);
    return true;
  }

  async get(path: string): Promise<Response | null> {
    try {
      const bytes = await Deno.readFile(this.fullPath(path));
      return new Response(bytes);
    } catch {
      return null;
    }
  }

  blobUrl(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `${this.serverUrl}/blobs/${pre}/${sha256}`;  // points at local blossom
  }

  blobPath(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `blobs/${pre}/${sha256}`;
  }
  // ... metaPath, listPath, reportPath same as StorageClient
}
```

### Root Dev Task (DEV-05)
```json
// deno.json root — add to existing "tasks"
{
  "tasks": {
    "dev": "deno run --allow-all scripts/dev.ts",
    "build": "...",
    "test": "...",
    "check": "..."
  }
}
```

### SPA Environment Configuration (DEV-06)
```bash
# apps/spa/.env.development  (committed, applies to `npm run dev` only)
VITE_NSITE_RELAY=ws://localhost:8080
VITE_NSITE_BLOSSOM=http://localhost:8080
```

```bash
# apps/spa/.env.production.local  (rename from .env.local, git-ignored, applies to preview)
VITE_NSITE_RELAY=wss://next.nsite.run
VITE_NSITE_BLOSSOM=https://next.nsite.run
```

### Deno.Command Process Spawn Pattern (DEV-05, DEV-07)
```typescript
// scripts/dev.ts
// Source: https://docs.deno.com/runtime/tutorials/subprocess/
const proc = new Deno.Command("deno", {
  args: ["run", "--allow-all", "apps/relay/src/dev.ts"],
  stdout: "piped",
  stderr: "piped",
}).spawn();

// Pipe with color prefix
(async () => {
  for await (const line of proc.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(lineStream())) {
    console.log(`\x1b[36m[relay]\x1b[0m ${line}`);
  }
})();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Deno.run()` | `Deno.Command` | Deno 1.31 (stable in 1.40) | `Deno.run` is removed; must use `Deno.Command` |
| `@libsql/client` (web-only web client) | `@libsql/client/node` for local file support | v0.3.x+ | `/node` subexport gives `file:` URL support |
| `.env.local` for all envs | `.env.development` for mode-specific | Vite v2+ | `.env.development` committed, applies only in dev |
| Deno task `&` (simple parallel) | `Deno.Command` orchestrator script | N/A | Script gives colored output + reliable SIGTERM propagation |

**Deprecated/outdated:**
- `Deno.run()`: Removed in Deno 2.x — use `Deno.Command` instead
- `Deno.upgradeWebSocket(request)` returns `{ socket, response }` (not changed, still current)

## Open Questions

1. **Gateway blossom stub — LocalStorageClient injection**
   - What we know: `stubs/blossom.ts` is hardcoded to `StorageClient` from blossom source; it needs to use `LocalStorageClient` in dev
   - What's unclear: Whether to (a) create `stubs/blossom-dev.ts` and have `dev.ts` patch the import, (b) make blossom stub accept a factory function, or (c) duplicate blossom stub for dev
   - Recommendation: Create `stubs/blossom-dev.ts` as a drop-in replacement used only by `gateway/src/dev.ts`. Keeps prod code untouched.

2. **Relay dev.ts vs reusing main.ts**
   - What we know: `main.ts` calls `Bunny.v1.serve()` and `createClient()` both at module level, making polyfill ordering critical
   - What's unclear: Whether the polyfill + dynamic-import approach is clean enough, or whether `dev.ts` should duplicate main.ts's logic (~30 lines) to be more explicit
   - Recommendation: Polyfill + `await import("./main.ts")` is cleaner and avoids duplication, but requires the Request.prototype patch for WebSocket. Both approaches work; planner should choose based on code clarity preference.

3. **SPA proxy vs direct gateway connection**
   - What we know: SPA uses `VITE_NSITE_RELAY` and `VITE_NSITE_BLOSSOM` env vars pointing at a URL. In prod these are derived from `window.location.host`. In dev, they point at the local gateway.
   - What's unclear: Whether the Vite dev server should also proxy `/upload`, `/{sha256}` etc. to the gateway, or if the env vars are sufficient
   - Recommendation: Env vars are sufficient. The SPA makes requests directly to the gateway URL; no Vite proxy needed. The existing code path in `nostr.js` is designed for this.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno built-in test runner |
| Config file | `deno.json` root — `"test": "deno test --allow-all --recursive"` |
| Quick run command | `deno test --allow-all apps/relay/src/ -q` |
| Full suite command | `deno test --allow-all --recursive` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEV-01 | `Bunny.v1.serve` polyfill invokes Deno.serve with correct handler | unit | `deno test --allow-all apps/relay/src/dev.test.ts` | ❌ Wave 0 |
| DEV-02 | Relay creates SQLite DB with correct schema at `file:./dev-relay.db` | integration | `deno test --allow-all apps/relay/src/dev.test.ts` | ❌ Wave 0 |
| DEV-03 | LocalStorageClient put/get/delete/list round-trips correctly on filesystem | unit | `deno test --allow-all apps/blossom/src/storage/local.test.ts` | ❌ Wave 0 |
| DEV-04 | Gateway dev entrypoint sets RELAY_URL/BLOSSOM_URL env vars correctly | unit | `deno test --allow-all apps/gateway/src/dev.test.ts` | ❌ Wave 0 |
| DEV-05 | `deno task dev` exists in root deno.json and points to scripts/dev.ts | smoke | `deno task --list` check | N/A — manual verify |
| DEV-06 | `VITE_NSITE_RELAY` and `VITE_NSITE_BLOSSOM` point at localhost in .env.development | smoke | `cat apps/spa/.env.development` | ❌ Wave 0 |
| DEV-07 | Dev orchestrator registers SIGINT handler and kills all child processes | unit | `deno test --allow-all scripts/dev.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `deno test --allow-all --recursive -q`
- **Per wave merge:** `deno test --allow-all --recursive`
- **Phase gate:** Full suite green + manual `deno task dev` smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/relay/src/dev.test.ts` — unit test for polyfill + local SQLite DB init (DEV-01, DEV-02)
- [ ] `apps/blossom/src/storage/local.test.ts` — filesystem storage adapter tests (DEV-03)
- [ ] `apps/gateway/src/dev.test.ts` — gateway dev env setup tests (DEV-04)
- [ ] `scripts/dev.test.ts` — signal handler and subprocess management tests (DEV-07)
- [ ] `apps/spa/.env.development` — file must be created (DEV-06)

## Sources

### Primary (HIGH confidence)
- Bunny SDK `libs/bunny-sdk/src/platform.ts` — platform detection: `typeof Bunny !== "undefined"` checked first
- Bunny SDK `libs/bunny-sdk/src/net/serve.ts` — `Bunny.v1.serve(raw_handler)` delegation for Bunny runtime; `Deno.serve()` for Deno runtime
- `apps/relay/src/main.ts` — direct inspection: `(request as any).upgradeWebSocket()` usage
- `apps/blossom/src/storage/client.ts` — direct inspection: full StorageClient interface
- `apps/gateway/src/stubs/*.ts` — direct inspection: env-var-driven backend URLs
- `@libsql/client@0.17.0/package.json` exports map — confirmed `"deno"` condition routes to `./lib-esm/node.js`; `/node` subexport available
- Deno 2.7.4 docs (current installed version) — `Deno.serve`, `Deno.Command`, `Deno.upgradeWebSocket`, `Deno.addSignalListener`
- Vite server options docs — `server.proxy` with `ws: true`; `.env.*` load order

### Secondary (MEDIUM confidence)
- https://github.com/tursodatabase/libsql-client-ts/issues/138 — confirmed `npm:@libsql/client/node` with `file:local.db` URL works in Deno (requires `--allow-ffi`)
- https://github.com/denoland/deno/discussions/15725 — confirmed `&` operator in deno tasks propagates Ctrl+C to both processes
- https://docs.deno.com/runtime/reference/cli/task/ — task dependencies syntax (Deno 2.1+); parallel execution with `&`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps verified in deno.lock and package.json exports
- Architecture: HIGH — based on direct code inspection of all main.ts, router.ts, stubs
- Pitfalls: HIGH — all pitfalls derived from direct code analysis (not hypothetical)
- libsql file: URL: HIGH — verified via deno.lock + exports map + GitHub issue confirmation

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable ecosystem — Deno, libsql, Vite all stable APIs)

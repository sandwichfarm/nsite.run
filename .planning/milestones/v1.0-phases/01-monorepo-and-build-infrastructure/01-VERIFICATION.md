---
phase: 01-monorepo-and-build-infrastructure
verified: 2026-03-13T14:40:28Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 01: Monorepo and Build Infrastructure Verification Report

**Phase Goal:** Developers can build all components from a clean checkout and CI catches bundle size violations before any code ships
**Verified:** 2026-03-13T14:40:28Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Running the build command produces separate bundles for relay, blossom, and gateway Edge Scripts | VERIFIED | `apps/relay/dist/relay.bundle.js` (379B), `apps/blossom/dist/blossom.bundle.js` (381B), `apps/gateway/dist/gateway.bundle.js` (381B) — all present, valid ESM with inlined ALLOWED_KINDS |
| 2  | CI pipeline hard-fails when any edge script bundle exceeds 1MB and warns at 750KB | VERIFIED | `scripts/check-bundle-sizes.ts` imports `BUNDLE_SIZE_LIMIT`/`BUNDLE_SIZE_WARN` from `@nsite/shared/constants`, calls `Deno.exit(1)` on fail; `.github/workflows/ci.yml` runs it in `build-and-size-check` job on every push |
| 3  | Shared types from `packages/shared` are importable in relay, blossom, and gateway packages with no duplication | VERIFIED | All three `apps/*/src/main.ts` import `ALLOWED_KINDS` from `@nsite/shared/constants`; bundles inline the constant (not imported as external module) confirming workspace resolution; `deno check` passes all entry points |
| 4  | A clean checkout produces working builds without manual configuration steps | VERIFIED | `deno task build` is a single command that produces all 3 bundles; no manual steps required beyond having Deno installed; `scripts/check-bundle-sizes.ts` exits 0 with all OK |

**Score:** 4/4 success criteria verified

### Plan-Level Truths (from PLAN must_haves)

**Plan 01 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `deno check` from workspace root type-checks all entry points without errors | VERIFIED | `deno check apps/relay/src/main.ts apps/blossom/src/main.ts apps/gateway/src/main.ts packages/shared/src/mod.ts` — all 4 pass with zero errors |
| 2 | Importing `@nsite/shared` and `@nsite/shared/types` from any app resolves correctly | VERIFIED | All 3 app stubs import from `@nsite/shared/constants`; type check passes; bundle output contains inlined constant values |
| 3 | Running `deno test` from workspace root discovers and passes shared package tests | VERIFIED | 14/14 tests pass (3 sha256 + 11 validation) — confirmed by direct test run |
| 4 | Each app stub entry point exports a valid BunnySDK.net.http.serve handler shape | VERIFIED | All 3 stubs export `default { fetch(_request: Request): Response { ... } }` — correct Bunny Edge Script shape |

**Plan 02 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `deno task build` from workspace root produces 3 separate bundle files | VERIFIED | All 3 bundle files exist, last modified 2026-03-13T15:25 |
| 2 | Each bundle file is a single ESM JavaScript file under 1MB | VERIFIED | relay: 379B, blossom: 381B, gateway: 381B — all well under 1MB; files begin with valid JS (Bunny polyfill banner + minified code) |
| 3 | Running `deno run --allow-read scripts/check-bundle-sizes.ts` reports sizes and exits 0 when all bundles are under limits | VERIFIED | Script outputs "OK: relay is 0.4KB", "OK: blossom is 0.4KB", "OK: gateway is 0.4KB", exits 0 |
| 4 | The bundle size check script would exit 1 if any bundle exceeded 1MB | VERIFIED | `scripts/check-bundle-sizes.ts` line 42: `if (failed) Deno.exit(1)` — triggered when `size > BUNDLE_SIZE_LIMIT` |

**Plan 03 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pushing to any branch triggers CI that runs fmt check, lint, type check, test, build, and bundle size check | VERIFIED | `.github/workflows/ci.yml` triggers on `on: push` (no branch filter) + `on: pull_request`; `validate` job runs fmt/lint/check/test; `build-and-size-check` runs build + size enforcement |
| 2 | Opening a PR triggers CI and posts a bundle size comparison comment showing absolute sizes and delta from base branch | VERIFIED | `bundle-delta` job has `if: github.event_name == 'pull_request'`; builds base and PR branches; posts markdown table via `actions/github-script@v7` with upsert pattern |
| 3 | Merging to main triggers deploy workflow that builds and deploys all three edge scripts to Bunny | VERIFIED | `.github/workflows/deploy.yml` triggers on `push: branches: [main]`; builds, runs size check, then deploys all 3 via `BunnyWay/actions/deploy-script@main` |
| 4 | CI hard-fails if any bundle exceeds 1MB | VERIFIED | `build-and-size-check` job runs `deno run --allow-read scripts/check-bundle-sizes.ts` which exits 1 on failure, failing the CI job |

**Combined score:** 11/11 plan truths verified (4 roadmap + 4 plan01 + 4 plan02 - 1 overlap on build/size + 4 plan03)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `deno.json` | Workspace root with all members, tasks, fmt/lint config | VERIFIED | Contains `"workspace"` array with 4 members; `build`, `test`, `check` tasks; fmt/lint with `.planning/` excluded |
| `packages/shared/deno.json` | Shared package declaration with name and exports | VERIFIED | `"name": "@nsite/shared"`, 5 export paths (`.`, `./types`, `./sha256`, `./validation`, `./constants`) |
| `packages/shared/src/types.ts` | Nostr event types, blossom types, shared interfaces | VERIFIED | Exports `NostrEvent`, `NostrFilter`, `NsiteKind` (const object), `ValidationResult` |
| `packages/shared/src/sha256.ts` | SHA-256 hashing utilities | VERIFIED | Exports `sha256Hex(data: Uint8Array): Promise<string>` using `crypto.subtle.digest` |
| `packages/shared/src/validation.ts` | Event validation utilities | VERIFIED | Exports `isAllowedKind`, `validateEventKind`; imports from `./constants.ts` and `./types.ts` |
| `packages/shared/src/constants.ts` | Shared constants | VERIFIED | Exports `ALLOWED_KINDS = [15128, 35128, 10002, 10063]`, `BUNDLE_SIZE_LIMIT = 1_000_000`, `BUNDLE_SIZE_WARN = 750_000` |
| `packages/shared/src/mod.ts` | Barrel export re-exporting all submodules | VERIFIED | Re-exports `*` from all 4 submodules |
| `apps/relay/src/main.ts` | Relay edge script stub entry point | VERIFIED | Imports `ALLOWED_KINDS` from `@nsite/shared/constants`; exports `default { fetch(): Response }` |
| `apps/blossom/src/main.ts` | Blossom edge script stub entry point | VERIFIED | Same pattern as relay, `service: "nsite-blossom"` |
| `apps/gateway/src/main.ts` | Gateway edge script stub entry point | VERIFIED | Same pattern as relay, `service: "nsite.run"` |
| `apps/relay/build.ts` | esbuild script producing relay.bundle.js | VERIFIED | Uses `denoPlugins`, absolute `configPath` via `import.meta.url`, `esbuild.stop()` called, `entryPoints: ["./src/main.ts"]`, `outfile: "./dist/relay.bundle.js"` |
| `apps/blossom/build.ts` | esbuild script producing blossom.bundle.js | VERIFIED | Same pattern, `outfile: "./dist/blossom.bundle.js"` |
| `apps/gateway/build.ts` | esbuild script producing gateway.bundle.js | VERIFIED | Same pattern, `outfile: "./dist/gateway.bundle.js"` |
| `apps/relay/dist/relay.bundle.js` | Built relay edge script bundle | VERIFIED | 379B, valid ESM, Bunny polyfill banner, `ALLOWED_KINDS` inlined |
| `apps/blossom/dist/blossom.bundle.js` | Built blossom edge script bundle | VERIFIED | 381B, valid ESM |
| `apps/gateway/dist/gateway.bundle.js` | Built gateway edge script bundle | VERIFIED | 381B, valid ESM |
| `scripts/check-bundle-sizes.ts` | CI bundle size enforcement (1MB fail, 750KB warn) | VERIFIED | Imports constants from `@nsite/shared/constants`, uses `Deno.stat`, exits 1 on FAIL, JSON summary output |
| `.github/workflows/ci.yml` | CI pipeline: validate, build, size check, PR delta comment | VERIFIED | 3 jobs: `validate`, `build-and-size-check`, `bundle-delta`; contains `deno fmt --check` |
| `.github/workflows/deploy.yml` | Deploy pipeline: build and deploy to Bunny on merge to main | VERIFIED | Contains `BunnyWay/actions/deploy-script@main`, `deploy_key` secrets, `file: apps/*/dist/*.bundle.js` |
| `.gitignore` | Covers dist and env files | VERIFIED | Entries: `dist/`, `node_modules/`, `.env`, `.env.*`, `*.bundle.js` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/relay/src/main.ts` | `@nsite/shared/constants` | workspace bare specifier import | WIRED | `import { ALLOWED_KINDS } from "@nsite/shared/constants"` — resolves and type-checks |
| `deno.json` | all 4 workspace members | `"workspace"` array | WIRED | `"workspace": ["./apps/relay", "./apps/blossom", "./apps/gateway", "./packages/shared"]` |
| `apps/relay/build.ts` | `apps/relay/src/main.ts` | esbuild `entryPoints` | WIRED | `entryPoints: ["./src/main.ts"]` present |
| `apps/relay/build.ts` | `apps/relay/deno.json` | `denoPlugins` configPath | WIRED | `configPath: new URL("./deno.json", import.meta.url).pathname` — absolute path, member-level config |
| `scripts/check-bundle-sizes.ts` | `apps/*/dist/*.bundle.js` | `Deno.stat` file size check | WIRED | `Deno.stat(bundle.path)` called for all 3 paths; confirmed by successful run outputting real sizes |
| `.github/workflows/ci.yml` | `scripts/check-bundle-sizes.ts` | `deno run --allow-read scripts/check-bundle-sizes.ts` | WIRED | Present in `build-and-size-check` job |
| `.github/workflows/deploy.yml` | `apps/*/dist/*.bundle.js` | BunnyWay deploy-script `file` input | WIRED | `file: apps/relay/dist/relay.bundle.js` (and blossom, gateway) in deploy steps |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 01-01, 01-02 | Monorepo build system produces separate bundles for relay, blossom, and gateway Edge Scripts | SATISFIED | `deno task build` produces 3 separate bundle files in respective `dist/` directories; verified by direct file inspection (379B, 381B, 381B) |
| INFRA-02 | 01-02, 01-03 | Each Edge Script bundle stays under 1MB with CI enforcement (750KB soft warn) | SATISFIED | Bundles are 0.4KB (far under limit); `scripts/check-bundle-sizes.ts` enforces limits; CI `build-and-size-check` job runs this check on every push/PR |
| INFRA-03 | 01-01 | Shared types package provides common nostr/blossom types across all packages | SATISFIED | `packages/shared` exports `NostrEvent`, `NostrFilter`, `NsiteKind`, `ValidationResult`, `ALLOWED_KINDS`, `sha256Hex`, `isAllowedKind`, `validateEventKind`; imported by all 3 apps; 14 tests pass |

All 3 phase requirements satisfied. No orphaned requirements found — REQUIREMENTS.md traceability table confirms INFRA-01, INFRA-02, INFRA-03 all map to Phase 1 and are marked Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/relay/src/main.ts` | 8 | `status: "stub"` in response body | Info | Intentional — Phase 01 establishes structure only; stubs are replaced in Phases 2-5 |
| `apps/relay/build.ts` | 33-34 | `console.log(...)` | Info | Appropriate build tool logging, not a stub implementation |

No blocker or warning anti-patterns found. The "stub" response bodies in app entry points are by design — Phase 01's goal is workspace wiring, not feature implementation.

---

### Human Verification Required

**1. Deploy workflow end-to-end**

**Test:** Configure GitHub Secrets (6 secrets: BUNNY_*_SCRIPT_ID and BUNNY_*_DEPLOY_KEY for relay, blossom, gateway), then push a commit to main.
**Expected:** Deploy workflow triggers, builds all 3 bundles, runs size check, successfully deploys all 3 scripts to Bunny Edge Scripting.
**Why human:** Requires Bunny dashboard account, live secrets, and external service integration — cannot be verified programmatically.

**2. PR bundle-delta comment**

**Test:** Open a pull request against main.
**Expected:** `bundle-delta` CI job posts a comment with a markdown table showing Base/PR/Delta/Status columns and the `<!-- bundle-size-report -->` marker. A second push to the same PR should update the existing comment rather than creating a new one.
**Why human:** Requires a live GitHub repository with Actions enabled.

---

### Gaps Summary

No gaps. All automated checks pass:
- `deno fmt --check` — 21 files checked, 0 issues
- `deno lint` — 14 files checked, 0 issues
- `deno check` — all 4 entry points type-check cleanly
- `deno test --allow-all` — 14/14 tests pass
- `scripts/check-bundle-sizes.ts` — all 3 bundles OK (0.4KB each), exits 0
- All artifact files exist and are substantive (no empty/placeholder implementations)
- All key links wired (imports resolve, esbuild entryPoints correct, CI steps present)
- All 3 requirement IDs (INFRA-01, INFRA-02, INFRA-03) satisfied with evidence

---

_Verified: 2026-03-13T14:40:28Z_
_Verifier: Claude (gsd-verifier)_

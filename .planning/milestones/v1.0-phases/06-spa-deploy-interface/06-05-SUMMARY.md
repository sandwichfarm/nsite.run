---
phase: 06-spa-deploy-interface
plan: 05
subsystem: gateway, ci
tags: [gateway, bunny-cdn, spa-serving, ci-cd, deploy]

# Dependency graph
requires: ["06-04"]
provides:
  - "apps/gateway/src/stubs/spa.ts — Real SPA handler: proxies to Bunny CDN Storage with SPA fallback"
  - "apps/gateway/src/router.ts — handleSpa import (replaces handleSpaStub)"
  - ".github/workflows/ci.yml — SPA build step in CI"
  - ".github/workflows/deploy.yml — SPA build + deploy to Bunny Storage"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bunny CDN proxy: SPA_ASSETS_URL env var for CDN base URL"
    - "SPA fallback at gateway level: 404 from CDN serves index.html for client-side routing"
    - "Cache-Control split: no-cache for HTML, public max-age=3600 for assets"
    - "Graceful degradation: fallback HTML when SPA_ASSETS_URL not set"
    - "Bunny Storage deploy via curl PUT with AccessKey auth"

key-files:
  modified:
    - "apps/gateway/src/stubs/spa.ts"
    - "apps/gateway/src/router.ts"
    - ".github/workflows/ci.yml"
    - ".github/workflows/deploy.yml"

key-decisions:
  - "SPA served via Bunny CDN proxy — avoids inlining SPA into gateway bundle (stays under 1MB Edge Script limit)"
  - "SPA_ASSETS_URL env var for CDN base URL — simple, no extra Bunny credentials needed at runtime"
  - "curl PUT deploy approach — universal, no Bunny CLI dependency"
  - "Security headers (X-Content-Type-Options, X-Frame-Options) applied to all SPA responses"

requirements-completed: [SPA-01]

# Metrics
completed: 2026-03-18
---

# Phase 6 Plan 05: SPA Gateway Integration Summary

**Gateway serves real SPA from Bunny CDN, CI/CD builds and deploys SPA dist — final integration complete**

## Accomplishments

- `apps/gateway/src/stubs/spa.ts`: replaced stub with real `handleSpa` — proxies to Bunny CDN Storage via `SPA_ASSETS_URL`, normalizes `/` to `/index.html`, SPA client-side routing fallback (404 → index.html), cache-control split (no-cache for HTML, 1h for assets), security headers, graceful "not yet deployed" fallback when env var unset
- `apps/gateway/src/router.ts`: updated import from `handleSpaStub` to `handleSpa`
- `.github/workflows/ci.yml`: added SPA build step (`cd apps/spa && npm ci && npm run build`)
- `.github/workflows/deploy.yml`: added SPA build + deploy steps — uploads `apps/spa/dist/` to Bunny Storage via curl PUT with AccessKey auth

## Files Modified

- `apps/gateway/src/stubs/spa.ts` — Real CDN proxy handler (102 lines)
- `apps/gateway/src/router.ts` — Import rename
- `.github/workflows/ci.yml` — SPA build step
- `.github/workflows/deploy.yml` — SPA build + Bunny Storage deploy

## Deviations from Plan

None — implementation matches plan specification exactly.

## Issues Encountered

None.

---
*Phase: 06-spa-deploy-interface*
*Completed: 2026-03-18*

## Self-Check: PASSED

---
phase: 05-nsite-resolver-and-progressive-caching
plan: 01
subsystem: gateway
tags: [deno, esbuild, content-type, security-headers, html-templates, tdd]

# Dependency graph
requires:
  - phase: 04-gateway-routing-layer
    provides: "router.ts dispatch structure, SitePointer type, gateway build.ts"
provides:
  - "detectContentType() — path extension to MIME type lookup (25+ types)"
  - "resolveIndexPath() — directory path to index.html resolution"
  - "detectCompression() — .br/.gz suffix detection with encoding info"
  - "securityHeaders() — 5 security headers for all gateway responses"
  - "renderLoadingPage() — cold-cache loading page with profile placeholders"
  - "renderNotFoundPage() — friendly 404 when no manifest exists"
  - "renderDefault404() — path-not-in-manifest 404 page"
  - "BANNER_HTML — fixed-position dismissible update notification banner"
  - "injectBanner() — inject banner before </body> or append fallback"
  - "escapeHtml() — XSS-safe string escaping for profile data"
  - "templates/loading.html — static HTML template file with polling JS"
  - "build.ts .html:text loader — esbuild inlines HTML files as string constants"
affects:
  - 05-02-resolver
  - 05-03-cache-state-machine

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static HTML template file with placeholder replacement (not inline TypeScript string)"
    - "Deno.readTextFileSync + import.meta.url for adjacent file loading (works in tests and esbuild)"
    - "esbuild loader: { '.html': 'text' } for bundling HTML templates as string constants"
    - "TDD: RED (failing tests) -> GREEN (minimal impl) cycle for all utility modules"

key-files:
  created:
    - apps/gateway/src/content-type.ts
    - apps/gateway/src/content-type.test.ts
    - apps/gateway/src/security-headers.ts
    - apps/gateway/src/security-headers.test.ts
    - apps/gateway/src/pages.ts
    - apps/gateway/src/pages.test.ts
    - apps/gateway/src/templates/loading.html
  modified:
    - apps/gateway/build.ts

key-decisions:
  - "Deno.readTextFileSync + import.meta.url used instead of import with { type: 'text' } — the latter requires --unstable-raw-imports flag in Deno 2.x and is unsuitable for production tests"
  - "X-Frame-Options: SAMEORIGIN (not DENY) — DENY breaks sites embedded as iframes in their own subdomains"
  - "injectBanner uses lastIndexOf('</body>') (case-sensitive) per HTML5 spec lowercase requirement"
  - "BANNER_HTML uses &#x2715; (multiplication X) for dismiss button — avoids emoji encoding issues"

patterns-established:
  - "TDD with deno test: write failing tests first, implement minimal code to pass"
  - "HTML templates as static .html files + esbuild text loader — source is editable HTML, runtime is bundled string"
  - "loadTemplate() with Deno.readTextFileSync at module init — single read, not per-request"

requirements-completed: [GATE-08, GATE-09, GATE-10, GATE-11, GATE-12, CACHE-02, CACHE-03]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 05 Plan 01: Pure Utility Modules and HTML Templates Summary

**MIME type lookup, directory/compression path utils, security headers, loading/404 pages with JS polling template, and esbuild HTML text loader — pure functions, 44 tests, zero external deps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T22:59:53Z
- **Completed:** 2026-03-13T23:02:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Full content-type detection module with 25+ MIME types, directory path resolution, and compression detection
- Security headers helper with all 5 required headers (HSTS, CSP with unsafe-inline, SAMEORIGIN, nosniff, Referrer-Policy)
- Static loading.html template with {{DISPLAY_NAME}}, {{AVATAR_URL}}, {{CACHE_KEY}} placeholders and 2-second JS polling for cache readiness
- HTML page generators for loading state, nsite-not-found (with nsite.run link), and path-not-found cases
- Fixed-position dismissible update banner with inline CSS/JS
- esbuild loader configuration for .html files as inlined text strings at bundle time
- 44 tests passing across 3 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Content-type, path resolution, and compression utilities** - `f604439` (feat)
2. **Task 2: Security headers, HTML pages, loading template, banner injection, and esbuild loader** - `1f350c7` (feat)

## Files Created/Modified

- `apps/gateway/src/content-type.ts` — detectContentType, resolveIndexPath, detectCompression exports
- `apps/gateway/src/content-type.test.ts` — 23 tests covering all behaviors
- `apps/gateway/src/security-headers.ts` — securityHeaders() returning 5 header record
- `apps/gateway/src/security-headers.test.ts` — 8 tests for all headers and CSP
- `apps/gateway/src/pages.ts` — renderLoadingPage, renderNotFoundPage, renderDefault404, BANNER_HTML, injectBanner, escapeHtml
- `apps/gateway/src/pages.test.ts` — 13 tests covering all page generators and banner injection
- `apps/gateway/src/templates/loading.html` — static HTML template file with placeholder tokens and JS polling
- `apps/gateway/build.ts` — added `loader: { ".html": "text" }` to esbuild config

## Decisions Made

- Used `Deno.readTextFileSync` + `import.meta.url` instead of `import ... with { type: "text" }` because the latter requires `--unstable-raw-imports` in Deno 2.x and is not suitable for `deno test`. esbuild's `.html: text` loader handles bundling at build time.
- BANNER_HTML uses HTML entity `&#x2715;` for dismiss X button rather than emoji to avoid encoding issues.
- Loading page template uses `{{AVATAR_SECTION}}` placeholder for conditional avatar/placeholder rendering rather than trying to handle it in the template logic.

## Deviations from Plan

None — plan executed exactly as written. The Deno import assertion approach was the documented fallback path and worked as specified in the plan's action notes.

## Issues Encountered

- `import ... with { type: "text" }` requires `--unstable-raw-imports` flag in Deno 2.7.4. Plan anticipated this and provided the `Deno.readTextFileSync` fallback, which was used.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All utility modules exported and tested — Plan 03 (resolver) can import them directly
- Function signatures are locked: `detectContentType(path)`, `resolveIndexPath(pathname)`, `detectCompression(path)`, `securityHeaders()`, `renderLoadingPage(opts)`, `renderNotFoundPage()`, `renderDefault404()`, `BANNER_HTML`, `injectBanner(html)`
- The `/_nsite/ready?k=` polling endpoint expected by loading.html must be implemented in the resolver

---
*Phase: 05-nsite-resolver-and-progressive-caching*
*Completed: 2026-03-13*

## Self-Check: PASSED

- FOUND: apps/gateway/src/content-type.ts
- FOUND: apps/gateway/src/security-headers.ts
- FOUND: apps/gateway/src/pages.ts
- FOUND: apps/gateway/src/templates/loading.html
- FOUND: .planning/phases/05-nsite-resolver-and-progressive-caching/05-01-SUMMARY.md
- FOUND commit: f604439 (Task 1)
- FOUND commit: 1f350c7 (Task 2)
- FOUND commit: 61a7ed5 (metadata)

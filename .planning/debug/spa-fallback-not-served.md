---
status: awaiting_human_verify
trigger: "nsite SPA fallback files are not being served"
created: 2026-03-15T00:00:00Z
updated: 2026-03-15T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — serve404() in resolver.ts returns HTTP 404 when serving the site's /404.html as a fallback for missing paths, but SPA sites that map index.html → /404.html expect HTTP 200 for client-side routing to work
test: read code path, confirmed in serve404() function
expecting: fix to serve /404.html content with HTTP 200 when used as fallback
next_action: change serve404() to return status 200 when site has /404.html; update tests

## Symptoms

expected: When a path doesn't exist in the nsite manifest but a fallback is configured, serve the fallback file content with HTTP 200 (standard SPA behavior)
actual: Returns a generic 404 page instead of the fallback content
errors: Generic 404 page returned
reproduction: Visit https://npub1wyuh3scfgzqmxn709a2fzuemps389rxnk7nfgege6s847zze3tuqfl87ez.next.nsite.run/other-stuff
started: Likely never worked — Phase 5 (nsite resolver) just completed 2026-03-14

## Eliminated

- hypothesis: SPA fallback lookup logic is missing entirely
  evidence: serve404() in resolver.ts lines 656-682 correctly looks up /404.html from entry.files and fetches the blob. The lookup works. The status code is wrong.
  timestamp: 2026-03-15T00:01:00Z

## Evidence

- timestamp: 2026-03-15T00:00:00Z
  checked: project structure
  found: gateway app has router.ts, resolver.ts, pages.ts, stubs/spa.ts
  implication: SPA-related code exists; need to trace request path

- timestamp: 2026-03-15T00:01:00Z
  checked: resolver.ts serve404() function (lines 656-682)
  found: serve404() fetches /404.html blob correctly but returns status 404; when /404.html is absent returns renderDefault404() with status 404
  implication: The blob fetch and file lookup work. The bug is the hardcoded status 404 in the response.

- timestamp: 2026-03-15T00:01:00Z
  checked: nsyte deploy.ts (createSiteManifestEvent, fallback file handling)
  found: nsyte --fallback option maps the SPA entry file (e.g. index.html) to /404.html path tag in the manifest. There is no separate "fallback" tag — the convention is /404.html pointing to the SPA shell.
  implication: Gateway must serve /404.html content with HTTP 200 (not 404) when it's acting as a fallback for a missing path, to enable SPA client-side routing.

- timestamp: 2026-03-15T00:01:00Z
  checked: nsite NIP spec (nsite-nip.md)
  found: Spec says "it MUST use /404.html as a fallback path" but does not specify the HTTP status code for this case
  implication: Status code behavior is implementation-defined; HTTP 200 is correct for SPA compatibility

- timestamp: 2026-03-15T00:01:00Z
  checked: reference gateway (nsyte/src/lib/gateway.ts lines 1520-1545)
  found: Reference implementation uses is404 flag → HTTP 404 when serving /404.html as fallback. This is also wrong for SPA use case.
  implication: Our behavior matches the reference, but both are wrong for SPA routing. The fix should serve HTTP 200.

## Resolution

root_cause: serve404() in apps/gateway/src/resolver.ts returns HTTP 404 when serving the site's /404.html content as a fallback for missing paths. SPA sites (deployed with nsyte --fallback index.html) map their app shell to /404.html. When any route not in the manifest is requested, the gateway finds /404.html and serves it with 404 status. Client-side routers require HTTP 200 to activate and handle the route — a 404 response is treated as an error by React Router, SvelteKit, etc.
fix: Changed serve404() in resolver.ts to return HTTP 200 (not 404) when serving the site's own /404.html content. The gateway default 404 (renderDefault404, when no /404.html exists in the manifest) still returns HTTP 404. Added 2 new tests in resolver.test.ts.
verification: 151 gateway tests pass (0 failures). Self-verified: logic change is minimal (one line: status 404 → status 200 in serve404()). Awaiting production test of the test URL.
files_changed:
  - apps/gateway/src/resolver.ts
  - apps/gateway/src/resolver.test.ts

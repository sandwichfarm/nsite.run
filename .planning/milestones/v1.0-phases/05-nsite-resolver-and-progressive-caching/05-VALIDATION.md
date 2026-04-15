---
phase: 5
slug: nsite-resolver-and-progressive-caching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno.test with @std/assert |
| **Config file** | apps/gateway/deno.json |
| **Quick run command** | `deno test apps/gateway/src/` |
| **Full suite command** | `deno test apps/gateway/src/ --allow-net --allow-env --allow-read` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `deno test apps/gateway/src/`
- **After every plan wave:** Run `deno test apps/gateway/src/ --allow-net --allow-env --allow-read`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | GATE-01 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | GATE-02 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | GATE-08 | unit | `deno test apps/gateway/src/content-type.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | GATE-09 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | GATE-11 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 1 | GATE-12 | unit | `deno test apps/gateway/src/security-headers.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | GATE-03 | unit | `deno test apps/gateway/src/nostr-ws.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | GATE-04 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | GATE-05 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | GATE-06 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-05 | 02 | 1 | GATE-07 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-06 | 02 | 1 | GATE-10 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | CACHE-01 | unit | `deno test apps/gateway/src/cache.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | CACHE-02 | integration | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 2 | CACHE-03 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-04 | 03 | 2 | CACHE-04, CACHE-05 | unit | `deno test apps/gateway/src/cache.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-05 | 03 | 2 | CACHE-06 | unit | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-06 | 03 | 2 | CACHE-07 | unit | `deno test apps/gateway/src/cache.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | CACHE-08 | integration | `deno test apps/gateway/src/db.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 2 | CACHE-09 | integration | `deno test apps/gateway/src/resolver.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gateway/src/resolver.test.ts` — stubs for GATE-01 through GATE-12, CACHE-02, CACHE-03, CACHE-06
- [ ] `apps/gateway/src/content-type.test.ts` — stubs for GATE-08
- [ ] `apps/gateway/src/security-headers.test.ts` — stubs for GATE-12
- [ ] `apps/gateway/src/nostr-ws.test.ts` — stubs for GATE-03
- [ ] `apps/gateway/src/cache.test.ts` — stubs for CACHE-01, CACHE-04, CACHE-05, CACHE-07
- [ ] `apps/gateway/src/db.test.ts` — stubs for CACHE-08

*Existing test infrastructure: `hostname.test.ts` and `router.test.ts` already exist from Phase 4.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Loading page shows user avatar and name | CACHE-02 | Requires real nostr relay with kind 0 profile data | Visit cold npub subdomain, verify loading page renders profile |
| Update banner visible and dismissible | CACHE-06 | Visual rendering behavior; banner injection into arbitrary HTML | Visit warm-outdated site, verify banner at top, click X to dismiss |
| Compressed assets decompress in browser | GATE-11 | Requires browser to verify Content-Encoding handling | Serve .br asset, verify browser renders correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

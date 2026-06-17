---
phase: 06
slug: spa-deploy-interface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (standard for Vite + Svelte 4 projects) |
| **Config file** | `apps/spa/vite.config.js` (test section) or `vitest.config.js` |
| **Quick run command** | `cd apps/spa && npm test -- --run` |
| **Full suite command** | `cd apps/spa && npm test -- --run --coverage` |
| **Estimated runtime** | ~5 seconds |

Note: The existing Deno test suite (`deno test --allow-all`) covers server-side packages only. SPA tests run separately via Vitest/npm.

---

## Sampling Rate

- **After every task commit:** Run `cd apps/spa && npm test -- --run`
- **After every plan wave:** Run `cd apps/spa && npm test -- --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SPA-13 | build | `npm run build` exits 0 | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | SPA-07 | unit | `npm test -- scanner.test.js -t "filename"` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | SPA-08 | unit | `npm test -- scanner.test.js -t "content"` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | SPA-06 | unit | `npm test -- files.test.js` | ❌ W0 | ⬜ pending |
| 06-02-04 | 02 | 1 | SPA-05 | unit | `npm test -- files.test.js -t "zip"` | ❌ W0 | ⬜ pending |
| 06-02-05 | 02 | 1 | SPA-05 | unit | `npm test -- files.test.js -t "tar"` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | SPA-09 | unit | `npm test -- publish.test.js` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | SPA-10 | unit | `npm test -- upload.test.js` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 2 | SPA-12 | unit | `npm test -- tools.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/spa/src/lib/__tests__/scanner.test.js` — stubs for SPA-07, SPA-08
- [ ] `apps/spa/src/lib/__tests__/files.test.js` — stubs for SPA-05, SPA-06
- [ ] `apps/spa/src/lib/__tests__/publish.test.js` — stubs for SPA-09
- [ ] `apps/spa/src/lib/__tests__/upload.test.js` — stubs for SPA-10
- [ ] `apps/spa/src/lib/__tests__/tools.test.js` — stubs for SPA-12
- [ ] Vitest install + config — if no framework detected in apps/spa

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gateway serves SPA at root domain | SPA-01 | Requires live Bunny deployment | Navigate to nsite.run, verify SPA loads |
| NIP-07 extension login | SPA-02 | Requires browser extension (Alby/nos2x) | Click login, select Extension, verify pubkey |
| NIP-46 remote signer QR flow | SPA-03 | Requires remote signer app (nsecBunker) | Click login, select Remote Signer, scan QR |
| Folder picker opens | SPA-04 | Requires browser file dialog interaction | Click folder picker, verify directory selection |
| Educational content visible | SPA-11 | Visual content check | Visit nsite.run unauthenticated, verify content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 3
slug: blossom
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno built-in test runner (`Deno.test` + `@std/assert`) |
| **Config file** | none — `deno test` auto-discovers `*.test.ts` |
| **Quick run command** | `deno test --allow-all apps/blossom/src/` |
| **Full suite command** | `deno test --allow-all --recursive` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `deno test --allow-all apps/blossom/src/`
- **After every plan wave:** Run `deno test --allow-all --recursive`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | BLSM-02 | unit | `deno test --allow-all apps/blossom/src/auth/nostr.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | BLSM-01, BLSM-08 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-get.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | BLSM-02, BLSM-05, BLSM-07 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | BLSM-03 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-list.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | BLSM-04 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-delete.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 0 | BLSM-06 | unit | `deno test --allow-all apps/blossom/src/storage/client.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-07 | 01 | 0 | — | unit | `deno test --allow-all apps/blossom/src/handlers/server-info.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/blossom/src/auth/nostr.test.ts` — stubs for BLSM-02, BLSM-04 auth gate
- [ ] `apps/blossom/src/handlers/blob-get.test.ts` — stubs for BLSM-01, BLSM-08
- [ ] `apps/blossom/src/handlers/blob-upload.test.ts` — stubs for BLSM-02, BLSM-05, BLSM-07
- [ ] `apps/blossom/src/handlers/blob-list.test.ts` — stubs for BLSM-03
- [ ] `apps/blossom/src/handlers/blob-delete.test.ts` — stubs for BLSM-04
- [ ] `apps/blossom/src/storage/client.test.ts` — stubs for BLSM-06
- [ ] `apps/blossom/src/handlers/server-info.test.ts` — stubs for server-info response shape

*No test framework install needed: `deno test` is built-in. `@std/assert` is already in root deno.json imports map.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| nsyte CLI can use https://nsite.run as a blossom upload target and successfully upload site blobs | Success Criterion 4 | Cannot automate pre-deploy; requires live deployment + nsyte CLI interaction | Deploy blossom to Bunny Edge, run `nsyte deploy` targeting nsite.run, verify blobs appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

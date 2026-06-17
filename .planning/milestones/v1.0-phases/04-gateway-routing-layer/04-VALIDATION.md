---
phase: 04
slug: gateway-routing-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno.test (built-in) |
| **Config file** | apps/gateway/deno.json |
| **Quick run command** | `deno test apps/gateway/src/ --no-check` |
| **Full suite command** | `deno test apps/gateway/src/ --no-check` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `deno test apps/gateway/src/ --no-check`
- **After every plan wave:** Run `deno test apps/gateway/src/ --no-check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 1 | ROUTE-01..05 | stub | `deno test apps/gateway/src/ --no-check` | ❌ W0 | ⬜ pending |
| 04-01-01 | 01 | 1 | ROUTE-01,02 | unit | `deno test apps/gateway/src/ --no-check` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ROUTE-03,04,05 | unit | `deno test apps/gateway/src/ --no-check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gateway/src/router.test.ts` — stubs for ROUTE-01..05 routing decisions
- [ ] `apps/gateway/src/subdomain.test.ts` — stubs for subdomain parsing (npub, named-site)

*Existing Deno.test infrastructure from relay/blossom covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WebSocket upgrade proxied to relay | ROUTE-01 | Requires live Bunny Edge deployment | Deploy to staging, connect with NIP-01 client |
| Blossom paths handled by blossom script | ROUTE-02 | Requires multi-script Bunny setup | Deploy, upload blob via PUT /upload |
| npub subdomain routing | ROUTE-04 | Requires wildcard DNS + Bunny | Visit npub1xxx.nsite.run, verify 503 stub |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

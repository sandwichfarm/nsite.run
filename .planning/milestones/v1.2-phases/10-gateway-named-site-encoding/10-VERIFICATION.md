---
phase: 10-gateway-named-site-encoding
verified: 2026-03-21T09:15:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 10: Gateway Named Site Encoding Verification Report

**Phase Goal:** The gateway correctly identifies and serves named sites using the new base36 single-subdomain encoding, and stops accepting the deprecated double-wildcard format
**Verified:** 2026-03-21T09:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A request to `<pubkeyB36><dTag>.nsite.run` (51-63 chars, all `[a-z0-9]`) resolves and serves the correct named site content | VERIFIED | `hostname.ts` parses labels 51-63 chars matching `[a-z0-9]`; `resolver.ts` routes to named site pipeline; 15 hostname tests pass |
| 2 | The gateway correctly decodes the first 50 chars of the subdomain label as a base36 pubkey and the remainder as the dTag | VERIFIED | `hostname.ts` slices `label.slice(0, 50)` for pubkeyB36 and `label.slice(50)` for dTag; `base36Decode` converts to 32-byte Uint8Array then hex; 12 base36 tests pass + hostname tests with real vectors |
| 3 | Named site manifest is fetched as kind 35128 using the decoded pubkey and dTag as the `#d` filter | VERIFIED | `resolver.ts` lines 370-375: `kinds: [NsiteKind.NAMED_SITE]` (35128), `authors: [pubkeyHex]`, `"#d": [identifier]`; same pattern at lines 531-535 for background check |
| 4 | Requests to the old `identifier.npub1xxx.nsite.run` format no longer match a named site route | VERIFIED | `hostname.ts` requires `parts.length === 3` for named sites; 4-part hosts fall through to `return null`; test "old double-wildcard format returns null (GATE-15)" passes |

**Score:** 4/4 success criteria verified

### Must-Have Truths (from PLAN frontmatter — Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | base36Encode converts a 32-byte Uint8Array into a zero-padded 50-char lowercase base36 string | VERIFIED | `base36.ts` exports `base36Encode`; `padStart(50, "0")` guarantees fixed length; test "all-zeros" and "exactly 50 chars" pass |
| 2 | base36Decode converts a 50-char lowercase base36 string back into a 32-byte Uint8Array | VERIFIED | `base36.ts` exports `base36Decode`; returns `Uint8Array` of exactly 32 bytes |
| 3 | Roundtrip: base36Decode(base36Encode(bytes)) === bytes for any 32-byte input | VERIFIED | 3 roundtrip tests pass: all-zeros, all-0xff, arbitrary 32-byte pattern |
| 4 | base36Decode returns null for strings that are not exactly 50 chars | VERIFIED | `VALID_RE = /^[a-z0-9]{50}$/` fails for any other length; tests for 49, 51, 100 chars pass |
| 5 | base36Decode returns null for strings containing chars outside [a-z0-9] | VERIFIED | `VALID_RE` rejects uppercase and punctuation; tests for uppercase and `!@#$` chars pass |

### Must-Have Truths (from PLAN frontmatter — Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A request to `<pubkeyB36><dTag>.nsite.run` (51-63 chars, all [a-z0-9]) resolves as a named site with correct pubkey and dTag | VERIFIED | `hostname.ts` implements exactly this logic; 4 named-site tests pass with real base36 vectors |
| 2 | A request to npub1xxx.nsite.run still resolves as a root site | VERIFIED | `label.startsWith("npub1")` branch returns `{ kind: "root", npub: label }` unchanged; 2 root-site tests pass |
| 3 | A request to identifier.npub1xxx.nsite.run (old format) returns null — no longer matches | VERIFIED | `parts.length === 3` guard prevents 4-part hosts from matching; explicit test "old double-wildcard format returns null (GATE-15)" passes |
| 4 | The resolver receives hex pubkey directly for named sites and does not call npubToHex for them | VERIFIED | `resolver.ts` line 137: `pointer.pubkeyHex \|\| npubToHex(pointer.npub)`; named sites set `pubkeyHex` so `npubToHex` is short-circuited |
| 5 | Named site manifest is fetched as kind 35128 with the decoded pubkey and dTag | VERIFIED | `resolver.ts` lines 370-375: `kinds: [NsiteKind.NAMED_SITE]` (35128), `authors: [pubkeyHex]`, `"#d": [identifier]` |

**Combined score: 9/9 truths verified**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/base36.ts` | base36Encode and base36Decode functions | VERIFIED | 59 lines, both functions exported, BigInt implementation |
| `packages/shared/src/base36_test.ts` | Deno tests for base36 codec | VERIFIED | 12 tests, all pass |
| `packages/shared/src/mod.ts` | Re-export of base36 module | VERIFIED | `export * from "./base36.ts"` present on line 5 |
| `packages/shared/deno.json` | Export entry for base36 | VERIFIED | `"./base36": "./src/base36.ts"` in exports map |
| `apps/gateway/src/hostname.ts` | Updated extractNpubAndIdentifier with base36 named site parsing | VERIFIED | 77 lines, exports `extractNpubAndIdentifier` and `SitePointer`, imports `base36Decode` |
| `apps/gateway/src/hostname.test.ts` | Tests for new hostname format | VERIFIED | 15 tests, all pass, includes GATE-15 old-format rejection test |
| `apps/gateway/src/resolver.ts` | Updated resolver using pubkeyHex from named site pointer | VERIFIED | Line 137: `pointer.pubkeyHex \|\| npubToHex(pointer.npub)` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shared/src/mod.ts` | `packages/shared/src/base36.ts` | re-export | WIRED | `export * from "./base36.ts"` at line 5 |
| `packages/shared/deno.json` | `packages/shared/src/base36.ts` | exports map | WIRED | `"./base36": "./src/base36.ts"` present |
| `apps/gateway/src/hostname.ts` | `packages/shared/src/base36.ts` | import base36Decode | WIRED | `import { base36Decode } from "@nsite/shared/base36"` at line 15 |
| `apps/gateway/src/hostname.ts` | `apps/gateway/src/resolver.ts` | SitePointer interface consumed | WIRED | `resolver.ts` imports `type SitePointer from "./hostname.ts"` at line 22; uses `pointer.pubkeyHex` at line 137 |
| `apps/gateway/src/resolver.ts` | `apps/gateway/src/hostname.ts` | import type SitePointer | WIRED | `import type { SitePointer } from "./hostname.ts"` at line 22 |
| `apps/gateway/src/router.ts` | `apps/gateway/src/hostname.ts` | extractNpubAndIdentifier | WIRED | Imported and called at lines 12, 54, 131 |
| `apps/gateway/src/router.ts` | `apps/gateway/src/resolver.ts` | handleResolver | WIRED | Imported and called at lines 15, 133 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GATE-13 | 10-01-PLAN, 10-02-PLAN | Gateway parses named site subdomains using base36 encoding — single label `<pubkeyB36><dTag>` where pubkeyB36 is 50 chars and dTag is 1-13 chars of `[a-z0-9]` | SATISFIED | `hostname.ts` implements the full parsing logic; `base36.ts` implements the codec; 15 passing tests prove it |
| GATE-14 | 10-02-PLAN | Gateway resolves named site manifests by querying kind 35128 with decoded pubkey and `#d` filter for the extracted dTag | SATISFIED | `resolver.ts` lines 370-375 build the exact filter: `kinds: [NsiteKind.NAMED_SITE]`, `authors: [pubkeyHex]`, `"#d": [identifier]` |
| GATE-15 | 10-02-PLAN | Gateway removes old double-wildcard named site format (`identifier.npub1xxx.nsite.run`) — replaced by new single-label encoding | SATISFIED | `parts.length === 3` guard in `hostname.ts` means 4-part hosts return `null`; explicit test with `blog.npub1abc.nsite.run` passes |

All 3 requirements assigned to Phase 10 in REQUIREMENTS.md are SATISFIED. No orphaned requirements.

### Anti-Patterns Found

No anti-patterns found in any of the 5 phase-modified files:
- No TODO/FIXME/HACK/PLACEHOLDER comments
- No stub implementations (all `return null` instances are legitimate guard clauses)
- No empty handlers or placeholder responses
- Old double-wildcard detection code (`parts[1].startsWith("npub1")`) confirmed absent
- Type checking passes with zero errors for `hostname.ts` and `resolver.ts`

### Human Verification Required

**1. End-to-end named site serving**

**Test:** Deploy an nsite with a named manifest (kind 35128, dTag "blog"), compute its base36 subdomain label, visit `<pubkeyB36>blog.nsite.run`
**Expected:** The site content is served, not a 404 or error page
**Why human:** Requires a live gateway with real relay data, real blossom blobs, and a valid Nostr keypair — cannot be verified programmatically

**2. Root site backward compatibility**

**Test:** Visit an existing `npub1xxx.nsite.run` root site after gateway deploy
**Expected:** Root site continues to serve correctly, unchanged
**Why human:** Requires live gateway and live root site data; programmatic tests cover parsing, not end-to-end serving

These are smoke-test items. All logic has been verified programmatically; the human tests confirm no runtime environment issues.

### Gaps Summary

No gaps. All automated checks pass:
- 12/12 base36 tests pass
- 15/15 hostname tests pass (including GATE-15 old-format rejection)
- `resolver.ts` and `hostname.ts` type-check cleanly
- All 3 required requirements (GATE-13, GATE-14, GATE-15) are implemented and verified
- All 5 commits documented in summaries exist in git history

---

_Verified: 2026-03-21T09:15:00Z_
_Verifier: Claude (gsd-verifier)_

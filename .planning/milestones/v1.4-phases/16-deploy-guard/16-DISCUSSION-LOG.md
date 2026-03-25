# Phase 16: Deploy Guard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 16-deploy-guard
**Areas discussed:** Root site guard UX, Named site guard UX, Loading state guard, Update flow routing

---

## Root Site Guard UX

### Guard behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled with info | Root option greyed out, show URL + "Update" button below. | |
| Selectable with warning | Root option selectable, inline warning when selected showing existing site + "Update" button. | ✓ |
| You decide | Claude picks based on SC-1 requirements. | |

**User's choice:** Selectable with warning
**Notes:** None

### Info visibility timing

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Existing site info shown next to root option at all times. | |
| On selection only | Info appears only when user selects root option. | |
| You decide | Claude picks most informative without cluttering. | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Named Site Guard UX

### Check trigger timing

| Option | Description | Selected |
|--------|-------------|----------|
| On input (debounced) | Check as user types with ~300ms debounce. Real-time. | |
| On blur | Check when user leaves dTag field. Less distracting. | |
| You decide | Claude picks balancing responsiveness with flicker. | ✓ |

**User's choice:** You decide
**Notes:** None

### Guard pattern consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Same as root | Inline warning + "Update" button, no blocking. | |
| Different treatment | Warning below input + separate "Update" button (different from radio). | |
| You decide | Claude picks consistent pattern for both guards. | ✓ |

**User's choice:** (Other) User was confused — "Don't we already have this?" Clarified the update flow exists in manage view, but deploy flow lacks guards. User then deferred to Claude.
**Notes:** User pointed out existing update mechanism. Discussion clarified this phase adds guards to the deploy flow's site type selection, not duplicate existing manage functionality.

### Guard aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Warning + Update shortcut | Inline warning, "Update instead" button, user can still deploy fresh. | |
| Soft block + Update only | Replace deploy button with "Update existing" button. No fresh overwrite. | |
| You decide | Claude picks based on requirements (especially "blocking deploy button" being out of scope). | ✓ |

**User's choice:** You decide
**Notes:** Requirements explicitly exclude "blocking deploy button when site exists."

---

## Loading State Guard

### Fetch failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Allow deploy with warning | Show warning but allow deploy if fetch fails. User accepts risk. | |
| Block until retry succeeds | Keep deploy blocked, offer "Retry" button. | |
| You decide | Claude picks balancing safety with usability. | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Update Flow Routing

### Routing mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Same mechanism | Reuse manage view's pattern: set siteType, dTag (read-only), resetForUpdate(). | |
| Navigate to manage first | Click "Update" → navigate to manage → scroll to site → open "Update Site". | |
| You decide | Claude picks simplest approach reusing existing code. | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Claude's Discretion

- Root site info visibility timing
- dTag check trigger timing
- Fetch failure handling
- Update routing mechanism
- Warning styling
- "Update" button placement
- Site metadata display in warnings

## Deferred Ideas

None — discussion stayed within phase scope

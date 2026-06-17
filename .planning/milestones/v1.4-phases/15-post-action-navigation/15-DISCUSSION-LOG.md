# Phase 15: Post-Action Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 15-post-action-navigation
**Areas discussed:** Tab button visibility, Post-deploy next actions, Post-delete next actions, Non-destructive completion

---

## Tab Button Visibility

### Tab hiding behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide completely | Tab buttons removed from DOM during active operations. OperationBanner provides context. | |
| Disabled/greyed out | Tab buttons remain visible but greyed out and non-clickable. User sees where they are. | ✓ |
| You decide | Claude picks based on OperationBanner and tab layout. | |

**User's choice:** Disabled/greyed out
**Notes:** None

### Re-enable trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On completion or error | Tabs re-enable as soon as operation reaches success or error state. | ✓ |
| After user acknowledges | Tabs re-enable only after user interacts with outcome. | |
| You decide | Claude picks based on deploy/delete state machine. | |

**User's choice:** On completion or error
**Notes:** None

---

## Post-Deploy Next Actions

### Navigation options on success screen

| Option | Description | Selected |
|--------|-------------|----------|
| Manage sites only | Single 'Manage sites' button. Existing 'Update' handles redeploy. | |
| Manage + Deploy another | Two buttons: 'Manage sites' and 'Deploy another site'. Both forward paths. | ✓ |
| You decide | Claude picks based on success screen layout. | |

**User's choice:** Manage + Deploy another
**Notes:** None

### Button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below existing content | New buttons below current success content. Existing content untouched. | |
| Replace update button | 'Update' button removed/replaced by new navigation options. Less clutter. | ✓ |
| You decide | Claude picks best layout fit. | |

**User's choice:** Replace update button
**Notes:** None

---

## Post-Delete Next Actions

### 'Deploy new site' placement

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state CTA | Only appears when all sites deleted. Tab buttons suffice otherwise. | |
| Always after delete | Button appears after any successful deletion, even with remaining sites. | |
| You decide | Claude picks based on SC-3 and Phase 14 card outcomes. | |

**User's choice:** (Other) User questioned why 'Deploy new site' isn't always visible on the manage page, suggesting it should be always-visible and disabled during operations.
**Notes:** "I am confused about this one. WHy isn't deploy new site always visible onm this page already? (but maybe disabled during actions)"

### Follow-up: Always-visible CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Tab button is enough | Deploy tab re-enables on completion. No extra button. | |
| Add CTA in manage view | Always-visible 'Deploy new site' in manage view. Disabled during operations. | ✓ |
| Only on empty state | Only add button when zero sites remain. | |

**User's choice:** Add CTA in manage view
**Notes:** In addition to the Deploy tab button — provides more discoverable path.

---

## Non-Destructive Completion

### What counts as non-destructive

| Option | Description | Selected |
|--------|-------------|----------|
| Everything on completion | All operations re-enable tabs on completion/error. No destructive distinction. Simpler. | ✓ |
| Distinguish by type | Delete = destructive (different treatment), deploy/update = non-destructive. | |
| You decide | Claude determines cleanest interpretation for SC-4. | |

**User's choice:** Everything on completion
**Notes:** Matches the "on completion or error" decision from tab visibility area.

---

## Claude's Discretion

- Button placement in manage view (top vs. bottom of site list)
- Button styling (primary vs. secondary) for "Deploy new site" in manage view
- Whether "Deploy another" resets to root deploy or preserves last-used site type
- Tab button disable/enable animation
- Disabled state implementation (CSS vs. attribute)

## Deferred Ideas

None — discussion stayed within phase scope

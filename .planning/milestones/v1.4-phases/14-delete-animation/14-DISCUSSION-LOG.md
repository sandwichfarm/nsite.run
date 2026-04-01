# Phase 14: Delete Animation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 14-delete-animation
**Areas discussed:** Card state machine, Deletion progress UX, Animation & reflow, Failure recovery UX

---

## Card State Machine

### State model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-card state overlay | Keep card list always visible. Track deleting cards via Set/Map. Confirmation/progress as overlay, not full view swap. | ✓ |
| Split view | Card list on one side, deletion progress panel on the other. | |
| You decide | Claude picks based on component structure. | |

**User's choice:** Per-card state overlay
**Notes:** None

### Confirmation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Keep full-view confirm | Confirmation stays as full-view swap. Only deleting/done become per-card. | |
| Inline card confirm | Confirmation appears on/below card being deleted. Other cards remain visible. | |
| You decide | Claude picks based on existing layout and refactoring scope. | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on confirmation dialog placement.

### Concurrency

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | Only one card in delete state. Other delete buttons disabled. | |
| Concurrent deletes | Multiple cards can delete simultaneously with independent state. | ✓ |
| You decide | Claude picks based on complexity tradeoff. | |

**User's choice:** Concurrent deletes
**Notes:** None

### Outcome display

| Option | Description | Selected |
|--------|-------------|----------|
| Card-level indicator | Card shows outcome — green flash/check for success, red flash/shake for failure. No separate results view. | ✓ |
| Brief inline summary | Compact summary below card (relay/blob counts) before fade/revert. | |
| Keep results view | Preserve existing detailed results via 'View details' link, not full view swap. | |

**User's choice:** Card-level indicator
**Notes:** None

---

## Deletion Progress UX

### Progress location

| Option | Description | Selected |
|--------|-------------|----------|
| Dimmed card only | Card dims with 'Deleting...' label. No progress bar. Simple, minimal. | |
| Inline progress on card | Card dims AND shows progress bar/step indicator on the card surface. | ✓ |
| You decide | Claude picks balancing informativeness with simplicity. | |

**User's choice:** Inline progress on card
**Notes:** None

---

## Animation & Reflow

### Reflow approach

| Option | Description | Selected |
|--------|-------------|----------|
| CSS transition on gap | CSS transition-all on container; two-phase: fade opacity, then collapse height. | ✓ |
| Instant reflow | Card removed from DOM after fade; remaining cards snap into place. | |
| You decide | Claude picks smoothest approach within Svelte 4 constraints. | |

**User's choice:** CSS transition on gap
**Notes:** Prior research locks out:fade only (no animate:flip, Svelte 4 #4910).

### Fade timing

| Option | Description | Selected |
|--------|-------------|----------|
| Quick (~300ms) | Fast and responsive. Total animation ~500ms. | |
| Moderate (~500ms) | Deliberate, visible fade. Total ~800ms. | ✓ |
| You decide | Claude picks based on existing transition-colors timing. | |

**User's choice:** Moderate (~500ms)
**Notes:** None

---

## Failure Recovery UX

### Recovery animation

| Option | Description | Selected |
|--------|-------------|----------|
| Instant snap-back | Card immediately returns to normal state. Simple and clear. | |
| Animated recovery | Card opacity transitions back, brief red flash/shake, then returns to normal. | ✓ |
| You decide | Claude picks matching the card-level indicator pattern. | |

**User's choice:** Animated recovery
**Notes:** None

### Error message location

| Option | Description | Selected |
|--------|-------------|----------|
| On card inline | Brief error in red text on the card, visible a few seconds, then fades. Card returns to normal. | ✓ |
| Toast notification | Toast/snackbar at screen edge with error details. Card silently returns to normal. | |
| You decide | Claude picks based on existing error display patterns. | |

**User's choice:** On card inline
**Notes:** None

---

## Claude's Discretion

- Confirmation dialog placement (full-view or inline card expand)
- Exact dimming opacity and "Deleting..." label styling
- Progress indicator format (step pills vs. progress bar vs. text)
- Green success flash duration before fade-out begins
- Red failure flash/shake animation specifics
- Error message auto-dismiss timing
- Per-card state Map structure

## Deferred Ideas

None — discussion stayed within phase scope

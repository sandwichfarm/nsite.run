# Phase 20: Web Component and IIFE Bundle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 20-web-component-and-iife-bundle
**Areas discussed:** Shadow DOM + CSS strategy, Button + modal UX, Props + attributes

---

## Shadow DOM + CSS strategy

| Option | Description | Selected |
|--------|-------------|----------|
| shadow: 'open' + CSS inject | Full encapsulation, CSS string injection | |
| shadow: 'none' | No shadow DOM, Tailwind works normally | |
| Prototype both | Build both, pick based on bundle size + visuals | ✓ |

**User's choice:** Prototype both
**Notes:** Final decision based on bundle size + visual correctness

---

## Button + modal UX

| Option | Description | Selected |
|--------|-------------|----------|
| Like stealthis | Fixed bottom-right, opens modal overlay | |
| Inline expandable | Expands where placed | |
| You decide | Claude picks | |

**User's choice:** Like stealthis but button can be placed wherever. User wants control over button color and text.
**Notes:** NOT fixed position — renders inline. trigger-label, trigger-color, trigger-bg attributes.

---

## Props + attributes

| Option | Description | Selected |
|--------|-------------|----------|
| Those three are enough | trigger-label, extraRelays, extraBlossoms | |
| + button styling attrs | Also trigger-color, trigger-bg | |
| + relay/blossom defaults | Also default-relay, default-blossom | |

**User's choice:** All three (trigger-label + styling + relay/blossom defaults)
**Notes:** User selected all options combined

## Claude's Discretion

- CSS prototype comparison approach
- Modal implementation (dialog vs div)
- Focus trapping, z-index management
- Bundle size optimization

## Deferred Ideas

None

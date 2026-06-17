# Phase 19: Svelte Component - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 19-svelte-component
**Areas discussed:** Component boundary, Auth + signer prop, Event + CSS contract

---

## Component boundary

### OperationBanner

| Option | Description | Selected |
|--------|-------------|----------|
| Inside DeployerWidget | Banner is part of deploy experience | ✓ |
| Stays in SPA | SPA owns it, widget emits events | |
| You decide | Claude picks | |

**User's choice:** Inside DeployerWidget

### beforeunload guard

| Option | Description | Selected |
|--------|-------------|----------|
| Inside DeployerWidget | Widget knows about dangerous steps | ✓ |
| Stays in SPA | SPA manages, widget emits state | |
| You decide | Claude picks | |

**User's choice:** Inside DeployerWidget

---

## Auth + signer prop

| Option | Description | Selected |
|--------|-------------|----------|
| Auth moves into widget | Complete auth flow inside, self-contained | ✓ |
| Auth stays in SPA | SPA keeps login UI, passes signer | |
| Widget has minimal auth | Simplified auth, full stays in SPA | |

**User's choice:** Auth moves into widget
**Notes:** "would be good to have a way to trigger the auth and/or pass a standard signer interface"

---

## Event contract

### Events

| Option | Description | Selected |
|--------|-------------|----------|
| Core events only | deploy-success, deploy-error, auth-change | |
| + operation events | Also: operation-start, operation-end, site-deleted | ✓ |
| You decide | Claude picks | |

**User's choice:** Core + operation events

### CSS tokens

| Option | Description | Selected |
|--------|-------------|----------|
| 4 basics | --deployer-accent, --deployer-bg, --deployer-text, --deployer-radius | ✓ |
| You decide | Claude picks based on Tailwind styles | |

**User's choice:** 4 basic tokens

## Claude's Discretion

- App.svelte extraction strategy (incremental vs big-bang)
- Internal state management within DeployerWidget
- Tab/step state machine structuring
- Event dispatch patterns (dispatch vs callback props)

## Deferred Ideas

None

# Phase 18: Core Lib Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 18-core-lib-extraction
**Areas discussed:** Store scoping strategy, What moves vs stays, Export organization

---

## Store scoping strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Svelte context | setContext/getContext in component tree | |
| Factory functions | createDeployerStores() returns fresh instances | ✓ |
| You decide | Claude picks | |

**User's choice:** Factory functions
**Notes:** None

---

## What moves vs stays

| Option | Description | Selected |
|--------|-------------|----------|
| Move tests, keep yaml | Tests go with lib, yaml stays in SPA | ✓ |
| Move everything | All of lib/ wholesale | |
| Move tests, drop yaml | Tests move, yaml relocates | |

**User's choice:** Move tests, keep yaml
**Notes:** tools-resources.yaml is SPA-only educational content

---

## Export organization

| Option | Description | Selected |
|--------|-------------|----------|
| Barrel export | Single entry, everything from index.js | |
| Sub-path exports | Per-file: @nsite/deployer/store, /crypto etc | |
| Both | Barrel + sub-paths for flexibility | ✓ |

**User's choice:** Both barrel and sub-path exports
**Notes:** None

## Claude's Discretion

- Import rewriting strategy across 13+ files
- Whether SPA uses barrel or sub-path style
- Test runner config adjustments
- Order of operations for move

## Deferred Ideas

None

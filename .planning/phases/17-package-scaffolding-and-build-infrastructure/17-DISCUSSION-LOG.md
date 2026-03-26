# Phase 17: Package Scaffolding and Build Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 17-package-scaffolding-and-build-infrastructure
**Areas discussed:** Package naming + exports, Widget bundle naming, Dependency ownership

---

## Package naming + exports

| Option | Description | Selected |
|--------|-------------|----------|
| @nsite/deployer | Consistent with @nsite/spa, @nsite/stealthis naming pattern | ✓ |
| @nsite/deploy | Shorter, matches the custom element verb pattern | |

**User's choice:** @nsite/deployer
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| npm only | workspaces: ["apps/spa", "packages/deployer"] — Deno stays outside | ✓ |
| Include all | workspaces: ["apps/*", "packages/*"] — broader but needs package.json for shared | |

**User's choice:** npm only
**Notes:** "for now, jsr later"

---

## Widget bundle naming

| Option | Description | Selected |
|--------|-------------|----------|
| <nsite-deployer> | Matches package name, clearly a deployer widget | ✓ |
| <nsite-deploy> | Shorter verb form | |
| <nsite-uploader> | Different verb, emphasizes upload | |

**User's choice:** <nsite-deployer>
**Notes:** User clarified stealthis should have its own distinct tag (not <nsite-deploy>) — possibly a branch issue where HEAD vs enhance/button differ.

| Option | Description | Selected |
|--------|-------------|----------|
| deployer.js / deployer.mjs | Matches package name, clear purpose | ✓ |
| nsite-deployer.js / .mjs | Includes nsite prefix | |

**User's choice:** deployer.js / deployer.mjs

---

## Dependency ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Deployer owns all deploy deps | applesauce-*, nostr-tools etc move to deployer. SPA gets transitively. | |
| Both declare deps | Both list deps, npm dedupes. More explicit. | |
| You decide | Claude picks cleanest approach | ✓ |

**User's choice:** Claude's discretion
**Notes:** None

## Claude's Discretion

- Dependency ownership split between deployer and SPA
- Exact exports map structure
- Vite config organization (single vs multiple files)
- publint setup

## Deferred Ideas

- JSR publication — user wants this later, not in this milestone

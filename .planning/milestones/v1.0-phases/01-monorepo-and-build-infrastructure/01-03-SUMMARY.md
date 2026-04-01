---
phase: 01-monorepo-and-build-infrastructure
plan: 03
subsystem: infra
tags: [github-actions, ci-cd, deno, bunny-edge-scripting, bundle-size, pr-comments]

# Dependency graph
requires:
  - phase: 01-02
    provides: "esbuild build scripts (deno task build) and scripts/check-bundle-sizes.ts"
provides:
  - GitHub Actions CI workflow validating fmt, lint, type check, test, build, bundle size
  - GitHub Actions CI bundle-delta job posting PR bundle size comparison comment
  - GitHub Actions deploy workflow building and deploying all 3 edge scripts to Bunny on push to main
affects:
  - All phases 2-5 (CI/CD pipeline in place, regressions caught automatically)
  - Phase 6 (deploy workflow ships final SPA + edge scripts)

# Tech tracking
tech-stack:
  added:
    - "github-actions: denoland/setup-deno@v2 (Deno v2.x in CI)"
    - "github-actions: BunnyWay/actions/deploy-script@main (Bunny Edge Script deployment)"
    - "github-actions: actions/github-script@v7 (PR comment automation)"
  patterns:
    - "bundle-delta job is PR-only and informational (no needs:) — never blocks merging"
    - "deploy workflow runs size check redundantly before deploy — safety net independent of CI"
    - "PR comment upsert: find existing bot comment by marker, update or create"

key-files:
  created:
    - ".github/workflows/ci.yml (3 jobs: validate, build-and-size-check, bundle-delta)"
    - ".github/workflows/deploy.yml (build + deploy all 3 edge scripts to Bunny)"
  modified: []

key-decisions:
  - "bundle-delta job has no needs: dependency — it runs in parallel with build-and-size-check and never blocks merging. The build-and-size-check job is the hard gate."
  - "deploy.yml runs check-bundle-sizes.ts independently (not via needs: ci) — GitHub branch protection rules enforce CI pass before merge; the deploy does its own safety check for edge cases"
  - "BunnyWay/actions/deploy-script@main used per research recommendation; pinning to commit SHA deferred to follow-up after initial setup verified"

patterns-established:
  - "Pattern: PR comment upsert — search for <!-- bundle-size-report --> marker, update existing comment or create new one to avoid duplicates"
  - "Pattern: deploy safety net — re-run bundle size check in deploy workflow even though CI already ran it"

requirements-completed: [INFRA-02]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 01 Plan 03: GitHub Actions CI and Deploy Workflows Summary

**GitHub Actions CI pipeline (validate, build+size-check, PR bundle-delta comment) and Bunny Edge Script deploy workflow triggered on push to main**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T14:28:12Z
- **Completed:** 2026-03-13T14:31:00Z
- **Tasks:** 2 completed (Task 3 is a human-action checkpoint)
- **Files modified:** 2 created

## Accomplishments

- CI workflow validates formatting, linting, type checking, tests, build, and enforces 1MB bundle size limit
- PR-only bundle-delta job posts/updates a bundle size comparison table comment with base/PR/delta columns and status indicators
- Deploy workflow builds all 3 bundles, runs size check, then deploys relay/blossom/gateway to Bunny using per-script secrets

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CI workflow** - `d60abc4` (feat)
2. **Task 2: Create deploy workflow** - `760de1f` (feat)

## Files Created/Modified

- `.github/workflows/ci.yml` - 3 jobs: validate (fmt/lint/check/test), build-and-size-check (build + 1MB limit), bundle-delta (PR comment)
- `.github/workflows/deploy.yml` - build + size check + deploy relay/blossom/gateway via BunnyWay/actions/deploy-script@main

## Decisions Made

- `bundle-delta` job has no `needs:` dependency and `if: github.event_name == 'pull_request'` — runs in parallel, never blocks merging. The `build-and-size-check` job is the hard gate.
- Deploy workflow re-runs `check-bundle-sizes.ts` independently before deploying — belt-and-suspenders safety net catching any edge case where CI didn't run or was bypassed.
- `BunnyWay/actions/deploy-script@main` pinning deferred: use `@main` initially, pin to commit SHA once initial deployment is verified working.
- PR comment upsert pattern: search existing comments for `<!-- bundle-size-report -->` marker, update if found, create if not — avoids duplicate bot comments on re-pushed commits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** The deploy workflow requires 6 GitHub repository secrets:

**Step 1: Create 3 Edge Scripts in Bunny Dashboard**
1. Go to Bunny Dashboard -> Edge Scripting -> Add Script
2. Create scripts named: `nsite-relay`, `nsite-blossom`, `nsite.run`
3. For each script: note the Script ID and generate a Deploy Key (Deployments -> Settings -> Deploy Key)

**Step 2: Add 6 GitHub repository secrets**
Go to: GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret

| Secret Name | Source |
|-------------|--------|
| `BUNNY_RELAY_SCRIPT_ID` | Bunny Dashboard -> relay script -> Script ID (numeric) |
| `BUNNY_RELAY_DEPLOY_KEY` | Bunny Dashboard -> relay script -> Deployments -> Settings -> Deploy Key |
| `BUNNY_BLOSSOM_SCRIPT_ID` | Bunny Dashboard -> blossom script -> Script ID (numeric) |
| `BUNNY_BLOSSOM_DEPLOY_KEY` | Bunny Dashboard -> blossom script -> Deployments -> Settings -> Deploy Key |
| `BUNNY_GATEWAY_SCRIPT_ID` | Bunny Dashboard -> gateway script -> Script ID (numeric) |
| `BUNNY_GATEWAY_DEPLOY_KEY` | Bunny Dashboard -> gateway script -> Deployments -> Settings -> Deploy Key |

**Step 3 (optional but recommended):** Enable branch protection on `main` requiring `validate` and `build-and-size-check` jobs to pass before merge.

## Next Phase Readiness

- CI/CD pipeline complete: code quality enforced, bundle sizes checked, PRs get delta comments
- Deploy workflow ready once GitHub Secrets are configured (see User Setup above)
- Phases 2-5 can be developed with full CI coverage from the first commit

---
*Phase: 01-monorepo-and-build-infrastructure*
*Completed: 2026-03-13*

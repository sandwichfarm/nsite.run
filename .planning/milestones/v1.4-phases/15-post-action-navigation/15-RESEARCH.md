# Phase 15: Post-Action Navigation - Research

**Researched:** 2026-03-25
**Status:** Complete

## Objective

Determine what changes are needed to ensure users always have an obvious next action after deploy or delete operations, and understand how tab button disabling/re-enabling integrates with the existing Phase 13 infrastructure.

## Key Findings

### 1. Current Success Screen (SuccessPanel.svelte)

The success screen currently shows:
- Site URL with copy button
- Activity rings (upload stats)
- Deploy summary (uploaded/already exist/failed counts)
- Event ID
- Action buttons: **Update Site**, **Copy URL**, **Share on nostr**, **View Manifest**
- Anonymous nsec backup (if applicable)
- Below the SuccessPanel: a plain text "Deploy another site" link calling `resetDeploy()` (full reset including signer)

**What needs to change (per CONTEXT.md decisions D-04, D-05, D-06, D-07):**
- Replace the "Update Site" button (inside SuccessPanel) with "Manage sites" and "Deploy another site" buttons
- "Manage sites" navigates to manage view (`currentPage = 'manage'`) preserving signer session
- "Deploy another site" calls `resetForUpdate()` (NOT `resetDeploy()`) to preserve signer and return to file drop zone
- The existing "Deploy another site" link below SuccessPanel (line 987-994 in App.svelte) uses `resetDeploy()` — this must be removed or replaced
- Existing content (URL, nsec, activity rings) remains untouched

### 2. Current Tab Button Rendering (App.svelte lines 538-556)

Tab buttons currently render only in the `idle || selecting` block with condition:
```svelte
{#if (allSites.root || allSites.named.length > 0) && $session.pubkey}
```

They are always enabled — no disabled state exists. Buttons use simple `on:click={() => (currentPage = 'deploy'/'manage')}`.

**What needs to change (per CONTEXT.md decisions D-01, D-02, D-03):**
- Tab buttons must be disabled (greyed out, not hidden) during active operations
- Re-enabled on success or error state
- All operations (deploy, update, delete) follow the same disable/re-enable pattern
- Phase 13 already provides `isDangerousStep` derivation and `deleteInProgress` boolean — these are the exact signals needed

**Note:** The `isDangerousStep` and `deleteInProgress` variables from Phase 13 exist on the `enhance/action-guards` branch, not on the current branch. Phase 15 depends on Phase 14 which depends on Phase 13. Plans must reference these Phase 13-provided variables as they will exist when Phase 15 executes.

### 3. Current ManageSite Delete Done State (ManageSite.svelte lines 514-599)

After deletion completes, the manage view shows:
- "Deletion complete" header with green checkmark
- Step pills (all complete)
- Relay results summary
- Blossom results summary
- **"Back to sites"** button that calls `handleBackToDeploy()` which dispatches `'deleted'` event

**What needs to change (per CONTEXT.md decisions D-08, D-09):**
- Add an always-visible "Deploy new site" button in the manage view content area
- This button should be present in all ManageSite states (idle site list, delete done), not just empty state
- Disabled during active operations (deleting state), enabled otherwise
- Clicking it should navigate to deploy tab: dispatch an event to parent App.svelte which sets `currentPage = 'deploy'`

### 4. Phase 13 Infrastructure Available

From Phase 13 Plan 01 (already executed on `enhance/action-guards`):
- `DANGEROUS_DEPLOY_STEPS` Set constant: `new Set(['hashing', 'checking', 'uploading', 'publishing'])`
- `isDangerousStep` reactive derivation: `$: isDangerousStep = DANGEROUS_DEPLOY_STEPS.has($deployState.step) || deleteInProgress`
- `deleteInProgress` boolean: set by `delete-start` / `delete-end` events from ManageSite

From Phase 13 Plan 02:
- `OperationBanner.svelte` component renders above tab buttons in idle/selecting block
- `showBanner` derivation: `isDangerousStep || bannerCompletionState !== null`

**Integration point for tab disabling:** The `isDangerousStep` variable is exactly what's needed to control tab button disabled state. When `isDangerousStep` is true, buttons should be disabled.

### 5. Event Flow for "Deploy new site" from Manage View

ManageSite already dispatches `'update'` event to parent App.svelte for the "Update Site" button. A similar pattern is needed for "Deploy new site":
- Option A: Dispatch a new `'deploy-new'` event from ManageSite
- Option B: Have the parent App.svelte handle tab switching directly via callback prop

The existing pattern is event dispatch (ManageSite uses `dispatch('update', site)` and `dispatch('deleted')`), so a new `dispatch('deploy-new')` event is the most consistent approach.

### 6. File Impact Analysis

| File | Changes Required |
|------|-----------------|
| `apps/spa/src/components/SuccessPanel.svelte` | Replace "Update Site" button with "Manage sites" + "Deploy another" buttons; add new events/callbacks |
| `apps/spa/src/App.svelte` | Handle new SuccessPanel events; add disabled state to tab buttons using isDangerousStep; handle ManageSite deploy-new event; remove old "Deploy another" link |
| `apps/spa/src/components/ManageSite.svelte` | Add "Deploy new site" button to manage view; dispatch 'deploy-new' event |

### 7. Requirements Mapping

| REQ-ID | Implementation |
|--------|---------------|
| NAV-01 | Tab buttons disabled (greyed out) when `isDangerousStep` is true |
| NAV-02 | Tab buttons re-enabled when `isDangerousStep` becomes false (success/error states) |
| NAV-03 | "Manage sites" button on SuccessPanel navigates to manage view preserving signer |
| NAV-04 | "Deploy new site" button always visible in ManageSite, navigates to deploy tab |

**Note on NAV-01:** CONTEXT.md decision D-01 says "disabled and greyed out" (not hidden), while the ROADMAP success criteria says "hidden while a stepper operation is active." CONTEXT.md decisions take precedence — the user explicitly chose disabled over hidden for spatial awareness. The success criteria will be met by the functional intent: preventing navigation during active operations.

### 8. Dependency Chain

Phase 15 depends on Phase 13 (provides `isDangerousStep`, `deleteInProgress`, `OperationBanner`) and Phase 14 (fixes delete state machine). The tab disabling feature directly uses Phase 13's `isDangerousStep` reactive variable. Plans should note this dependency but write the code as if Phase 13 and 14 are already integrated.

---

## RESEARCH COMPLETE

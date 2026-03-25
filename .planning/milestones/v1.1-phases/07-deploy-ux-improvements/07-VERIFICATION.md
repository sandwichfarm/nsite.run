---
phase: 07-deploy-ux-improvements
verified: 2026-03-20T17:10:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 07: Deploy UX Improvements Verification Report

**Phase Goal:** Users have full control over what they deploy before uploading
**Verified:** 2026-03-20T17:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Dragging multiple loose files onto the drop zone shows an inline error and does not process any files | VERIFIED | `DeployZone.svelte` lines 63-84: first-pass classification loop counts looseFileCount; if `!hasDirectory && looseFileCount >= 2` sets loadError and returns before processFiles |
| 2  | Dragging a single loose file still works as before | VERIFIED | Rejection only fires when `looseFileCount >= 2`; single loose file falls through to existing processing loop |
| 3  | Dragging a folder or single archive still works as before | VERIFIED | `hasDirectory` flag prevents rejection for any drop containing a directory; archives are excluded from `looseFileCount` by extension check |
| 4  | Clicking a file row in the deploy tree expands an inline code block showing the file contents | VERIFIED | `FileTree.svelte` lines 206-212: filename rendered as `<button on:click={() => togglePreview(node)}`; inline preview panel at lines 256-274 |
| 5  | Clicking the same file row again collapses the preview | VERIFIED | `togglePreview` at line 108: `if (previewPath === node.path)` nulls previewPath and resets state |
| 6  | Binary files show "Binary file — cannot preview" instead of content | VERIFIED | `FileTree.svelte` line 259: `Binary file — cannot preview` (em dash confirmed) inside `{#if previewIsBinary}` block |
| 7  | Preview shows first 100 lines with a "Show more" button that loads the next 100 lines | VERIFIED | `previewLinesShown = 100` initial state; `showMoreLines()` adds 100; button at line 265 shows when `previewLines.length > previewLinesShown` |
| 8  | Hovering any file row in the deploy tree reveals an exclude toggle icon | VERIFIED | `FileTree.svelte` lines 219-235: `opacity-0 group-hover:opacity-100` button on all non-warned file rows |
| 9  | Clicking the exclude toggle marks the file as excluded with strikethrough and reduced opacity | VERIFIED | Line 207: `{isExcluded ? 'line-through text-slate-500 opacity-50' : 'text-slate-300 hover:text-purple-300'}` applied to filename button |
| 10 | Excluding a directory recursively excludes all its children | VERIFIED | `collectFilePaths(node)` at line 58; `toggleExclude(path, node)` at line 67 calls `onToggleExclude(p)` for each child not yet excluded |
| 11 | Re-including a directory restores all its children | VERIFIED | `allExcluded` check at line 71; if all children excluded, calls `onToggleExclude(p)` for each to re-include |
| 12 | A badge at the top of the file tree shows the count of excluded files | VERIFIED | `App.svelte` lines 517-526: badge with `{userExcludedCount} excluded` renders when `userExcludedCount > 0` |
| 13 | A section below the file tree lists excluded files with re-include toggles | VERIFIED | `App.svelte` lines 559-610: "Excluded files ({userExcludedCount})" section with per-file "Re-include" buttons |
| 14 | The ignored summary section is expanded by default | VERIFIED | Section container always visible when `userExcludedCount > 0`; `showAllExcluded = userExcludedPaths.length <= 10` ensures short lists fully show; truncation only applies when list exceeds 10 items |
| 15 | Long excluded lists are truncated with "+ N more" and can be expanded | VERIFIED | Lines 593-600: `+ {userExcludedPaths.length - TRUNCATE_THRESHOLD} more` button when `!showAllExcluded && !excludedSummaryExpanded` |
| 16 | Warned files keep their existing always-visible checkbox and Exclude label | VERIFIED | `FileTree.svelte` lines 237-252: existing `{#if nodeWarnings.length > 0}` block with amber checkbox preserved; hover toggle only renders on `{#if nodeWarnings.length === 0}` |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/spa/src/components/DeployZone.svelte` | Multi-file rejection logic in onDrop | VERIFIED | Contains `Multiple files detected — please drop a folder or archive (.zip, .tar.gz)` at line 81; `isLoading = false` set before early return at line 83 |
| `apps/spa/src/components/FileTree.svelte` | Inline file preview with pagination | VERIFIED | Contains `export let fileDataMap`, `function togglePreview`, `function showMoreLines`, `function isTextFile`, `const TEXT_EXTENSIONS = new Set(`, `Show more`, `Binary file — cannot preview`, `previewLinesShown += 100`, `previewPath === node.path`, `{fileDataMap}` and `{excludedFiles}` in `<svelte:self>` |
| `apps/spa/src/App.svelte` | File data and excluded state passed to FileTree | VERIFIED | Contains `fileDataMap = new Map(selectedFiles.map(f => [f.path, f.data]))` at line 133; FileTree invocation at lines 531-537 includes `{fileDataMap}` and `{excludedFiles}` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.svelte` | `FileTree.svelte` | `fileDataMap` prop passing file ArrayBuffer data | WIRED | `$: fileDataMap = new Map(selectedFiles.map(f => [f.path, f.data]))` derived reactively; passed as `{fileDataMap}` to FileTree at line 535 |
| `DeployZone.svelte` | `loadError` | Inline error display on multi-file rejection | WIRED | `loadError = 'Multiple files detected — ...'` at line 81; `loadError` already rendered as `<p class="mt-4 text-sm text-red-400">{loadError}</p>` at line 248 |
| `FileTree.svelte` | `App.svelte` | `onToggleExclude` callback prop | WIRED | FileTree calls `onToggleExclude(path)` in `toggleExclude` function; App.svelte passes `onToggleExclude={toggleExclude}` at line 534 |
| `App.svelte` | `excludedFiles` Set | `toggleExclude` function and excluded badge/summary rendering | WIRED | `$: userExcludedCount = excludedFiles.size` at line 134; `$: userExcludedPaths = [...excludedFiles]` at line 135; passed as `{excludedFiles}` to FileTree at line 536 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DPLX-01 | 07-01-PLAN.md | Deploy zone rejects multi-file drag and shows message to use folder or archive | SATISFIED | `DeployZone.svelte` first-pass loop with `looseFileCount >= 2` guard; error message `Multiple files detected — please drop a folder or archive (.zip, .tar.gz)` rendered inline |
| DPLX-02 | 07-01-PLAN.md | User can click a file in the deploy tree to preview its contents inline | SATISFIED | `FileTree.svelte` filename as clickable button calling `togglePreview(node)`; inline preview panel with text content, binary fallback, and "Show more" pagination |
| DPLX-03 | 07-02-PLAN.md | User can exclude/include individual files via hover toggle in deploy tree, with excluded files collected in an ignored summary section | SATISFIED | Hover-reveal toggle on all non-warned rows; directory recursive exclude; excluded badge in App.svelte; full ignored summary section with per-file and bulk re-include controls |

All three requirement IDs declared in plan frontmatter are accounted for. No orphaned requirements for Phase 7 found in REQUIREMENTS.md (traceability table maps DPLX-01, DPLX-02, DPLX-03 to Phase 7 — all three claimed by plans).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/spa/src/components/SuccessPanel.svelte` | 17 | Unused export property `publishResult` | Info | Pre-existing warning, unrelated to Phase 07; flagged by Vite build but build succeeds |

No TODOs, FIXMEs, stub returns, or placeholder comments found in Phase 07 modified files.

---

### Human Verification Required

The following behaviors cannot be verified programmatically and require manual browser testing:

#### 1. Multi-file drop rejection UX

**Test:** Drag three loose HTML/JS files from the filesystem and drop them onto the deploy zone.
**Expected:** An inline red error message appears: "Multiple files detected — please drop a folder or archive (.zip, .tar.gz)". No file tree or reviewing step appears.
**Why human:** `webkitGetAsEntry()` is a browser drag-and-drop API — cannot be simulated via grep or build check.

#### 2. Inline file preview toggle

**Test:** Drop a folder, then click a `.js` or `.html` filename in the file tree.
**Expected:** A code block expands below that row showing up to 100 lines of text. Clicking again collapses it.
**Why human:** Preview expand/collapse involves runtime Svelte reactivity and DOM rendering.

#### 3. Binary file preview

**Test:** Drop a folder containing an image (e.g. `.png`). Click the image filename.
**Expected:** Preview panel shows "Binary file — cannot preview" in italic grey text.
**Why human:** Requires runtime check of TEXT_EXTENSIONS set against actual file extension.

#### 4. Hover-reveal exclude toggle visibility

**Test:** Drop a folder and hover over a file row in the file tree.
**Expected:** An X icon appears on the right side of the row only while hovered, then disappears when hover leaves.
**Why human:** CSS `opacity-0 group-hover:opacity-100` behavior requires visual inspection in browser.

#### 5. Directory recursive exclude

**Test:** Drop a folder with subdirectories. Click the hover-reveal X on a directory row.
**Expected:** All files within that directory show strikethrough styling and the excluded count badge increments by the number of files in the directory.
**Why human:** Recursive tree traversal correctness and visual feedback require runtime rendering.

#### 6. Ignored summary truncation

**Test:** Exclude more than 10 files individually. Check the ignored summary section.
**Expected:** First 10 excluded paths are listed, then a "+ N more" button appears. Clicking it reveals the rest.
**Why human:** Requires runtime state with > 10 excluded paths to trigger truncation.

---

### Gaps Summary

No gaps. All 16 observable truths verified, all artifacts substantive and wired, all three requirement IDs satisfied, build succeeds with zero errors. The one pre-existing Vite warning about `publishResult` in `SuccessPanel.svelte` is unrelated to Phase 07 and was present before this phase began.

---

_Verified: 2026-03-20T17:10:00Z_
_Verifier: Claude (gsd-verifier)_

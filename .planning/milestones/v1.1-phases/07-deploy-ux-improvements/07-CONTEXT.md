# Phase 7: Deploy UX Improvements - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve file handling UX in the deploy flow before upload: reject loose multi-file drops with a clear message, add inline file preview to the deploy tree, and expand the per-file exclude toggle to all files (not just warned ones) with an ignored summary.

</domain>

<decisions>
## Implementation Decisions

### Multi-file rejection
- Detect when multiple loose files (not inside a directory, not an archive) are dropped
- Reject the drop — do not process any files
- Show inline error in the drop zone (same style as existing `loadError`): "Multiple files detected — please drop a folder or archive (.zip, .tar.gz)"
- Single loose file drops continue to work as before (or single archive)

### File preview display
- Inline expand: clicking a file row in the tree expands a code block below that row showing the file contents. Click again to collapse.
- Text files only: support preview for text-like files (html, css, js, json, yaml, md, txt, svg, xml, etc.). Binary files show "Binary file — cannot preview"
- Paginated: show first 100 lines, then a "Show more" button to load the next 100 lines. Repeat until end of file.
- Preview renders inside the FileTree component, below the clicked file row

### Exclude toggle design
- Hover-reveal toggle on ALL file rows (not just warned files). Small X or toggle icon appears on hover.
- Warned files keep their existing always-visible checkbox + "Exclude" label
- Excluding a directory recursively excludes all children. Re-including the dir restores all children.
- Excluded files get strikethrough + reduced opacity inline (already exists)
- Three-layer feedback for excluded files:
  1. Inline visual treatment on the file row (strikethrough, opacity — existing behavior)
  2. Badge at top of file tree showing count ("3 excluded")
  3. Section below tree showing excluded file list — expanded by default, truncated with "+ N more" for long lists. Each item has a re-include toggle.

### Claude's Discretion
- Exact hover toggle icon (X, eye-slash, toggle, etc.)
- Preview syntax highlighting (if any — plain text is fine)
- Truncation threshold for the ignored section ("+ N more" cutoff)
- Detection heuristic for "text-like" vs binary files (file extension list or content sniffing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GitHub Issues
- GitHub issue #6 — Multi-file drag drops only one file, should reject and prompt
- GitHub issue #7 — Add quick file preview in the deploy file tree
- GitHub issue #11 — Add per-file exclude toggle in the deploy file tree

No external specs — requirements fully captured in decisions above and the GitHub issues.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DeployZone.svelte`: `onDrop` handler iterates `e.dataTransfer.items` via `webkitGetAsEntry`. Multi-file detection point is here — check if multiple entries are files (not directories).
- `FileTree.svelte`: Already has `excludedPaths` Set, `toggleExclude(path)`, `onToggleExclude` callback prop, and strikethrough styling for excluded files. Exclude toggle currently only renders inside the `{#if nodeWarnings.length > 0}` block (line 115).
- `files.js`: `autoExcludeVCS()` returns `{included, excluded, excludedCount}` — the excluded/excludedCount data is already passed through but not fully surfaced in UI.
- `scanner.js`: `scanFiles()` returns `{warnings}` array with `{path, type, details}` objects.

### Established Patterns
- `<svelte:self>` recursive rendering in FileTree — preview expansion needs to integrate into this recursion
- `createEventDispatcher` in DeployZone dispatches `files-selected` with tree, warnings, excluded data
- Tailwind utility classes throughout — `bg-slate-800`, `text-slate-300`, hover states with `group` class

### Integration Points
- `DeployZone.svelte:onDrop()` — add multi-file detection before `processFiles()`
- `FileTree.svelte` file row rendering (line 98-132) — add preview expand and hover toggle
- `App.svelte` file review state — receives `files-selected` event, renders FileTree. Ignored summary section goes near the FileTree render in App.svelte.

</code_context>

<specifics>
## Specific Ideas

- Paginated preview with "Show more" loads next 100 lines at a time — user specifically requested this over truncation
- Three-layer excluded file feedback (inline + badge + section below) — user wants all three visible simultaneously
- Ignored section below tree should be expanded by default with "+ N more" truncation for long lists

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-deploy-ux-improvements*
*Context gathered: 2026-03-20*

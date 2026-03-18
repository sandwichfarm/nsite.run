# V1/V2 Protocol Split — Tools & Resources Section

## Summary

Split the SPA's Tools & Resources project listings into V1 and V2 protocol compatibility groups. V2 is active by default. Users toggle between versions via large side-by-side buttons. Compatible projects sort to the top within their existing categories; incompatible projects remain visible but faded and non-clickable. A "How to contribute" scroll nudge is added to the hero section.

## Context

The nsite ecosystem has two protocol versions:
- **V1**: Lez's original NIP draft (`https://github.com/lez/nsite`)
- **V2**: hzrd149's NIP PR #1538 (`https://github.com/nostr-protocol/nips/pull/1538`)

Currently all projects are listed without version distinction. Most tools support V1 only. Two tools support V2: **nsite-gateway** (this project) and **nsyte** CLI. The goal is to nudge users toward V2 while keeping V1 tools discoverable.

## Design

### 1. Data Model — `tools-resources.yaml`

Add an optional `versions` array field to each item:

```yaml
- name: "nsite-gateway"
  url: "https://github.com/hzrd149/nsite-gateway"
  description: "TypeScript gateway — self-hostable"
  versions: [v2]
```

Valid values: `[v1]`, `[v2]`, `[v1, v2]`.

Items without a `versions` field (Reference, Informational, Blossom Servers) are version-agnostic and always displayed at full opacity regardless of toggle state.

**Version assignments:**
| Project | Versions |
|---|---|
| nsite-gateway | v2 |
| nsyte | v2 |
| nsite.run | v1 |
| nosto.re | v1 |
| nwb.tf | v1 |
| nostr-deploy-server | v1 |
| nsite-cli | v1 |
| nous-cli | v1 |
| nostr-deploy-cli | v1 |
| nsite-action | v1 |
| nsite-manager | v1 |
| relay.nsite.lol | v1 |
| relay.nosto.re | v1 |

### 2. Toggle Component — `ToolsResources.svelte`

- A `selectedVersion` Svelte variable defaults to `'v2'`.
- Two large side-by-side buttons control the toggle. Active button: filled purple (`bg-purple-600`) with a subtle glow (`box-shadow`). Inactive button: outlined dark (`bg-slate-800`, `border-slate-600`).
- No localStorage persistence — always resets to V2 on page load to nudge users toward the newer protocol.

### 3. Sorting & Opacity Behavior

For each category, items are sorted so that version-matching items appear first:

- **Matching items** (item's `versions` includes `selectedVersion`): full opacity, clickable, normal hover effects.
- **Non-matching items** (item's `versions` does not include `selectedVersion`): `opacity: 0.35`, `pointer-events: none`, `cursor: default`. Still visible to nudge upgrades.
- **Version-agnostic items** (no `versions` field): always full opacity, always clickable, no sorting change.

Sorting is stable — within matching and non-matching groups, original YAML order is preserved.

All categories remain visible at all times, even if every item in a category is non-matching.

CSS transitions (`transition: opacity 0.3s`) for smooth visual feedback when toggling.

### 4. Sticky Toggle

An Intersection Observer watches the "Tools & Resources" `<h2>` heading:

- **Heading visible**: toggle sits inline in normal document flow.
- **Heading scrolled out of viewport**: toggle becomes `position: sticky` at the top with semi-transparent backdrop blur (`bg-slate-900/95 backdrop-blur`).

This prevents the toggle from floating while the user reads content above the Tools section.

### 5. "How to Contribute" Scroll Nudge

Positioned at the bottom of the hero section (`min-h-screen` deploy zone), below the login prompt:

- Text: "How to contribute" in `text-purple-400`
- Animated downward arrow/chevron with CSS `@keyframes bounce` (gentle up/down loop)
- Clicking smooth-scrolls to the Tools & Resources section (`scroll-behavior: smooth` or `element.scrollIntoView({ behavior: 'smooth' })`)
- Naturally scrolls out of view as user moves past the hero — no hide logic needed

Visual style matches nsite.run's "Scroll to explore" pattern.

## Files Changed

1. **`apps/spa/src/lib/tools-resources.yaml`** — add `versions` field to applicable items
2. **`apps/spa/src/components/ToolsResources.svelte`** — add toggle UI, sorting logic, opacity behavior, sticky Intersection Observer
3. **`apps/spa/src/App.svelte`** — add "How to contribute" scroll nudge to hero section, add `id` to Tools & Resources section for scroll target

## Out of Scope

- Visible V1/V2 badges on individual project cards
- Persisting toggle state across page loads
- Any changes to the deploy flow or other SPA sections

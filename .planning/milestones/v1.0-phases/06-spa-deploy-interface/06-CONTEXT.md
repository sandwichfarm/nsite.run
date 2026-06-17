# Phase 6: SPA Deploy Interface - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Svelte SPA at nsite.run root that lets users deploy static sites to nsite.run. Anonymous deploy (generated keypair) is the default — no login required. Authenticated users deploy with their own Nostr identity via NIP-07 or NIP-46. The same page serves as the educational landing page for unauthenticated visitors. Root sites only (kind 15128) for v1 — named sites deferred.

</domain>

<decisions>
## Implementation Decisions

### Deploy Flow & UX
- All three file input methods: drag-drop zone, folder picker (showDirectoryPicker), and file picker for zip/tar.gz archives
- File review step shows expandable file tree with directory structure and file sizes
- SPA fallback toggle: checkbox "This is a single-page app" that maps index.html to /404.html in manifest
- Deploy progress uses multi-step indicator: Hashing files → Uploading blobs → Publishing manifest → Done, each step with its own progress
- After successful deploy: show link to site + deploy summary (files, manifest, servers used) + share options (copy URL, share on nostr, view manifest event)
- No site management — this is a deploy tool, not a dashboard

### Landing Page & Layout
- Single page: deploy section prominently at top, educational content scrolls below
- Fresh educational content (not ported from existing nsite.run components), more concise
- Dark theme consistent with current nsite.run (dark gray/purple palette, Tailwind CSS)
- Port tools-resources.yaml from ~/Develop/nsite.run for the links/resources section (SPA-12)
- Root sites only for v1 (kind 15128) — named site support deferred

### Auth & Identity
- **Anonymous deploy is the default** — generate ephemeral keypair in-browser, deploy immediately, show npub + site URL
- After anonymous deploy: show nsec with copy-to-clipboard button so user can save for future updates
- Big "Deploy" button/drop zone visible immediately; small "Login with your identity" link as secondary option
- Login button in top-right navbar
- Two login options: "Extension" (NIP-07) and "Remote Signer" (NIP-46)
- NIP-46 flow: immediately generate NostrConnect QR code (in-browser QR library) in addition to bunker URI input
- NIP-46 uses ephemeral keypair per session
- After login: show avatar + display name + truncated npub (fetch kind 0 profile)
- Session persists across page reloads (localStorage)
- Use applesauce-signers library for NIP-07 + NIP-46 signing

### Server Configuration
- Always publish manifest to wss://nsite.run relay AND upload blobs to nsite.run blossom
- Also publish to user's outbox relays (NIP-65 kind 10002) and user's blossom server list (kind 10063)
- Expandable "Advanced" section (collapsed by default) for adding additional relay and blossom server URLs
- Power users find the advanced config; casual users never see it

### Secret Scanning
- Client-side only — all scanning in browser before upload, no files touch server until approved
- Dangerous filenames (.env, id_rsa, *.pem, etc.): warn with override — user can exclude or proceed
- Content regex patterns (API keys, tokens): same behavior — warn with override
- Port scanning patterns from nsyte (~/Develop/nsyte) as baseline
- Flagged files get inline warning icons in the file tree with click-to-see-why detail and checkbox to exclude/include
- .git/, .svn/, .hg/ directories: auto-exclude with notice ("Excluded 142 files from .git/")

### Claude's Discretion
- Exact Svelte component structure and routing
- Tailwind config and exact color palette within dark theme
- QR code library selection
- Archive extraction approach (zip/tar.gz in browser)
- Exact secret scanning regex patterns (ported from nsyte, adjusted as needed)
- Educational content copy and structure
- Error state handling and edge cases

</decisions>

<specifics>
## Specific Ideas

- Anonymous deploy should feel instant — land on page, drop files, deploy. Zero friction.
- NIP-46 remote signer should immediately show a QR code, not just a text input for bunker URI
- The "Advanced" server config should not distract from the simple default flow
- Success state should make sharing easy — copy URL, share on nostr

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools-resources.yaml` from ~/Develop/nsite.run: categorized list of gateways, deploy tools, management tools, blossom servers, relays, informational resources
- `packages/shared`: nostr types, event verification, constants (NsiteKind.ROOT_SITE = 15128)
- `apps/gateway/src/router.ts`: already routes root domain to SPA stub (handleSpaStub)
- nsyte's secret scanning patterns (~/Develop/nsyte): battle-tested filename and content regex patterns

### Established Patterns
- Monorepo with Deno + esbuild: SPA would be a new app under apps/spa or similar
- BunnySDK Edge Scripting for server-side (relay, blossom, gateway)
- SPA is client-side Svelte, served as static files by gateway — different build pipeline (Vite, not esbuild)
- Existing nsite.run uses Svelte + Vite + Tailwind CSS

### Integration Points
- Gateway router.ts handleSpaStub → needs to serve the built SPA files
- Gateway relay at wss://nsite.run → SPA publishes manifest events here
- Gateway blossom at nsite.run → SPA uploads blobs here
- applesauce-signers for NIP-07/NIP-46 → new dependency for the SPA

</code_context>

<deferred>
## Deferred Ideas

- Named site support (kind 35128 with identifier) — future enhancement
- Site management dashboard (view current files, last deploy) — separate phase
- Server-side secret scanning as defense-in-depth — v2

</deferred>

---

*Phase: 06-spa-deploy-interface*
*Context gathered: 2026-03-17*

---
phase: quick
plan: 260325-ooz
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/spa/src/components/NIP5ABanner.svelte
  - apps/spa/src/App.svelte
autonomous: true
requirements: []

must_haves:
  truths:
    - "Banner is visible at the top of the page on first visit"
    - "Banner links to https://github.com/nostr-protocol/nips/blob/master/5A.md"
    - "Clicking the X button dismisses the banner"
    - "After dismissal, banner does not reappear on reload or navigation"
    - "Banner style is celebratory but consistent with the dark slate/purple theme"
  artifacts:
    - path: "apps/spa/src/components/NIP5ABanner.svelte"
      provides: "Dismissable celebration banner component"
      exports: []
    - path: "apps/spa/src/App.svelte"
      provides: "Banner mounted above Navbar or just below it"
  key_links:
    - from: "apps/spa/src/App.svelte"
      to: "apps/spa/src/components/NIP5ABanner.svelte"
      via: "import and mount in template"
    - from: "apps/spa/src/components/NIP5ABanner.svelte"
      to: "localStorage"
      via: "localStorage.getItem/setItem('nip5a-banner-dismissed')"
---

<objective>
Add a dismissable celebration banner to the nsite.run SPA announcing that NIP-5A (Static Websites) was merged into the nostr NIPs repo.

Purpose: Celebrate the milestone with existing and new users visiting the site.
Output: NIP5ABanner.svelte component mounted in App.svelte, dismissal persisted to localStorage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@apps/spa/src/App.svelte
@apps/spa/src/app.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create NIP5ABanner component</name>
  <files>apps/spa/src/components/NIP5ABanner.svelte</files>
  <action>
    Create a self-contained Svelte component that:

    1. On mount, reads localStorage key `nip5a-banner-dismissed`. If `'true'`, set `visible = false` immediately (no flicker — use onMount to set after hydration, keeping initial `let visible = true` but immediately reassigning in onMount so Svelte doesn't render it before the check).

    Actually, to avoid a flash: initialize `let visible = false`, then in onMount set `visible = localStorage.getItem('nip5a-banner-dismissed') !== 'true'`.

    2. Dismiss handler: sets localStorage `nip5a-banner-dismissed = 'true'`, sets `visible = false`.

    3. Template (only render when `visible`): use `transition:fade={{ duration: 200 }}` from `svelte/transition`.

    Banner layout — full-width strip, position above or just inside the main container. Use these Tailwind classes for style:
    - Background: `bg-purple-950/60 border-b border-purple-700/50` (subtle, not garish)
    - Container: `w-full px-4 py-2.5 flex items-center justify-center gap-3 text-sm`
    - Left icon: a small star or sparkle — use a Unicode character `✦` in a `text-purple-300` span, or an inline SVG star
    - Text: `text-purple-100` with content: `NIP-5A (Static Websites) has been merged into the nostr NIPs!`
    - Link: `<a href="https://github.com/nostr-protocol/nips/blob/master/5A.md" target="_blank" rel="noopener noreferrer" class="underline text-purple-300 hover:text-purple-100 font-medium">Read the NIP</a>`
    - Dismiss button: absolutely positioned or flex-end `ml-auto`. Use an X button: `<button on:click={dismiss} class="ml-auto p-1 text-purple-400 hover:text-purple-100 transition-colors" aria-label="Dismiss">` with an inline SVG X icon (w-4 h-4).

    Full component structure:
    ```
    <script>
      import { onMount } from 'svelte';
      import { fade } from 'svelte/transition';

      const STORAGE_KEY = 'nip5a-banner-dismissed';

      let visible = false;

      onMount(() => {
        visible = localStorage.getItem(STORAGE_KEY) !== 'true';
      });

      function dismiss() {
        localStorage.setItem(STORAGE_KEY, 'true');
        visible = false;
      }
    </script>

    {#if visible}
      <div transition:fade={{ duration: 200 }} class="w-full bg-purple-950/60 border-b border-purple-700/50">
        <div class="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">
          <span class="text-purple-300 flex-shrink-0">✦</span>
          <span class="text-purple-100 flex-1">
            <strong class="text-purple-200">NIP-5A</strong> (Static Websites) has been merged into the nostr NIPs!
            <a href="https://github.com/nostr-protocol/nips/blob/master/5A.md"
               target="_blank"
               rel="noopener noreferrer"
               class="underline text-purple-300 hover:text-purple-100 font-medium ml-1">Read the NIP →</a>
          </span>
          <button on:click={dismiss} class="flex-shrink-0 p-1 text-purple-400 hover:text-purple-100 transition-colors rounded" aria-label="Dismiss">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    {/if}
    ```
  </action>
  <verify>File exists at apps/spa/src/components/NIP5ABanner.svelte with the component code above</verify>
  <done>Component created with localStorage-backed dismissal, fade transition, purple theme styling, and link to NIP-5A</done>
</task>

<task type="auto">
  <name>Task 2: Mount NIP5ABanner in App.svelte</name>
  <files>apps/spa/src/App.svelte</files>
  <action>
    1. Add import at the top of the `<script>` block alongside other component imports (around line 30-39):
       `import NIP5ABanner from './components/NIP5ABanner.svelte';`

    2. In the template, find the outer `<div class="min-h-screen bg-slate-900 text-gray-100">` wrapper (around line 579). Insert `<NIP5ABanner />` immediately after that opening div and before `<Navbar .../>`, so the banner appears as the topmost element:

    ```svelte
    <div class="min-h-screen bg-slate-900 text-gray-100">

      <NIP5ABanner />

      <Navbar
        onLoginClick={() => (showLoginModal = true)}
        {deployNsec}
      />
    ```

    No other changes needed — the banner is fully self-contained.
  </action>
  <verify>
    <automated>cd /home/sandwich/Develop/nsite.run && grep -n "NIP5ABanner" apps/spa/src/App.svelte</automated>
  </verify>
  <done>NIP5ABanner imported and rendered as the first child of the app shell div, appearing above the Navbar on all pages</done>
</task>

</tasks>

<verification>
- Run `cd /home/sandwich/Develop/nsite.run && npm run build --workspace=apps/spa` (or the project's SPA build command) and confirm no TypeScript/Svelte compile errors
- Visually: banner appears at top, purple theme, X dismisses it, localStorage key `nip5a-banner-dismissed` is set to `'true'` after dismiss, banner absent on reload
</verification>

<success_criteria>
- NIP5ABanner.svelte exists and compiles without errors
- Banner renders above Navbar on first visit
- X button dismisses with fade animation and sets localStorage
- Page reload after dismissal shows no banner
- Link opens https://github.com/nostr-protocol/nips/blob/master/5A.md in new tab
- Style is dark purple/slate, not garish
</success_criteria>

<output>
After completion, create `.planning/quick/260325-ooz-add-dismissable-nip-5a-celebration-banne/260325-ooz-SUMMARY.md`
</output>

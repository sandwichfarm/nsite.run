<script>
  /**
   * Props:
   *   event         - signed manifest nostr event
   *   npub          - user's npub (bech32)
   *   nsec          - nsec string (only present for anonymous deploys)
   *   signerType    - 'anonymous' | 'extension' | 'nostrconnect'
   *   uploadResult  - { uploaded, skipped, failed } from uploadAllBlobs
   *   publishResult - { event, results } from publishManifest
   */
  export let event = null;
  export let npub = '';
  export let nsec = null;
  export let signerType = null;
  export let uploadResult = null;
  export let givenUpServers = new Set();
  export let publishResult = null;

  let manifestExpanded = false;
  let nsecCopied = false;
  let urlCopied = false;

  import { NSITE_BLOSSOM } from '../lib/nostr.js';
  import ActivityRings from './ActivityRings.svelte';

  // Derive gateway domain from NSITE_BLOSSOM (auto-detected or VITE_ override)
  $: gatewayHost = (() => {
    try { return new URL(NSITE_BLOSSOM).host; } catch { return 'nsite.run'; }
  })();
  // SECURITY: never construct a URL with nsec — only npub
  $: siteUrl = (npub && npub.startsWith('npub1')) ? `https://${npub}.${gatewayHost}` : '';

  async function copyUrl() {
    if (!siteUrl) return;
    await navigator.clipboard.writeText(siteUrl);
    urlCopied = true;
    setTimeout(() => (urlCopied = false), 2000);
  }

  async function copyNsec() {
    if (!nsec) return;
    await navigator.clipboard.writeText(nsec);
    nsecCopied = true;
    setTimeout(() => (nsecCopied = false), 2000);
  }

  function shareOnNostr() {
    const text = `I just deployed my site to the decentralized web! Check it out: ${siteUrl} #nsite`;
    const url = `https://njump.me/intent?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  }

  function truncateEventId(id) {
    if (!id) return '';
    return id.slice(0, 8) + '...' + id.slice(-6);
  }
</script>

<div class="bg-slate-800 rounded-lg p-6 border border-green-700/40">
  <!-- Success header -->
  <div class="flex items-center gap-3 mb-6">
    <div class="w-10 h-10 rounded-full bg-green-800/60 flex items-center justify-center">
      <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <div>
      <h2 class="text-xl font-semibold text-white">Site deployed!</h2>
      <p class="text-sm text-slate-400">Your site is now live on the decentralized web.</p>
    </div>
  </div>

  <!-- Site URL -->
  {#if siteUrl}
    <div class="mb-5 p-4 bg-slate-900/60 rounded-lg border border-slate-600">
      <p class="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Your site URL</p>
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="text-purple-400 hover:text-purple-300 font-mono text-sm break-all transition-colors"
      >
        {siteUrl}
      </a>
    </div>
  {/if}

  <!-- Activity Rings -->
  {#if uploadResult?.serverProgress && Object.keys(uploadResult.serverProgress).length > 0}
    <div class="mb-5 p-4 bg-slate-900/60 rounded-lg border border-slate-600">
      <ActivityRings
        serverProgress={uploadResult.serverProgress}
        totalFiles={uploadResult.total ?? 0}
        {givenUpServers}
      />
    </div>
  {/if}

  <!-- Deploy summary -->
  <div class="mb-5 grid grid-cols-3 gap-3 text-center">
    {#if uploadResult}
      <div class="bg-slate-700/50 rounded-lg p-3">
        <p class="text-2xl font-bold text-white">{uploadResult.uploaded ?? 0}</p>
        <p class="text-xs text-slate-400">Uploaded</p>
      </div>
      <div class="bg-slate-700/50 rounded-lg p-3">
        <p class="text-2xl font-bold text-slate-300">{uploadResult.alreadyExist ?? 0}</p>
        <p class="text-xs text-slate-400">Already exist</p>
      </div>
      <div class="bg-slate-700/50 rounded-lg p-3">
        <p class="text-2xl font-bold {(uploadResult.failed ?? 0) > 0 ? 'text-red-400' : 'text-slate-300'}">{uploadResult.failed ?? 0}</p>
        <p class="text-xs text-slate-400">Failed</p>
      </div>
    {/if}
  </div>

  <!-- Event ID -->
  {#if event?.id}
    <p class="text-xs text-slate-500 mb-5">
      Manifest event: <span class="font-mono text-slate-400">{truncateEventId(event.id)}</span>
    </p>
  {/if}

  <!-- Share buttons -->
  <div class="flex flex-wrap gap-2 mb-5">
    <button
      on:click={copyUrl}
      class="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
    >
      {#if urlCopied}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Copied!
      {:else}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy URL
      {/if}
    </button>

    <button
      on:click={shareOnNostr}
      class="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      Share on nostr
    </button>

    {#if event}
      <button
        on:click={() => (manifestExpanded = !manifestExpanded)}
        class="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <svg class="w-4 h-4 transition-transform {manifestExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        View Manifest
      </button>
    {/if}
  </div>

  <!-- Manifest JSON (expandable) -->
  {#if manifestExpanded && event}
    <div class="mb-5 p-4 bg-slate-900 rounded-lg border border-slate-600 overflow-x-auto">
      <pre class="text-xs text-slate-300 font-mono whitespace-pre-wrap">{JSON.stringify(event, null, 2)}</pre>
    </div>
  {/if}

  <!-- Anonymous deploy: nsec display -->
  {#if signerType === 'anonymous' && nsec}
    <div class="p-4 bg-amber-900/30 border border-amber-600/50 rounded-lg">
      <div class="flex items-start gap-2 mb-3">
        <svg class="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-amber-300 text-sm font-medium">Save this key! You need it to update your site later.</p>
      </div>
      <p class="text-xs text-amber-400/80 mb-2">Your site was deployed with an anonymous identity. This is your private key:</p>
      <div class="flex items-center gap-2">
        <code class="flex-1 text-xs font-mono text-amber-200 bg-slate-900 px-3 py-2 rounded border border-amber-700/40 break-all">
          {nsec}
        </code>
        <button
          on:click={copyNsec}
          class="flex-shrink-0 px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-medium transition-colors"
        >
          {nsecCopied ? 'Copied!' : 'Copy nsec'}
        </button>
      </div>
    </div>
  {/if}
</div>

<script>
  import { createEventDispatcher } from 'svelte';
  import { publishDeletionEvent } from '../lib/publish.js';
  import { deleteBlobs } from '../lib/upload.js';
  import { base36Encode } from '../lib/base36.js';
  import { hexToBytes } from 'nostr-tools/utils';
  import { npubEncode } from 'nostr-tools/nip19';
  import { getManifestDTag, getManifestTitle, getManifestDescription, NSITE_GATEWAY_HOST, NSITE_GATEWAY_PROTOCOL } from '../lib/nostr.js';

  const dispatch = createEventDispatcher();

  export let sites = { root: null, named: [] }; // { root: event|null, named: event[] }
  export let pubkey = ''; // hex pubkey for URL generation
  export let relayUrls = [];
  export let blossomUrls = [];
  export let signer = null;

  // Internal state machine: idle | confirm | deleting | done
  let deleteState = 'idle';

  // Which site is being deleted
  let deletingSite = null;

  // Deletion progress
  let deleteStep = 'relays'; // 'relays' | 'blobs' | 'done'
  let relayProgress = 0; // 0-100
  let relayDetails = '';
  let blobProgress = null; // { completed, total, serverResults }
  let deleteResults = null; // { relayResults, blossomResults }
  let deleteError = '';

  // Which card is expanded
  let expandedSiteId = null;
  let copiedSiteId = null;

  // Step pill definitions for deletion
  const DELETE_STEPS = [
    { id: 'relays', label: 'Relays' },
    { id: 'blobs', label: 'Blobs' },
    { id: 'done', label: 'Done' },
  ];

  $: currentIdx = DELETE_STEPS.findIndex((s) => s.id === deleteStep);
  $: stepStates = DELETE_STEPS.map((s, i) => {
    if (deleteStep === 'done') return 'complete';
    if (i < currentIdx) return 'complete';
    if (i === currentIdx) return 'current';
    return 'future';
  });

  // Blob count for site being deleted
  $: deletingBlobCount = deletingSite ? [...new Set(
    deletingSite.tags
      .filter(t => t[0] === 'path' && t[2])
      .map(t => t[2])
  )].length : 0;

  // Flat site list: root first, then named
  $: siteList = [
    ...(sites.root ? [sites.root] : []),
    ...sites.named,
  ];

  // Server colors (same as ProgressIndicator)
  const SERVER_COLORS = [
    'text-purple-400', 'text-cyan-400', 'text-amber-400', 'text-pink-400',
    'text-lime-400', 'text-blue-400', 'text-orange-400', 'text-teal-400',
  ];

  function shortUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  function formatDate(date) {
    if (!date) return 'Unknown';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function siteUrl(manifest) {
    if (!pubkey) return '';
    if (manifest.kind === 35128) {
      const dTag = getManifestDTag(manifest) || '';
      try {
        const encoded = base36Encode(hexToBytes(pubkey));
        return `${NSITE_GATEWAY_PROTOCOL}://${encoded}${dTag}.${NSITE_GATEWAY_HOST}`;
      } catch { return ''; }
    }
    // Root site
    try {
      const npub = npubEncode(pubkey);
      return `${NSITE_GATEWAY_PROTOCOL}://${npub}.${NSITE_GATEWAY_HOST}`;
    } catch { return ''; }
  }

  function siteLabel(manifest) {
    if (manifest.kind === 35128) {
      return `Named: ${getManifestDTag(manifest) || '?'}`;
    }
    return 'Root';
  }

  function siteFileCount(manifest) {
    return manifest.tags.filter(t => t[0] === 'path').length;
  }

  function siteBlobCount(manifest) {
    return [...new Set(manifest.tags.filter(t => t[0] === 'path' && t[2]).map(t => t[2]))].length;
  }

  function siteDate(manifest) {
    return manifest.created_at ? new Date(manifest.created_at * 1000) : null;
  }

  function toggleExpand(eventId) {
    expandedSiteId = expandedSiteId === eventId ? null : eventId;
  }

  function startDelete(site) {
    deletingSite = site;
    deleteState = 'confirm';
    deleteError = '';
  }

  function cancelDelete() {
    deletingSite = null;
    deleteState = 'idle';
    deleteError = '';
    dispatch('delete-end', { cancelled: true });
  }

  // Compute bar segments for a blossom server during deletion
  function serverBarSegments(sr) {
    if (!sr) return { green: 0, red: 0, gray: 100 };
    const perServer = Math.ceil((blobProgress?.total ?? 0) / blossomUrls.length);
    if (perServer === 0) return { green: 0, red: 0, gray: 100 };
    const green = Math.round((sr.deleted / perServer) * 100);
    const red = Math.round((sr.failed / perServer) * 100);
    const gray = Math.max(0, 100 - green - red);
    return { green, red, gray };
  }

  async function handleConfirmDelete() {
    if (deleteState === 'deleting') return;
    if (!signer) {
      deleteError = 'No signer available. Please log in again.';
      return;
    }
    if (!deletingSite) {
      deleteError = 'No site selected for deletion.';
      return;
    }
    deleteError = '';
    deleteState = 'deleting';
    dispatch('delete-start');
    deleteStep = 'relays';
    relayProgress = 0;
    blobProgress = null;
    deleteResults = null;

    try {
      const relays = relayUrls;
      const blossoms = blossomUrls;
      const dTag = deletingSite.kind === 35128 ? getManifestDTag(deletingSite) : undefined;

      console.log('[delete] signer:', !!signer, 'site.id:', deletingSite?.id, 'kind:', deletingSite?.kind, 'dTag:', dTag);
      console.log('[delete] relays:', relays.length, 'blossoms:', blossoms.length, 'path tags:', deletingSite?.tags?.filter(t => t[0] === 'path')?.length);

      // Publish kind 5 deletion event (NIP-09) to all relays
      // Don't publish empty manifest — it creates a lingering empty event that some relays serve
      console.log('[delete] publishing deletion event for event:', deletingSite.id);
      relayDetails = 'Publishing deletion event...';
      relayProgress = 0;
      const deletionResult = await publishDeletionEvent(signer, deletingSite.id, relays);
      console.log('[delete] deletion done:', deletionResult.results.map(r => `${r.relay}: ${r.success}`));
      relayProgress = 100;

      const relayResults = deletionResult.results.map(r => ({
        relay: r.relay,
        success: r.success,
        message: r.success ? 'deletion event sent' : r.message ?? 'failed',
      }));

      // 3. Delete blobs from blossom servers
      deleteStep = 'blobs';
      const sha256List = [...new Set(
        deletingSite.tags
          .filter(t => t[0] === 'path' && t[2])
          .map(t => t[2])
      )];

      let blossomResults = [];
      if (sha256List.length > 0) {
        blobProgress = { completed: 0, total: sha256List.length * blossoms.length, serverResults: {} };
        const blobResult = await deleteBlobs(signer, sha256List, blossoms, (p) => {
          blobProgress = { completed: p.completed, total: p.total, serverResults: p.serverResults };
        });
        blossomResults = blobResult.results;
      }

      // Done — success
      console.log('[delete] all steps complete');
      deleteStep = 'done';
      deleteState = 'done';
      deleteResults = { relayResults, blossomResults };
      dispatch('delete-end', { success: true });

    } catch (err) {
      console.error('[delete] ERROR:', err);
      deleteStep = 'done';
      deleteState = 'done';
      deleteResults = {
        relayResults: [{ relay: 'error', success: false, message: err?.message ?? 'Unexpected error' }],
        blossomResults: [],
      };
      dispatch('delete-end', { success: false });
    }
  }

  function handleBackToDeploy() {
    deletingSite = null;
    deleteState = 'idle';
    dispatch('deleted');
  }
</script>

<div>

  {#if deleteState === 'idle'}
    <!-- ===== IDLE: Multi-site card list ===== -->

    {#if siteList.length === 0}
      <!-- Empty state -->
      <div class="bg-slate-800 rounded-lg p-6 text-center">
        <p class="text-slate-400">No sites published yet.</p>
        <p class="text-sm text-slate-500 mt-1">Deploy your first site to see it here.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each siteList as site (site.id)}
          <div class="bg-slate-800 rounded-lg overflow-hidden">
            <!-- Card header: clickable to expand -->
            <button
              on:click={() => toggleExpand(site.id)}
              class="w-full p-4 text-left flex items-center gap-3 hover:bg-slate-700/50 transition-colors"
            >
              <!-- Site type badge -->
              <span class="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0
                {site.kind === 35128 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}">
                {siteLabel(site)}
              </span>
              <span class="flex-1"></span>
              <!-- Expand chevron -->
              <svg
                class="w-4 h-4 text-slate-400 transition-transform flex-shrink-0 {expandedSiteId === site.id ? 'rotate-180' : ''}"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Expanded section -->
            {#if expandedSiteId === site.id}
              {@const url = siteUrl(site)}
              <div class="px-4 pb-4 border-t border-slate-700">
                <!-- URL with copy button -->
                <div class="flex items-center gap-2 mt-3 mb-3">
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    class="font-mono text-sm text-purple-400 hover:text-purple-300 break-all flex-1 transition-colors"
                  >{url}</a>
                  <button
                    on:click={() => { navigator.clipboard.writeText(url); copiedSiteId = site.id; setTimeout(() => { copiedSiteId = null; }, 2000); }}
                    class="flex-shrink-0 px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    {copiedSiteId === site.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <!-- Stats row -->
                <div class="flex flex-wrap gap-4 text-sm text-slate-400 mb-4">
                  <span class="flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Published {formatDate(siteDate(site))}
                  </span>
                  <span class="flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {siteFileCount(site)} files
                  </span>
                  {#if getManifestTitle(site)}
                    <span class="italic text-slate-400">{getManifestTitle(site)}</span>
                  {/if}
                </div>

                <!-- Action buttons -->
                <div class="flex gap-3">
                  <button
                    on:click={() => dispatch('update', site)}
                    class="bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium px-5 py-2.5 transition-colors"
                  >
                    Update Site
                  </button>
                  <button
                    on:click={() => startDelete(site)}
                    class="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2.5 transition-colors"
                  >
                    Delete Site
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  {:else if deleteState === 'confirm'}
    <!-- ===== CONFIRM: Scope summary ===== -->
    <div class="bg-slate-800 rounded-lg p-6">
      <!-- Which site is being deleted -->
      {#if deletingSite}
        <div class="flex items-center gap-2 mb-4">
          <span class="px-2 py-0.5 rounded text-xs font-medium
            {deletingSite.kind === 35128 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}">
            {siteLabel(deletingSite)}
          </span>
          <span class="font-mono text-sm text-slate-300 truncate">{siteUrl(deletingSite)}</span>
        </div>
      {/if}

      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-white">Delete this site</h2>
      </div>

      <!-- Scope summary -->
      <p class="text-slate-300 text-sm mb-4">
        This will delete the site from
        <span class="text-white font-medium">{relayUrls.length} relay{relayUrls.length !== 1 ? 's' : ''}</span>
        and attempt to remove
        <span class="text-white font-medium">{deletingBlobCount} blob{deletingBlobCount !== 1 ? 's' : ''}</span>
        from
        <span class="text-white font-medium">{blossomUrls.length} blossom server{blossomUrls.length !== 1 ? 's' : ''}</span>.
      </p>

      <!-- Server lists -->
      <div class="space-y-3 mb-6">
        <div>
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Relays:</p>
          <ul class="space-y-1">
            {#each relayUrls as relay}
              <li class="text-xs font-mono text-slate-400 break-all">{relay}</li>
            {/each}
          </ul>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Blossom servers:</p>
          <ul class="space-y-1">
            {#each blossomUrls as server}
              <li class="text-xs font-mono text-slate-400 break-all">{server}</li>
            {/each}
          </ul>
        </div>
      </div>

      {#if deleteError}
        <p class="text-sm text-red-400 mb-3">{deleteError}</p>
      {/if}

      <!-- Action buttons -->
      <div class="flex gap-3 pt-4 border-t border-slate-700">
        <button
          on:click={cancelDelete}
          class="flex-1 px-4 py-2.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          Cancel
        </button>
        <button
          on:click={handleConfirmDelete}
          class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Delete this site
        </button>
      </div>
    </div>

  {:else if deleteState === 'deleting'}
    <!-- ===== DELETING: Multi-step progress ===== -->
    <div class="bg-slate-800 rounded-lg p-6">
      {#if deletingSite}
        <div class="flex items-center gap-2 mb-4">
          <span class="px-2 py-0.5 rounded text-xs font-medium
            {deletingSite.kind === 35128 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}">
            {siteLabel(deletingSite)}
          </span>
          <span class="font-mono text-sm text-slate-400 truncate">{siteUrl(deletingSite)}</span>
        </div>
      {/if}

      <h2 class="text-xl font-semibold text-white mb-4">Deleting site...</h2>

      <!-- Step pills (same pattern as ProgressIndicator) -->
      <div class="flex flex-wrap gap-2 mb-6">
        {#each DELETE_STEPS as s, i}
          {@const state = stepStates[i]}
          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              {state === 'complete' ? 'bg-green-800/60 text-green-300' : ''}
              {state === 'current' ? 'bg-red-700/60 text-red-200 ring-1 ring-red-500' : ''}
              {state === 'future' ? 'bg-slate-700 text-slate-400' : ''}"
          >
            {#if state === 'complete'}
              <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            {:else if state === 'current'}
              <svg class="w-3.5 h-3.5 text-red-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            {:else}
              <div class="w-3.5 h-3.5 rounded-full border border-slate-500" />
            {/if}
            {s.label}
          </div>
        {/each}
      </div>

      {#if deleteStep === 'relays'}
        <!-- Relay publishing progress -->
        <div class="mb-3">
          <div class="flex justify-between text-xs text-slate-400 mb-1">
            <span>{relayDetails || 'Publishing to relays...'}</span>
            <span>{Math.round(relayProgress)}%</span>
          </div>
          <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div class="bg-red-500 h-2 rounded-full transition-all duration-300" style="width: {relayProgress}%" />
          </div>
        </div>

      {:else if deleteStep === 'blobs'}
        <!-- Blob deletion: overall + per-server bars -->
        {#if blobProgress}
          {@const overallPct = blobProgress.total > 0 ? Math.round((blobProgress.completed / blobProgress.total) * 100) : 0}
          {@const totalCompleted = Object.values(blobProgress.serverResults).reduce((sum, sr) => sum + sr.deleted, 0)}
          {@const totalFailed = Object.values(blobProgress.serverResults).reduce((sum, sr) => sum + sr.failed, 0)}
          {@const greenPct = blobProgress.total > 0 ? Math.round((totalCompleted / blobProgress.total) * 100) : 0}
          {@const redPct = blobProgress.total > 0 ? Math.round((totalFailed / blobProgress.total) * 100) : 0}

          <!-- Overall bar -->
          <div class="mb-4">
            <div class="flex justify-between text-xs text-slate-400 mb-1">
              <span>{blobProgress.completed}/{blobProgress.total} blob operations</span>
              <span>{overallPct}%</span>
            </div>
            <div class="w-full h-3 bg-slate-700 rounded-full overflow-hidden flex">
              {#if greenPct > 0}
                <div class="bg-green-500 transition-all duration-300" style="width: {greenPct}%"></div>
              {/if}
              {#if redPct > 0}
                <div class="bg-red-500 transition-all duration-300" style="width: {redPct}%"></div>
              {/if}
            </div>
          </div>

          <!-- Per-server bars -->
          {#if blobProgress.serverResults}
            <div class="space-y-2 mb-4">
              {#each Object.entries(blobProgress.serverResults) as [url, sr], i}
                {@const seg = serverBarSegments(sr)}
                <div>
                  <div class="flex items-center gap-2 text-xs mb-0.5">
                    <span class="{SERVER_COLORS[i % SERVER_COLORS.length]} font-medium">{shortUrl(url)}</span>
                    <span class="text-slate-500 ml-auto">
                      {sr.deleted + sr.failed}/{Math.ceil(blobProgress.total / blossomUrls.length)}
                      {#if sr.deleted > 0}
                        <span class="text-green-400">{sr.deleted} deleted</span>
                      {/if}
                      {#if sr.failed > 0}
                        <span class="text-red-400">{sr.failed} failed</span>
                      {/if}
                    </span>
                  </div>
                  <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
                    {#if seg.green > 0}
                      <div class="bg-green-500 transition-all duration-300" style="width: {seg.green}%"></div>
                    {/if}
                    {#if seg.red > 0}
                      <div class="bg-red-500 transition-all duration-300" style="width: {seg.red}%"></div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <p class="text-sm text-slate-400">Preparing blob deletion...</p>
        {/if}

      {:else if deleteStep === 'done'}
        <div class="flex items-center gap-2 text-green-400 mb-3">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="font-medium">Deletion complete!</span>
        </div>
      {/if}
    </div>

  {:else if deleteState === 'done' || (deleteState === 'deleting' && deleteStep === 'done')}
    <!-- ===== DONE: Results summary ===== -->
    <div class="bg-slate-800 rounded-lg p-6">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-full bg-green-900/50 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-white">Deletion complete</h2>
      </div>

      {#if deleteResults}
        <!-- Step pills showing all complete -->
        <div class="flex flex-wrap gap-2 mb-6">
          {#each DELETE_STEPS as s}
            <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-800/60 text-green-300">
              <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {s.label}
            </div>
          {/each}
        </div>

        <!-- Relay results -->
        {#if deleteResults.relayResults && deleteResults.relayResults.length > 0}
          <div class="mb-4">
            <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Relays:</p>
            <ul class="space-y-1.5">
              {#each deleteResults.relayResults as r}
                <li class="flex items-start gap-2 text-xs">
                  {#if r.success}
                    <svg class="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {:else}
                    <svg class="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  {/if}
                  <span class="font-mono text-slate-400 break-all">{r.relay}</span>
                  {#if r.message}
                    <span class="text-slate-500 flex-shrink-0"> -- {r.message}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Blossom results -->
        {#if deleteResults.blossomResults && deleteResults.blossomResults.length > 0}
          <div class="mb-4">
            <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Blossom servers:</p>
            <ul class="space-y-1.5">
              {#each deleteResults.blossomResults as r}
                <li class="text-xs">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-slate-400 break-all">{r.server}</span>
                    {#if r.deleted > 0}
                      <span class="text-green-400 flex-shrink-0">{r.deleted} deleted</span>
                    {/if}
                    {#if r.failed > 0}
                      <span class="text-red-400 flex-shrink-0">{r.failed} failed</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}

      <!-- Back to sites button -->
      <div class="mt-5 pt-4 border-t border-slate-700">
        <button
          on:click={handleBackToDeploy}
          class="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Back to sites
        </button>
      </div>
    </div>
  {/if}

</div>

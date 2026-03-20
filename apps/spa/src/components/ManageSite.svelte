<script>
  import { createEventDispatcher } from 'svelte';
  import { publishEmptyManifest, publishDeletionEvent } from '../lib/publish.js';
  import { deleteBlobs } from '../lib/upload.js';

  const dispatch = createEventDispatcher();

  export let siteUrl = '';
  export let publishDate = null;
  export let fileCount = 0;
  export let relayUrls = [];
  export let blossomUrls = [];
  export let blobCount = 0;
  export let signer = null;
  export let manifest = null;

  // Internal state machine: idle | confirm | deleting | done
  let deleteState = 'idle';

  // Deletion progress
  let deleteStep = 'relays'; // 'relays' | 'blobs' | 'done'
  let relayProgress = 0; // 0-100
  let relayDetails = '';
  let blobProgress = null; // { completed, total, serverResults }
  let deleteResults = null; // { relayResults, blossomResults }

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

  // Compute bar segments for a blossom server during deletion
  function serverBarSegments(sr) {
    if (!sr) return { green: 0, red: 0, gray: 100 };
    const total = sr.deleted + sr.failed + Math.max(0, (blobProgress?.total ?? 0) / blossomUrls.length - sr.deleted - sr.failed);
    if (total === 0) return { green: 0, red: 0, gray: 100 };
    const perServer = Math.ceil((blobProgress?.total ?? 0) / blossomUrls.length);
    if (perServer === 0) return { green: 0, red: 0, gray: 100 };
    const green = Math.round((sr.deleted / perServer) * 100);
    const red = Math.round((sr.failed / perServer) * 100);
    const gray = Math.max(0, 100 - green - red);
    return { green, red, gray };
  }

  function handleUpdateClick() {
    dispatch('update');
  }

  function handleDeleteClick() {
    deleteState = 'confirm';
  }

  function handleCancelDelete() {
    deleteState = 'idle';
  }

  let deleteError = '';

  async function handleConfirmDelete() {
    if (!signer) {
      deleteError = 'No signer available. Please log in again.';
      return;
    }
    if (!manifest) {
      deleteError = 'No manifest found. Nothing to delete.';
      return;
    }
    deleteError = '';
    deleteState = 'deleting';
    deleteStep = 'relays';
    relayProgress = 0;
    blobProgress = null;
    deleteResults = null;

    try {
      const relays = relayUrls;
      const blossoms = blossomUrls;

      // 1. Publish empty manifest to all relays
      relayDetails = 'Publishing empty manifest...';
      relayProgress = 0;
      const emptyResult = await publishEmptyManifest(signer, relays);
      relayProgress = 50;

      // 2. Publish kind 5 deletion event
      relayDetails = 'Publishing deletion event...';
      const deletionResult = await publishDeletionEvent(signer, manifest.id, relays);
      relayProgress = 100;

      // Merge relay results
      const relayResults = emptyResult.results.map((r, i) => ({
        relay: r.relay,
        success: r.success,
        message: r.success
          ? (deletionResult.results[i]?.success ? 'manifest cleared + deletion event sent' : 'manifest cleared (deletion event failed)')
          : r.message ?? 'failed',
      }));

      // 3. Delete blobs from blossom servers
      deleteStep = 'blobs';
      const sha256List = [...new Set(
        manifest.tags
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

      // Done
      deleteStep = 'done';
      deleteResults = { relayResults, blossomResults };

    } catch (err) {
      deleteStep = 'done';
      deleteResults = {
        relayResults: [{ relay: 'error', success: false, message: err?.message ?? 'Unexpected error' }],
        blossomResults: [],
      };
    }
  }

  function handleBackToDeploy() {
    dispatch('deleted');
  }
</script>

<section class="max-w-2xl mx-auto px-4 py-10">

  {#if deleteState === 'idle'}
    <!-- ===== IDLE: Site info + action buttons ===== -->
    <div class="bg-slate-800 rounded-lg p-6">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-4">
        <div class="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></div>
        <h2 class="text-xl font-semibold text-white">Your published nsite</h2>
      </div>

      <!-- Site URL -->
      {#if siteUrl}
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="block text-purple-400 hover:text-purple-300 font-mono text-sm break-all transition-colors mb-4"
        >
          {siteUrl}
        </a>
      {/if}

      <!-- Stats row -->
      <div class="flex flex-wrap gap-4 text-sm text-slate-400 mb-6">
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Published {formatDate(publishDate)}
        </span>
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {fileCount} files
        </span>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-3">
        <button
          on:click={handleUpdateClick}
          class="bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium px-5 py-2.5 transition-colors"
        >
          Update Site
        </button>
        <button
          on:click={handleDeleteClick}
          class="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2.5 transition-colors"
        >
          Delete Site
        </button>
      </div>
    </div>

  {:else if deleteState === 'confirm'}
    <!-- ===== CONFIRM: Scope summary ===== -->
    <div class="bg-slate-800 rounded-lg p-6">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-white">Delete your nsite</h2>
      </div>

      <!-- Scope summary -->
      <p class="text-slate-300 text-sm mb-4">
        This will delete your nsite from
        <span class="text-white font-medium">{relayUrls.length} relay{relayUrls.length !== 1 ? 's' : ''}</span>
        and attempt to remove
        <span class="text-white font-medium">{blobCount} blob{blobCount !== 1 ? 's' : ''}</span>
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
          on:click={handleCancelDelete}
          class="flex-1 px-4 py-2.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          Cancel
        </button>
        <button
          on:click={handleConfirmDelete}
          class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Delete my nsite
        </button>
      </div>
    </div>

  {:else if deleteState === 'deleting'}
    <!-- ===== DELETING: Multi-step progress ===== -->
    <div class="bg-slate-800 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-white mb-4">Deleting your nsite...</h2>

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
        <!-- Done within deleting state — should transition to done deleteState -->
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

      <!-- Back to deploy button -->
      <div class="mt-5 pt-4 border-t border-slate-700">
        <button
          on:click={handleBackToDeploy}
          class="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Back to deploy
        </button>
      </div>
    </div>
  {/if}

</section>

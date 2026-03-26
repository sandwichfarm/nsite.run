<script>
  import { createEventDispatcher } from 'svelte';
  import { publishDeletionEvent } from '@nsite/deployer/publish';
  import { deleteBlobs } from '@nsite/deployer/upload';
  import { base36Encode } from '@nsite/deployer/base36';
  import { hexToBytes } from 'nostr-tools/utils';
  import { npubEncode } from 'nostr-tools/nip19';
  import { getManifestDTag, getManifestTitle, getManifestDescription, NSITE_GATEWAY_HOST, NSITE_GATEWAY_PROTOCOL } from '@nsite/deployer/nostr';

  const dispatch = createEventDispatcher();

  export let sites = { root: null, named: [] }; // { root: event|null, named: event[] }
  export let pubkey = ''; // hex pubkey for URL generation
  export let relayUrls = [];
  export let blossomUrls = [];
  export let signer = null;

  /**
   * Per-card delete state.
   * @type {Map<string, {
   *   site: object,
   *   phase: 'confirm' | 'deleting' | 'success' | 'failure',
   *   step: 'relays' | 'blobs' | null,
   *   relayProgress: number,
   *   relayDetails: string,
   *   blobProgress: object | null,
   *   results: object | null,
   *   error: string
   * }>}
   */
  let deletingCards = new Map();

  // Svelte 4 Map reactivity: reassign on every change
  function updateCard(siteId, updates) {
    const card = deletingCards.get(siteId);
    if (card) {
      Object.assign(card, updates);
      deletingCards = new Map(deletingCards);
    }
  }

  function removeCard(siteId) {
    deletingCards.delete(siteId);
    deletingCards = new Map(deletingCards);
  }

  // Which card is expanded
  let expandedSiteId = null;
  let copiedSiteId = null;

  // Step pill definitions for deletion
  const DELETE_STEPS = [
    { id: 'relays', label: 'Relays' },
    { id: 'blobs', label: 'Blobs' },
    { id: 'done', label: 'Done' },
  ];

  function getStepStates(step) {
    const idx = DELETE_STEPS.findIndex(s => s.id === step);
    return DELETE_STEPS.map((s, i) => {
      if (step === 'done' || step === null) return 'complete';
      if (i < idx) return 'complete';
      if (i === idx) return 'current';
      return 'future';
    });
  }

  function getBlobCount(site) {
    return [...new Set(
      site.tags
        .filter(t => t[0] === 'path' && t[2])
        .map(t => t[2])
    )].length;
  }

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
    expandedSiteId = null; // collapse any expanded card
    deletingCards.set(site.id, {
      site,
      phase: 'confirm',
      step: null,
      relayProgress: 0,
      relayDetails: '',
      blobProgress: null,
      results: null,
      error: '',
    });
    deletingCards = new Map(deletingCards);
  }

  function cancelDelete(siteId) {
    removeCard(siteId);
  }

  function animateCardExit(siteId, site) {
    // Phase 1: opacity fade starts immediately via card-exit-fade CSS class

    // Phase 2: after fade, collapse height
    setTimeout(() => {
      updateCard(siteId, { _collapsing: true });
    }, 600);

    // Phase 3: after collapse, remove and notify
    setTimeout(() => {
      removeCard(siteId);
      dispatch('site-removed', site);
      dispatch('deleted');
    }, 900);
  }

  let activeDeleteCount = 0;

  async function handleConfirmDelete(siteId) {
    const card = deletingCards.get(siteId);
    if (!card || card.phase === 'deleting') return;
    if (!signer) {
      updateCard(siteId, { error: 'No signer available. Please log in again.' });
      return;
    }

    updateCard(siteId, {
      phase: 'deleting',
      step: 'relays',
      relayProgress: 0,
      blobProgress: null,
      results: null,
      error: '',
    });

    activeDeleteCount++;
    if (activeDeleteCount === 1) {
      dispatch('delete-start');
    }

    try {
      const site = card.site;
      const relays = relayUrls;
      const blossoms = blossomUrls;

      // 1. Publish NIP-09 deletion event
      updateCard(siteId, { relayDetails: 'Publishing deletion event...' });
      const deletionResult = await publishDeletionEvent(signer, site.id, relays);
      updateCard(siteId, { relayProgress: 100 });

      const relayResults = deletionResult.results.map(r => ({
        relay: r.relay,
        success: r.success,
        message: r.success ? 'deletion event sent' : r.message ?? 'failed',
      }));

      // 2. Delete blobs
      updateCard(siteId, { step: 'blobs' });
      const sha256List = [...new Set(
        site.tags.filter(t => t[0] === 'path' && t[2]).map(t => t[2])
      )];

      let blossomResults = [];
      if (sha256List.length > 0) {
        updateCard(siteId, { blobProgress: { completed: 0, total: sha256List.length * blossoms.length, serverResults: {} } });
        const blobResult = await deleteBlobs(signer, sha256List, blossoms, (p) => {
          updateCard(siteId, { blobProgress: { completed: p.completed, total: p.total, serverResults: p.serverResults } });
        });
        blossomResults = blobResult.results;
      }

      // 3. Determine success vs failure
      const anyRelaySuccess = relayResults.some(r => r.success);
      const results = { relayResults, blossomResults };

      if (anyRelaySuccess) {
        updateCard(siteId, { phase: 'success', step: null, results });
        animateCardExit(siteId, card.site);
      } else {
        updateCard(siteId, {
          phase: 'failure',
          step: null,
          results,
          error: 'All relays rejected deletion',
        });
      }
    } catch (err) {
      updateCard(siteId, {
        phase: 'failure',
        step: null,
        results: {
          relayResults: [{ relay: 'error', success: false, message: err?.message ?? 'Unexpected error' }],
          blossomResults: [],
        },
        error: err?.message ?? 'Unexpected error during deletion',
      });
    } finally {
      activeDeleteCount--;
      if (activeDeleteCount === 0) {
        dispatch('delete-end');
      }

      // Auto-recover failed cards after delay
      const finalCard = deletingCards.get(siteId);
      if (finalCard?.phase === 'failure') {
        setTimeout(() => {
          const current = deletingCards.get(siteId);
          if (current?.phase === 'failure') {
            removeCard(siteId);
          }
        }, 4000);
      }
    }
  }
</script>

<div>
  {#if siteList.length === 0}
    <div class="bg-slate-800 rounded-lg p-6 text-center">
      <p class="text-slate-400">No sites published yet.</p>
      <p class="text-sm text-slate-500 mt-1">Deploy your first site to see it here.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each siteList as site (site.id)}
        {@const cardState = deletingCards.get(site.id)}
        {@const isDeleting = cardState && cardState.phase !== 'confirm'}
        <div
          class="bg-slate-800 rounded-lg overflow-hidden transition-all duration-300
            {cardState?.phase === 'success' ? 'card-exit-fade' : ''}
            {isDeleting && cardState?.phase !== 'success' ? 'opacity-60' : ''}
            {cardState?.phase === 'failure' ? 'animate-shake' : ''}"
          class:card-exit-collapse={cardState?._collapsing}
        >
          <!-- Card header -->
          <button
            on:click={() => { if (!isDeleting) toggleExpand(site.id); }}
            class="w-full p-4 text-left flex items-center gap-3 transition-colors
              {isDeleting ? 'cursor-default' : 'hover:bg-slate-700/50'}"
            disabled={!!isDeleting}
          >
            <span class="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0
              {site.kind === 35128 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}">
              {siteLabel(site)}
            </span>

            {#if cardState?.phase === 'success'}
              <span class="text-xs text-green-400 font-medium flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Deleted
              </span>
            {:else if cardState?.phase === 'deleting'}
              <span class="text-xs text-red-400 font-medium">Deleting...</span>
            {:else if cardState?.phase === 'failure'}
              <span class="text-xs text-red-400 font-medium">Delete failed</span>
            {/if}

            <span class="flex-1"></span>

            {#if !isDeleting}
              <svg class="w-4 h-4 text-slate-400 transition-transform flex-shrink-0 {expandedSiteId === site.id ? 'rotate-180' : ''}"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {/if}
          </button>

          <!-- Inline delete progress (replaces expanded content during delete) -->
          {#if cardState?.phase === 'deleting'}
            {@const stepStates = getStepStates(cardState.step)}
            <div class="px-4 pb-4 border-t border-slate-700">
              <!-- Step pills -->
              <div class="flex flex-wrap gap-2 my-3">
                {#each DELETE_STEPS as s, i}
                  {@const state = stepStates[i]}
                  <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                    {state === 'complete' ? 'bg-green-800/60 text-green-300' : ''}
                    {state === 'current' ? 'bg-red-700/60 text-red-200 ring-1 ring-red-500' : ''}
                    {state === 'future' ? 'bg-slate-700 text-slate-400' : ''}">
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

              <!-- Relay progress -->
              {#if cardState.step === 'relays'}
                <div class="mb-2">
                  <div class="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{cardState.relayDetails || 'Publishing to relays...'}</span>
                    <span>{Math.round(cardState.relayProgress)}%</span>
                  </div>
                  <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div class="bg-red-500 h-2 rounded-full transition-all duration-300" style="width: {cardState.relayProgress}%" />
                  </div>
                </div>
              {/if}

              <!-- Blob progress -->
              {#if cardState.step === 'blobs' && cardState.blobProgress}
                {@const bp = cardState.blobProgress}
                {@const overallPct = bp.total > 0 ? Math.round((bp.completed / bp.total) * 100) : 0}
                <div class="mb-2">
                  <div class="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{bp.completed}/{bp.total} blob operations</span>
                    <span>{overallPct}%</span>
                  </div>
                  <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div class="bg-red-500 h-2 rounded-full transition-all duration-300" style="width: {overallPct}%" />
                  </div>
                </div>
              {/if}
            </div>

          <!-- Inline confirmation -->
          {:else if cardState?.phase === 'confirm'}
            <div class="px-4 pb-4 border-t border-slate-700">
              <p class="text-slate-300 text-sm my-3">
                Delete from
                <span class="text-white font-medium">{relayUrls.length} relay{relayUrls.length !== 1 ? 's' : ''}</span>
                and remove
                <span class="text-white font-medium">{getBlobCount(site)} blob{getBlobCount(site) !== 1 ? 's' : ''}</span>
                from
                <span class="text-white font-medium">{blossomUrls.length} server{blossomUrls.length !== 1 ? 's' : ''}</span>?
              </p>
              {#if cardState.error}
                <p class="text-sm text-red-400 mb-3">{cardState.error}</p>
              {/if}
              <div class="flex gap-3">
                <button
                  on:click={() => cancelDelete(site.id)}
                  class="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                >Cancel</button>
                <button
                  on:click={() => handleConfirmDelete(site.id)}
                  class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                >Delete</button>
              </div>
            </div>

          <!-- Inline failure with error message -->
          {:else if cardState?.phase === 'failure'}
            <div class="px-4 pb-3 border-t border-slate-700">
              <p class="text-sm text-red-400 my-2">{cardState.error || 'Delete failed'}</p>
            </div>

          <!-- Normal expanded content (only when no delete state) -->
          {:else if expandedSiteId === site.id}
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
                >Update Site</button>
                <button
                  on:click={() => startDelete(site)}
                  class="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2.5 transition-colors"
                >Delete Site</button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Deploy new site button (always visible in manage view) -->
  <div class="mt-4">
    <button
      on:click={() => dispatch('deploy-new')}
      class="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Deploy new site
    </button>
  </div>
</div>

<style>
  :global(.animate-shake) {
    animation: shake 0.5s ease-in-out;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }

  :global(.card-exit-fade) {
    opacity: 0 !important;
    transition: opacity 500ms ease-out !important;
  }

  :global(.card-exit-collapse) {
    max-height: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    overflow: hidden !important;
    transition: max-height 300ms ease-out, margin 300ms ease-out, padding 300ms ease-out !important;
  }
</style>

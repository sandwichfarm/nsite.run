<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let relayUrls = [];     // Relay URLs that will be contacted
  export let blossomUrls = [];   // Blossom URLs that will be contacted
  export let blobCount = 0;      // Number of blobs to delete
  export let deleting = false;   // True while deletion is in progress
  export let progress = null;    // {phase, completed, total, detail} — live progress during deletion
  export let results = null;     // Deletion results (set after completion)
  // results shape: { relayResults: [{relay, success, message}...], blossomResults: [{server, deleted, failed, errors}...] }

  const dispatch = createEventDispatcher();

  function closeModal() {
    if (deleting) return; // Don't allow close during deletion
    dispatch('close');
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Delete site confirmation"
    on:click|self={closeModal}
    on:keydown={(e) => !deleting && e.key === 'Escape' && closeModal()}
  >
    <div class="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <div class="p-6">

        {#if !deleting && !results}
          <!-- State 1: Confirmation -->

          <!-- Header -->
          <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-white">Delete your nsite</h2>
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
          <div class="space-y-3 mb-4">
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

          <!-- Action buttons -->
          <div class="flex gap-3 mt-5 pt-4 border-t border-slate-700">
            <button
              on:click={closeModal}
              class="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              on:click={() => dispatch('confirm')}
              class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Delete my nsite
            </button>
          </div>

        {:else if deleting}
          <!-- State 2: In progress -->

          <!-- Header with spinner -->
          <div class="flex items-center gap-3 mb-4">
            <svg class="w-6 h-6 text-red-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 class="text-lg font-semibold text-white">Deleting your nsite...</h2>
          </div>

          {#if progress}
            <!-- Phase indicator -->
            <p class="text-slate-300 text-sm mb-2">
              {#if progress.phase === 'relays'}
                Publishing to relays...
              {:else if progress.phase === 'blobs'}
                Deleting blobs...
              {/if}
            </p>

            <!-- Progress bar -->
            {#if progress.total > 0}
              <div class="w-full bg-slate-700 rounded-full h-2 mb-2">
                <div
                  class="bg-red-500 h-2 rounded-full transition-all duration-200"
                  style="width: {Math.round((progress.completed / progress.total) * 100)}%"
                ></div>
              </div>
              <p class="text-xs text-slate-500">{progress.completed} / {progress.total}</p>
            {/if}
          {:else}
            <p class="text-slate-400 text-sm">Preparing...</p>
          {/if}

        {:else if results}
          <!-- State 3: Results -->

          <!-- Header with check icon -->
          <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-full bg-green-900/50 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-white">Deletion complete</h2>
          </div>

          <!-- Relay results -->
          {#if results.relayResults && results.relayResults.length > 0}
            <div class="mb-4">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Relays:</p>
              <ul class="space-y-1.5">
                {#each results.relayResults as r}
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
                      <span class="text-slate-500 flex-shrink-0">— {r.message}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Blossom results -->
          {#if results.blossomResults && results.blossomResults.length > 0}
            <div class="mb-4">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Blossom servers:</p>
              <ul class="space-y-1.5">
                {#each results.blossomResults as r}
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

          <!-- Done button -->
          <div class="mt-5 pt-4 border-t border-slate-700">
            <button
              on:click={closeModal}
              class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}

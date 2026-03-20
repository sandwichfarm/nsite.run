<script>
  import { createEventDispatcher } from 'svelte';

  export let siteUrl = '';
  export let publishDate = null; // Date object or null
  export let fileCount = 0;
  export let loading = false;

  const dispatch = createEventDispatcher();

  function formatDate(date) {
    if (!date) return 'Unknown';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<div class="bg-slate-800 rounded-lg p-5 border border-purple-700/30 mb-6">
  {#if loading}
    <div class="flex items-center gap-3 text-slate-400 text-sm">
      <div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse flex-shrink-0"></div>
      Loading site info...
    </div>
  {:else}
    <!-- Header row -->
    <div class="flex items-center gap-2 mb-3">
      <div class="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></div>
      <h3 class="text-lg font-semibold text-white">Your published nsite</h3>
    </div>

    <!-- Site URL -->
    {#if siteUrl}
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="block text-purple-400 hover:text-purple-300 font-mono text-sm break-all transition-colors mb-3"
      >
        {siteUrl}
      </a>
    {/if}

    <!-- Stats row -->
    <div class="flex flex-wrap gap-4 text-sm text-slate-400 mb-4">
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
    <div class="flex gap-2">
      <button
        on:click={() => dispatch('update')}
        class="bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium px-4 py-2 transition-colors"
      >
        Update Site
      </button>
      <button
        on:click={() => dispatch('delete')}
        class="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2 transition-colors"
      >
        Delete Site
      </button>
    </div>
  {/if}
</div>

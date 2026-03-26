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

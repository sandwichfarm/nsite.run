<script>
  import { fade } from 'svelte/transition';

  /** @type {'deploy' | 'delete'} */
  export let operationType = 'deploy';

  /** @type {number} 0-100 */
  export let progress = 0;

  /** @type {string} current step label (e.g. 'hashing', 'uploading', 'deleting') */
  export let step = '';

  /** @type {null | 'success' | 'error'} */
  export let completionState = null;

  /** @type {(() => void) | null} callback to navigate back to the operation's tab */
  export let onNavigateBack = null;

  // Auto-dismiss: show for 5 seconds after completion, then hide
  let visible = true;
  let dismissTimerSet = false;

  $: if (completionState !== null && !dismissTimerSet) {
    dismissTimerSet = true;
    setTimeout(() => {
      visible = false;
    }, 5000);
  }

  // Reset visibility and timer when a new operation starts (completionState goes back to null)
  $: if (completionState === null) {
    visible = true;
    dismissTimerSet = false;
  }

  $: label = operationType === 'deploy' ? 'Deploying' : 'Deleting';
  $: completionLabel = operationType === 'deploy'
    ? (completionState === 'success' ? 'Deploy complete' : 'Deploy failed')
    : (completionState === 'success' ? 'Delete complete' : 'Delete failed');
</script>

{#if visible}
  <div
    transition:fade={{ duration: 200 }}
    class="w-full bg-amber-900/40 border border-amber-600/50 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm"
  >
    <div class="flex items-center gap-2">
      {#if completionState === null}
        <!-- In-progress indicator -->
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        <span class="text-amber-200">
          {label}...
          {#if step} {step}{/if}
          {#if progress > 0 && progress < 100} ({progress}%){/if}
        </span>
      {:else if completionState === 'success'}
        <svg class="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-green-300">{completionLabel}</span>
      {:else}
        <svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span class="text-red-300">{completionLabel}</span>
      {/if}
    </div>
    {#if onNavigateBack}
      <button
        on:click={onNavigateBack}
        class="text-amber-400 hover:text-amber-200 underline text-xs flex-shrink-0 ml-3"
      >
        View details
      </button>
    {/if}
  </div>
{/if}

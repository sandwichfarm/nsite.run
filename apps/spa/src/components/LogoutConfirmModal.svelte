<script>
  import { createEventDispatcher } from 'svelte';
  import { downloadNsecFile } from '../lib/nostr.js';

  export let show = false;
  export let nsec = '';
  export let npub = '';

  const dispatch = createEventDispatcher();

  let backedUp = false;
  let nsecCopied = false;

  async function copyNsec() {
    if (!nsec) return;
    await navigator.clipboard.writeText(nsec);
    nsecCopied = true;
    setTimeout(() => (nsecCopied = false), 2000);
  }

  function handleDownload() {
    downloadNsecFile(nsec, npub);
  }

  function handleConfirm() {
    dispatch('confirm');
    backedUp = false;
  }

  function closeModal() {
    backedUp = false;
    nsecCopied = false;
    dispatch('close');
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Logout confirmation"
    on:click|self={closeModal}
    on:keydown={(e) => e.key === 'Escape' && closeModal()}
  >
    <div class="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
      <div class="p-6">

        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-amber-800/50 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-white">Back up your key before logging out</h2>
          </div>
          <button
            on:click={closeModal}
            class="text-slate-400 hover:text-white transition-colors p-1 ml-2 flex-shrink-0"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Warning message -->
        <p class="text-amber-300 text-sm mb-4">You deployed with an anonymous identity. If you log out without saving your private key, you will permanently lose access to your site.</p>

        <!-- nsec display + action buttons -->
        <div class="p-4 bg-amber-900/30 border border-amber-600/50 rounded-lg mb-4">
          <p class="text-xs text-amber-400/80 mb-2">Your private key:</p>
          <code class="block text-xs font-mono text-amber-200 bg-slate-900 px-3 py-2 rounded border border-amber-700/40 break-all mb-3">
            {nsec}
          </code>
          <div class="flex gap-2">
            <button
              on:click={handleDownload}
              class="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              on:click={copyNsec}
              class="flex items-center gap-1.5 px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-medium transition-colors"
            >
              {#if nsecCopied}
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              {:else}
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              {/if}
            </button>
          </div>
        </div>

        <!-- Acknowledgment checkbox -->
        <label class="flex items-center gap-3 cursor-pointer mt-4">
          <input
            type="checkbox"
            bind:checked={backedUp}
            class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
          />
          <span class="text-sm text-slate-300">I've backed up my key</span>
        </label>

        <!-- Action buttons -->
        <div class="flex gap-3 mt-5 pt-4 border-t border-slate-700">
          <button
            on:click={closeModal}
            class="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            on:click={handleConfirm}
            disabled={!backedUp}
            class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Log out
          </button>
        </div>

      </div>
    </div>
  </div>
{/if}

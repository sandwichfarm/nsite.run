<script>
  import { createEventDispatcher } from 'svelte';
  import { createExtensionSigner, fetchProfile, DEFAULT_RELAYS } from '@nsite/deployer/nostr';
  import { createDeployerStores } from '@nsite/deployer/store';

  const { session } = createDeployerStores();
  import { npubEncode } from 'nostr-tools/nip19';
  import NIP46Dialog from './NIP46Dialog.svelte';

  export let show = false;

  const dispatch = createEventDispatcher();

  let showNip46 = false;
  let extensionError = '';
  let extensionLoading = false;

  async function loginWithExtension() {
    extensionError = '';
    extensionLoading = true;
    try {
      const { signer, pubkey } = await createExtensionSigner();
      const npub = npubEncode(pubkey);
      let profile = null;
      try {
        profile = await fetchProfile(pubkey, DEFAULT_RELAYS);
      } catch { /* ignore — profile is optional */ }

      session.set({
        pubkey,
        signerType: 'extension',
        displayName: profile?.display_name || profile?.name || null,
        avatar: profile?.picture || null,
        npub,
      });

      dispatch('login', { signer });
      dispatch('close');

    } catch (err) {
      // ExtensionMissingError or other
      if (err?.name === 'ExtensionMissingError' || err?.message?.includes('nostr') || !window.nostr) {
        extensionError = 'No nostr extension found. Install Alby or nos2x.';
      } else {
        extensionError = err?.message ?? 'Failed to connect to extension.';
      }
    } finally {
      extensionLoading = false;
    }
  }

  function openNip46() {
    showNip46 = true;
  }

  function handleNip46Login(e) {
    dispatch('login', e.detail);
    dispatch('close');
    showNip46 = false;
  }

  function closeModal() {
    showNip46 = false;
    extensionError = '';
    dispatch('close');
  }
</script>

{#if show}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Login dialog"
    on:click|self={closeModal}
    on:keydown={(e) => e.key === 'Escape' && closeModal()}
  >
    <div class="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">

      {#if !showNip46}
        <!-- Main login choice -->
        <div class="p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-white">Login with your nostr identity</h2>
            <button
              on:click={closeModal}
              class="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Option cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <!-- Extension option -->
            <button
              on:click={loginWithExtension}
              disabled={extensionLoading}
              class="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-600 hover:border-purple-500 hover:bg-purple-900/10 transition-all text-left group disabled:opacity-50"
            >
              <div class="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-purple-800/40 transition-colors">
                {#if extensionLoading}
                  <svg class="w-6 h-6 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                {:else}
                  <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                {/if}
              </div>
              <div>
                <p class="font-semibold text-white text-sm text-center">Browser Extension</p>
                <p class="text-xs text-slate-400 text-center mt-1">Use Alby, nos2x, or other NIP-07 extension</p>
              </div>
            </button>

            <!-- Remote signer option -->
            <button
              on:click={openNip46}
              class="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-600 hover:border-indigo-500 hover:bg-indigo-900/10 transition-all text-left group"
            >
              <div class="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-indigo-800/40 transition-colors">
                <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-white text-sm text-center">Remote Signer</p>
                <p class="text-xs text-slate-400 text-center mt-1">Connect with Amber, nsecBunker, or other NIP-46 signer</p>
              </div>
            </button>
          </div>

          <!-- Extension error -->
          {#if extensionError}
            <p class="text-sm text-red-400 text-center mb-4">{extensionError}</p>
          {/if}

          <!-- Anonymous option -->
          <div class="text-center border-t border-slate-700 pt-4">
            <button
              on:click={closeModal}
              class="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              Or deploy anonymously
            </button>
          </div>
        </div>

      {:else}
        <!-- NIP-46 view -->
        <div class="p-6">
          <div class="flex items-center gap-3 mb-4">
            <button
              on:click={() => (showNip46 = false)}
              class="text-slate-400 hover:text-white transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="text-lg font-semibold text-white">Remote Signer</h2>
            <button
              on:click={closeModal}
              class="ml-auto text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <NIP46Dialog
            show={showNip46}
            on:login={handleNip46Login}
          />
        </div>
      {/if}

    </div>
  </div>
{/if}

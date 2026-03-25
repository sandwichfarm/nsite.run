<script>
  import { onMount, tick, createEventDispatcher, getContext } from 'svelte';
  import QRCode from 'qrcode';
  import { createNostrConnectSigner, connectFromBunkerURI, fetchProfile, DEFAULT_RELAYS } from '@nsite/deployer/nostr';

  const { session } = getContext('deployer-stores');
  import { npubEncode } from 'nostr-tools/nip19';

  export let show = false;

  const dispatch = createEventDispatcher();

  let canvasEl;
  let connectUri = '';
  let waitFn = null;
  let signerInstance = null;

  let bunkerInput = '';
  let status = 'idle'; // 'idle' | 'waiting' | 'connecting-bunker' | 'error' | 'success'
  let errorMsg = '';
  let uriCopied = false;

  const TIMEOUT_MS = 60_000;
  let timeoutId = null;

  async function init() {
    errorMsg = '';
    try {
      let signerResult;
      try {
        signerResult = createNostrConnectSigner();
      } catch (e) {
        throw new Error('Failed to create signer: ' + (e?.message ?? e));
      }

      const { signer, uri, waitForSigner } = signerResult;
      signerInstance = signer;
      connectUri = uri;
      waitFn = waitForSigner;

      status = 'waiting';

      // Wait for Svelte to render the canvas
      await tick();
      // Extra safety — wait another frame
      await new Promise(r => requestAnimationFrame(r));

      if (canvasEl) {
        try {
          await QRCode.toCanvas(canvasEl, uri, {
            width: 256,
            margin: 4,
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch (e) {
          console.error('QR render failed:', e);
        }
      } else {
        console.error('canvasEl is null after tick + rAF');
      }

      // Start 60s timeout
      timeoutId = setTimeout(() => {
        status = 'error';
        errorMsg = 'Timed out waiting for signer to connect. Try scanning again.';
      }, TIMEOUT_MS);

      // Wait for remote signer to connect
      await waitFn();
      clearTimeout(timeoutId);

      // Connected — fetch profile
      const pubkey = await signer.getPublicKey();
      const npub = npubEncode(pubkey);
      let profile = null;
      try {
        profile = await fetchProfile(pubkey, DEFAULT_RELAYS);
      } catch { /* ignore */ }

      session.set({
        pubkey,
        signerType: 'nostrconnect',
        displayName: profile?.display_name || profile?.name || null,
        avatar: profile?.picture || null,
        npub,
      });

      status = 'success';
      dispatch('login', { signer });

    } catch (err) {
      clearTimeout(timeoutId);
      status = 'error';
      errorMsg = err?.message ?? 'Failed to initialize NIP-46 connection.';
    }
  }

  async function connectBunker() {
    if (!bunkerInput.trim()) return;
    status = 'connecting-bunker';
    errorMsg = '';
    clearTimeout(timeoutId);

    try {
      const { signer, pubkey } = await connectFromBunkerURI(bunkerInput.trim());
      const npub = npubEncode(pubkey);
      let profile = null;
      try {
        profile = await fetchProfile(pubkey, DEFAULT_RELAYS);
      } catch { /* ignore */ }

      session.set({
        pubkey,
        signerType: 'nostrconnect',
        displayName: profile?.display_name || profile?.name || null,
        avatar: profile?.picture || null,
        npub,
      });

      status = 'success';
      dispatch('login', { signer });

    } catch (err) {
      status = 'error';
      errorMsg = err?.message ?? 'Failed to connect via bunker URI. Check the URI and try again.';
    }
  }

  async function copyUri() {
    if (!connectUri) return;
    await navigator.clipboard.writeText(connectUri);
    uriCopied = true;
    setTimeout(() => (uriCopied = false), 2000);
  }

  function retry() {
    clearTimeout(timeoutId);
    init();
  }

  let hasInitialized = false;

  // Trigger init when show becomes true
  $: if (show && !hasInitialized) {
    hasInitialized = true;
    status = 'idle';
    // Delay to ensure DOM has rendered the canvas
    setTimeout(() => init(), 50);
  }

  // Reset when hidden
  $: if (!show) {
    hasInitialized = false;
  }

  onMount(() => {
    return () => clearTimeout(timeoutId);
  });
</script>

{#if show}
  <div class="w-full max-w-md mx-auto">

    <!-- QR canvas — always in DOM when dialog is shown, hidden until needed -->
    <canvas
      bind:this={canvasEl}
      class="rounded-lg {status === 'waiting' || status === 'connecting-bunker' ? '' : 'hidden'}"
    />

    {#if status === 'idle'}
      <div class="flex items-center justify-center py-8">
        <svg class="w-8 h-8 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span class="ml-3 text-slate-300">Generating connection URI...</span>
      </div>

    {:else if status === 'waiting' || status === 'connecting-bunker'}
      <!-- QR code is shown via the canvas above -->
      <div class="flex flex-col items-center mb-4">
        <!-- canvas is above, outside conditional blocks -->
      </div>

      <!-- URI display -->
      {#if connectUri}
        <div class="mb-4">
          <div class="flex items-center gap-2">
            <code class="flex-1 text-xs font-mono text-slate-300 bg-slate-900 px-3 py-2 rounded border border-slate-600 break-all">
              {connectUri.slice(0, 60)}...
            </code>
            <button
              on:click={copyUri}
              class="flex-shrink-0 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
            >
              {uriCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      {/if}

      <!-- Waiting indicator -->
      {#if status === 'waiting'}
        <div class="flex items-center gap-2 text-sm text-slate-400 mb-4">
          <svg class="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Waiting for signer to connect...
        </div>
      {/if}

      <!-- Divider -->
      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1 h-px bg-slate-600" />
        <span class="text-xs text-slate-500">or paste bunker URI</span>
        <div class="flex-1 h-px bg-slate-600" />
      </div>

      <!-- Bunker URI input -->
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={bunkerInput}
          placeholder="bunker://..."
          class="flex-1 text-sm bg-slate-900 border border-slate-600 text-slate-200 placeholder-slate-500 rounded px-3 py-2 focus:outline-none focus:border-purple-500 font-mono"
          on:keydown={(e) => e.key === 'Enter' && connectBunker()}
        />
        <button
          on:click={connectBunker}
          disabled={!bunkerInput.trim()}
          class="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
        >
          Connect
        </button>
      </div>

    {:else if status === 'error'}
      <div class="text-center py-4">
        <p class="text-red-400 text-sm mb-4">{errorMsg}</p>
        <button
          on:click={retry}
          class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>

    {:else if status === 'success'}
      <div class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-green-800/60 flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="text-white font-medium">Connected!</p>
      </div>
    {/if}
  </div>
{/if}

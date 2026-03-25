<script>
  import { createDeployerStores } from '@nsite/deployer/store';
  import { NSITE_RELAY, NSITE_BLOSSOM } from '@nsite/deployer/nostr';

  const { serverConfig } = createDeployerStores();

  let relayInput = '';
  let blossomInput = '';

  function addRelay() {
    const url = relayInput.trim();
    if (!url) return;
    serverConfig.update((c) => ({
      ...c,
      extraRelays: [...new Set([...c.extraRelays, url])],
    }));
    relayInput = '';
  }

  function removeRelay(url) {
    serverConfig.update((c) => ({
      ...c,
      extraRelays: c.extraRelays.filter((r) => r !== url),
    }));
  }

  function addBlossom() {
    const url = blossomInput.trim();
    if (!url) return;
    serverConfig.update((c) => ({
      ...c,
      extraBlossoms: [...new Set([...c.extraBlossoms, url])],
    }));
    blossomInput = '';
  }

  function removeBlossom(url) {
    serverConfig.update((c) => ({
      ...c,
      extraBlossoms: c.extraBlossoms.filter((b) => b !== url),
    }));
  }

  function onRelayKeydown(e) {
    if (e.key === 'Enter') addRelay();
  }

  function onBlossomKeydown(e) {
    if (e.key === 'Enter') addBlossom();
  }
</script>

<div class="space-y-5">
  <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Server Configuration</p>

  <!-- Relays -->
  <div>
    <p class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
      Relays
    </p>

    <!-- Required nsite relay -->
    <div class="flex items-center gap-2 mb-1.5 opacity-60" title="Required — manifests are always published here">
      <span class="flex-1 text-sm font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded truncate">{NSITE_RELAY}</span>
      <span class="text-xs text-slate-500 px-1">required</span>
    </div>

    {#each $serverConfig.extraRelays as relay}
      <div class="flex items-center gap-2 mb-1.5">
        <span class="flex-1 text-sm font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded truncate">{relay}</span>
        <button
          on:click={() => removeRelay(relay)}
          class="text-xs text-slate-500 hover:text-red-400 transition-colors px-1"
        >
          Remove
        </button>
      </div>
    {/each}

    <div class="flex gap-2 mt-2">
      <input
        type="text"
        bind:value={relayInput}
        on:keydown={onRelayKeydown}
        placeholder="wss://relay.example.com"
        class="flex-1 text-sm bg-slate-900 border border-slate-600 text-slate-200 placeholder-slate-500 rounded px-3 py-1.5 focus:outline-none focus:border-purple-500"
      />
      <button
        on:click={addRelay}
        class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
      >
        Add
      </button>
    </div>
  </div>

  <!-- Blossom Servers -->
  <div>
    <p class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
      Blossom Servers
    </p>

    <!-- Required nsite blossom -->
    <div class="flex items-center gap-2 mb-1.5 opacity-60" title="Required — blobs are always uploaded here">
      <span class="flex-1 text-sm font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded truncate">{NSITE_BLOSSOM}</span>
      <span class="text-xs text-slate-500 px-1">required</span>
    </div>

    {#each $serverConfig.extraBlossoms as server}
      <div class="flex items-center gap-2 mb-1.5">
        <span class="flex-1 text-sm font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded truncate">{server}</span>
        <button
          on:click={() => removeBlossom(server)}
          class="text-xs text-slate-500 hover:text-red-400 transition-colors px-1"
        >
          Remove
        </button>
      </div>
    {/each}

    <div class="flex gap-2 mt-2">
      <input
        type="text"
        bind:value={blossomInput}
        on:keydown={onBlossomKeydown}
        placeholder="https://blossom.example.com"
        class="flex-1 text-sm bg-slate-900 border border-slate-600 text-slate-200 placeholder-slate-500 rounded px-3 py-1.5 focus:outline-none focus:border-purple-500"
      />
      <button
        on:click={addBlossom}
        class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
      >
        Add
      </button>
    </div>
  </div>
</div>

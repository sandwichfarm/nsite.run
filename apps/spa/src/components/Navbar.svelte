<script>
  import { session } from '../lib/store.js';

  export let onLoginClick = () => {};

  function truncateNpub(npub) {
    if (!npub) return '';
    return npub.slice(0, 8) + '...' + npub.slice(-4);
  }

  function logout() {
    session.set({
      pubkey: null,
      signerType: null,
      displayName: null,
      avatar: null,
      npub: null,
    });
  }
</script>

<nav class="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
  <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
    <!-- Left: logo -->
    <a href="/" class="text-white font-bold text-lg tracking-tight hover:text-purple-400 transition-colors">
      nsite.run <span class="opacity-10">v2</span>
    </a>

    <!-- Right: auth state -->
    <div class="flex items-center gap-3">
      {#if $session.pubkey}
        <!-- Logged in state -->
        <div class="flex items-center gap-2">
          {#if $session.avatar}
            <img
              src={$session.avatar}
              alt={$session.displayName || 'avatar'}
              class="w-8 h-8 rounded-full object-cover border border-slate-600"
            />
          {:else}
            <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              {($session.displayName || $session.npub || 'A').slice(0, 1).toUpperCase()}
            </div>
          {/if}
          <div class="flex flex-col leading-tight">
            {#if $session.displayName}
              <span class="text-sm text-white font-medium">{$session.displayName}</span>
            {/if}
            {#if $session.npub}
              <span class="text-xs text-slate-400 font-mono">{truncateNpub($session.npub)}</span>
            {/if}
          </div>
        </div>
        <button
          on:click={logout}
          class="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
        >
          Logout
        </button>
      {:else}
        <!-- Logged out state -->
        <button
          on:click={onLoginClick}
          class="text-sm text-slate-300 hover:text-purple-400 transition-colors"
        >
          Login with your nostr identity
        </button>
      {/if}
    </div>
  </div>
</nav>

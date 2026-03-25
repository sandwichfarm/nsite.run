<script>
  import { createEventDispatcher } from 'svelte';
  import { clearAnonymousKey, downloadNsecFile } from '@nsite/deployer/nostr';
  import LogoutConfirmModal from '@nsite/deployer/components/LogoutConfirmModal.svelte';

  const dispatch = createEventDispatcher();

  // Session data props (received from App.svelte via DeployerWidget auth-change events)
  export let pubkey = null;
  export let displayName = null;
  export let avatar = null;
  export let npub = null;
  export let signerType = null;
  export let deployNsec = null;

  export let onLoginClick = () => {};

  let showLogoutConfirm = false;

  function truncateNpub(npubStr) {
    if (!npubStr) return '';
    return npubStr.slice(0, 8) + '...' + npubStr.slice(-4);
  }

  function logout() {
    if (signerType === 'anonymous') {
      showLogoutConfirm = true;
      return;
    }
    doLogout();
  }

  function doLogout() {
    clearAnonymousKey();
    showLogoutConfirm = false;
    dispatch('logout');
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
      {#if pubkey}
        <!-- Logged in state -->
        <div class="flex items-center gap-2">
          {#if avatar}
            <img
              src={avatar}
              alt={displayName || 'avatar'}
              class="w-8 h-8 rounded-full object-cover border border-slate-600"
            />
          {:else}
            <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              {(displayName || npub || 'A').slice(0, 1).toUpperCase()}
            </div>
          {/if}
          <div class="flex flex-col leading-tight">
            {#if displayName}
              <span class="text-sm text-white font-medium">{displayName}</span>
            {/if}
            {#if npub}
              <span class="text-xs text-slate-400 font-mono">{truncateNpub(npub)}</span>
            {/if}
            {#if signerType === 'anonymous'}
              <span class="text-[10px] font-medium text-amber-400 bg-amber-900/40 px-1.5 py-0.5 rounded-full">Anonymous</span>
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

<LogoutConfirmModal
  show={showLogoutConfirm}
  nsec={deployNsec || ''}
  npub={npub || ''}
  on:close={() => (showLogoutConfirm = false)}
  on:confirm={doLogout}
/>

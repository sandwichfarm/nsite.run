<script>
  import { onMount, onDestroy, setContext, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { createDeployerStores } from '../lib/store.js';
  import {
    createAnonymousSigner,
    createExtensionSigner,
    restoreAnonymousSigner,
    saveAnonymousKey,
    NSITE_RELAY,
    NSITE_BLOSSOM,
    NSITE_GATEWAY_HOST,
    NSITE_GATEWAY_PROTOCOL,
    DEFAULT_RELAYS,
    fetchRelayList,
    fetchBlossomList,
    fetchProfile,
    fetchExistingManifest,
    fetchAllManifests,
    getManifestDTag,
    getManifestTitle,
    getManifestDescription,
  } from '../lib/nostr.js';
  import { npubEncode } from 'nostr-tools/nip19';
  import { hashFile } from '../lib/crypto.js';
  import { checkExistence, uploadBlobs } from '../lib/upload.js';
  import { publishManifest } from '../lib/publish.js';
  import { base36Encode } from '../lib/base36.js';
  import { hexToBytes } from 'nostr-tools/utils';

  // Sub-components
  import DeployZone from './DeployZone.svelte';
  import FileTree from './FileTree.svelte';
  import ProgressIndicator from './ProgressIndicator.svelte';
  import SuccessPanel from './SuccessPanel.svelte';
  import ManageSite from './ManageSite.svelte';
  import LoginModal from './LoginModal.svelte';
  import AdvancedConfig from './AdvancedConfig.svelte';
  import OperationBanner from './OperationBanner.svelte';

  const dispatch = createEventDispatcher();

  // --- Props ---
  /** @type {{ getPublicKey(): Promise<string>, signEvent(t: object): Promise<object> } | null} */
  export let signer = null;

  // --- Store context ---
  const stores = createDeployerStores();
  setContext('deployer-stores', stores);
  const { session, deployState, serverConfig } = stores;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let showLoginModal = false;

  // Page navigation: 'deploy' | 'manage'
  let currentPage = 'deploy';

  // Delete-in-progress flag (set by ManageSite events)
  let deleteInProgress = false;

  // Banner completion state: null while in-progress, 'success'/'error' after operation ends
  let bannerCompletionState = null;
  // Which operation the banner is tracking: 'deploy' | 'delete'
  let bannerOperationType = 'deploy';

  // Files & tree state (set when DeployZone fires 'files-selected')
  let selectedFiles = [];
  let fileTree = null;
  let fileWarnings = [];
  let excludedFiles = new Set();
  let excludedCount = 0;

  // Deploy options
  let spaFallback = false;

  // Named site state
  let siteType = 'root'; // 'root' | 'named'
  let dTag = '';
  let dTagError = '';
  let dTagReadOnly = false;
  let deployTitle = '';
  let deployDescription = '';

  // Multi-site data from fetchAllManifests
  let allSites = { root: null, named: [] };
  let sitesLoading = false;

  // Internal signer — either from prop or from built-in auth
  let currentSigner = null;
  let deployNsec = null;

  // Sync external signer prop to internal state
  $: if (signer !== undefined) {
    currentSigner = signer;
  }

  // Progress details text
  let progressDetails = '';

  // Success data
  let deployEvent = null;
  let uploadResult = null;
  let uploadProgress = null;
  let checkProgress = null;
  let publishResult = null;

  // File list expand/collapse
  let fileListExpanded = false;

  // Excluded files summary expand/collapse
  let excludedSummaryExpanded = false;

  // NIP-65 / 10063 pre-fetched lists
  let userRelays = [];
  let userBlossoms = [];

  // Give-up state
  let givenUpServers = new Set();
  let givenUpReactive = new Set();
  let deployBlossomUrls = [];

  // Existing site info (for returning users)
  let existingManifest = null;
  let siteInfoLoading = false;

  function giveUpServer(url) {
    givenUpServers.add(url);
    givenUpReactive = new Set(givenUpServers);
  }
  function undoGiveUp(url) {
    givenUpServers.delete(url);
    givenUpReactive = new Set(givenUpServers);
  }

  // Error state
  let errorMessage = '';

  // ---------------------------------------------------------------------------
  // Background NIP-65 / 10063 fetch
  // ---------------------------------------------------------------------------

  function fetchUserServers(pubkey) {
    fetchRelayList(pubkey, DEFAULT_RELAYS).then((r) => {
      userRelays = r;
      // Also query user's own relays for 10063
      if (r.length > 0) {
        fetchBlossomList(pubkey, r).then((b) => {
          if (b.length > 0) userBlossoms = [...new Set([...userBlossoms, ...b])];
        }).catch(() => {});
      }
    }).catch(() => {});
    fetchBlossomList(pubkey, DEFAULT_RELAYS).then((b) => {
      userBlossoms = b;
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Hydrate profile + relay/blossom lists on mount
  // ---------------------------------------------------------------------------

  onMount(async () => {
    // If external signer is provided, derive session info
    if (signer) {
      try {
        const pubkey = await signer.getPublicKey();
        const npub = npubEncode(pubkey);
        session.set({ pubkey, signerType: 'external', displayName: null, avatar: null, npub });
        fetchUserServers(pubkey);
        fetchSiteInfo(pubkey);
        // Try to fetch profile
        fetchProfile(pubkey, DEFAULT_RELAYS).then((profile) => {
          if (profile) {
            session.update((s) => ({
              ...s,
              displayName: profile.display_name || profile.name || null,
              avatar: profile.picture || null,
            }));
          }
        }).catch(() => {});
        dispatch('auth-change', { pubkey, signerType: 'external', authenticated: true });
      } catch {
        // signer.getPublicKey() failed — treat as no signer
      }
      return;
    }

    // No external signer — use built-in auth
    const sess = get(session);
    if (sess.signerType === 'anonymous' && !currentSigner) {
      const restored = await restoreAnonymousSigner();
      if (restored) {
        currentSigner = restored.signer;
        deployNsec = restored.nsec;
        fetchSiteInfo(sess.pubkey);
      } else {
        session.set({ pubkey: null, signerType: null, displayName: null, avatar: null, npub: null });
      }
    }

    if (sess.pubkey && !sess.displayName) {
      fetchProfile(sess.pubkey, DEFAULT_RELAYS).then((profile) => {
        if (profile) {
          session.update((s) => ({
            ...s,
            displayName: profile.display_name || profile.name || null,
            avatar: profile.picture || null,
          }));
        }
      }).catch(() => {});
    }
    if (sess.pubkey && sess.signerType !== 'anonymous') {
      fetchUserServers(sess.pubkey);
      fetchSiteInfo(sess.pubkey);
      if (sess.signerType === 'extension' && !currentSigner) {
        try {
          const ext = await createExtensionSigner();
          currentSigner = ext.signer;
        } catch {}
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  $: step = $deployState.step;

  // Dangerous deploy steps -- trigger beforeunload guard
  const DANGEROUS_DEPLOY_STEPS = new Set(['hashing', 'checking', 'uploading', 'publishing']);
  $: isDangerousStep = DANGEROUS_DEPLOY_STEPS.has(step) || deleteInProgress;

  // Track deploy completion for banner auto-dismiss
  let prevStep = 'idle';
  $: {
    if (DANGEROUS_DEPLOY_STEPS.has(prevStep) && (step === 'success' || step === 'error')) {
      bannerCompletionState = step === 'success' ? 'success' : 'error';
      bannerOperationType = 'deploy';
    }
    prevStep = step;
  }

  // Derive whether banner should be visible at all
  $: showBanner = isDangerousStep || bannerCompletionState !== null;

  function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = true;
  }

  $: if (isDangerousStep) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  $: dTagValid = siteType === 'root' || /^[a-z0-9]{1,13}$/.test(dTag);
  $: dTagError = siteType === 'named' && dTag.length > 0 && !dTagValid
    ? 'Only lowercase letters and numbers, 1-13 characters'
    : '';
  $: canDeploy = ($session.pubkey ? !sitesLoading : true) && (siteType === 'root' || (dTag.length > 0 && dTagValid));
  $: includedFiles = selectedFiles.filter((f) => !excludedFiles.has(f.path));
  $: fileDataMap = new Map(selectedFiles.map(f => [f.path, f.data]));
  $: userExcludedCount = excludedFiles.size;
  $: userExcludedPaths = [...excludedFiles]; // array for rendering

  // Derived values for site info
  $: existingSiteUrl = (() => {
    if (!existingManifest || !$session.npub) return '';
    try { return `https://${$session.npub}.${new URL(NSITE_BLOSSOM).host}`; } catch { return ''; }
  })();
  $: existingPublishDate = existingManifest ? new Date(existingManifest.created_at * 1000) : null;
  $: existingFileCount = existingManifest ? existingManifest.tags.filter(t => t[0] === 'path').length : 0;

  // Deploy guard: detect if entered dTag matches an existing named site
  $: matchingNamedSite = siteType === 'named' && dTag && dTagValid && !dTagReadOnly
    ? allSites.named.find(s => getManifestDTag(s) === dTag)
    : null;

  // Derived values for deletion scope
  $: deleteRelayUrls = [...new Set([NSITE_RELAY, ...userRelays])];
  $: deleteBlossomUrls_list = [...new Set([NSITE_BLOSSOM, ...userBlossoms])];
  $: deleteBlobCount = existingManifest
    ? [...new Set(existingManifest.tags.filter(t => t[0] === 'path').map(t => t[2]))].length
    : 0;

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleFilesSelected(event) {
    const { files, tree, warnings, excluded } = event.detail;
    selectedFiles = files;
    fileTree = tree;
    fileWarnings = warnings ?? [];
    excludedFiles = new Set((excluded ?? []).map((f) => (typeof f === 'string' ? f : f.path)));
    excludedCount = excludedFiles.size;

    deployState.update((s) => ({ ...s, step: 'reviewing', files }));
  }

  function toggleExclude(path) {
    const next = new Set(excludedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    excludedFiles = next;
  }

  function handleGuardUpdate(site) {
    if (site.kind === 35128) {
      siteType = 'named';
      dTag = getManifestDTag(site) || '';
      dTagReadOnly = true;
    } else {
      siteType = 'root';
      dTag = '';
      dTagReadOnly = false;
    }
    deployTitle = getManifestTitle(site);
    deployDescription = getManifestDescription(site);
    resetForUpdate();
  }

  function resetDeploy() {
    selectedFiles = [];
    fileTree = null;
    fileWarnings = [];
    excludedFiles = new Set();
    excludedCount = 0;
    fileListExpanded = false;
    excludedSummaryExpanded = false;
    spaFallback = false;
    siteType = 'root';
    dTag = '';
    dTagError = '';
    dTagReadOnly = false;
    deployTitle = '';
    deployDescription = '';
    currentSigner = signer; // reset to prop value (null if no external signer)
    deployNsec = null;
    deployEvent = null;
    uploadResult = null;
    publishResult = null;
    errorMessage = '';
    deployState.set({
      step: 'idle',
      files: [],
      warnings: [],
      progress: 0,
      result: null,
      error: null,
    });
  }

  function resetForUpdate() {
    selectedFiles = [];
    fileTree = null;
    fileWarnings = [];
    excludedFiles = new Set();
    excludedCount = 0;
    fileListExpanded = false;
    excludedSummaryExpanded = false;
    spaFallback = false;
    // NOTE: currentSigner and deployNsec are intentionally NOT cleared
    deployEvent = null;
    uploadResult = null;
    uploadProgress = null;
    checkProgress = null;
    publishResult = null;
    errorMessage = '';
    givenUpServers = new Set();
    givenUpReactive = new Set();
    deployBlossomUrls = [];
    deployState.set({
      step: 'idle',
      files: [],
      warnings: [],
      progress: 0,
      result: null,
      error: null,
    });
  }

  async function fetchSiteInfo(pubkey) {
    sitesLoading = true;
    siteInfoLoading = true;
    try {
      const relayList = [...new Set([NSITE_RELAY, ...userRelays, ...(userRelays.length === 0 ? DEFAULT_RELAYS : [])])];
      const result = await fetchAllManifests(pubkey, relayList);
      allSites = result;
      existingManifest = result.root;
    } catch {
      allSites = { root: null, named: [] };
      existingManifest = null;
    } finally {
      sitesLoading = false;
      siteInfoLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Login handler
  // ---------------------------------------------------------------------------

  function handleLogin(e) {
    currentSigner = e.detail?.signer ?? null;
    showLoginModal = false;
    const sess = get(session);
    if (sess.pubkey && sess.signerType !== 'anonymous') {
      fetchUserServers(sess.pubkey);
    }
    if (sess.pubkey) {
      fetchSiteInfo(sess.pubkey);
    }
    dispatch('auth-change', {
      pubkey: sess.pubkey,
      signerType: sess.signerType,
      authenticated: !!sess.pubkey,
    });
  }

  // ---------------------------------------------------------------------------
  // ManageSite event handlers
  // ---------------------------------------------------------------------------

  function handleDeleteStart() {
    deleteInProgress = true;
    bannerCompletionState = null;
    bannerOperationType = 'delete';
    dispatch('operation-start', { type: 'delete', siteId: null });
  }

  function handleDeleteEnd(e) {
    deleteInProgress = false;
    if (e.detail && !e.detail.cancelled) {
      bannerCompletionState = e.detail.success ? 'success' : 'error';
      bannerOperationType = 'delete';
      dispatch('operation-end', { type: 'delete', siteId: null, success: e.detail.success });
    }
  }

  function handleSiteRemoved(e) {
    const site = e.detail;
    if (site.kind === 35128) {
      allSites = { ...allSites, named: allSites.named.filter(s => s.id !== site.id) };
    } else {
      allSites = { ...allSites, root: null };
    }
    existingManifest = allSites.root;
    dispatch('site-deleted', { siteId: site.id });
  }

  // ---------------------------------------------------------------------------
  // Deploy handler
  // ---------------------------------------------------------------------------

  async function handleDeploy() {
    errorMessage = '';
    bannerCompletionState = null;
    bannerOperationType = 'deploy';
    dispatch('operation-start', { type: 'deploy', siteId: null });

    try {
      // 1. Ensure we have a signer
      const currentSession = get(session);

      if (!currentSigner && currentSession.pubkey && currentSession.signerType === 'extension') {
        const { signer: extSigner } = await createExtensionSigner();
        currentSigner = extSigner;
      }

      if (!currentSession.pubkey || !currentSigner) {
        // Anonymous deploy
        const { signer: anonSigner, pubkey, nsec } = await createAnonymousSigner();
        currentSigner = anonSigner;
        deployNsec = nsec;

        const npub = npubEncode(pubkey);

        session.set({
          pubkey,
          signerType: 'anonymous',
          displayName: null,
          avatar: null,
          npub,
        });

        saveAnonymousKey(anonSigner);

        dispatch('auth-change', {
          pubkey,
          signerType: 'anonymous',
          authenticated: true,
        });
      }

      const sess = get(session);
      const cfg = get(serverConfig);

      // 2. Hash phase
      progressDetails = 'Preparing...';
      deployState.update((s) => ({ ...s, step: 'hashing', progress: 0 }));

      const filesToDeploy = includedFiles;
      const hashedFiles = [];

      for (let i = 0; i < filesToDeploy.length; i++) {
        const file = filesToDeploy[i];
        progressDetails = `Hashing file ${i + 1} of ${filesToDeploy.length}: ${file.path}`;
        const sha256 = await hashFile(file.data);
        hashedFiles.push({ ...file, sha256 });
        const pct = Math.round(((i + 1) / filesToDeploy.length) * 100);
        deployState.update((s) => ({ ...s, progress: pct }));
      }

      // 3. Determine blossom URLs (use pre-fetched lists, filter out abandoned servers)
      let blossomUrls = [...new Set([NSITE_BLOSSOM, ...cfg.extraBlossoms, ...userBlossoms])];
      deployBlossomUrls = blossomUrls;
      givenUpServers = new Set();
      givenUpReactive = new Set();

      // 3a. Check existence — which blobs already exist?
      progressDetails = 'Checking servers...';
      checkProgress = null;
      deployState.update((s) => ({ ...s, step: 'checking', progress: 0 }));
      const existing = await checkExistence(hashedFiles, blossomUrls, (cp) => {
        checkProgress = cp;
        let totalChecked = 0;
        let totalItems = 0;
        for (const sc of Object.values(cp.serverChecks)) {
          totalChecked += sc.checked;
          totalItems += sc.total;
        }
        progressDetails = '';
        deployState.update((s) => ({ ...s, progress: totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0 }));
      }, givenUpServers);

      // 3b. Upload missing blobs
      progressDetails = 'Preparing uploads...';
      checkProgress = null;
      deployState.update((s) => ({ ...s, step: 'uploading', progress: 0 }));
      const needsUploadCount = hashedFiles.length - existing.size;
      if (needsUploadCount === 0) {
        progressDetails = 'All files already uploaded';
      }

      uploadResult = await uploadBlobs(hashedFiles, existing, currentSigner, blossomUrls, (progress) => {
        uploadProgress = progress;
        deployState.update((s) => ({ ...s, progress: Math.round((progress.completed / progress.total) * 100) }));
      }, givenUpServers);

      // 3c. HARD FAIL if any file is not on any server
      if (uploadResult.failed > 0) {
        const failedFiles = uploadResult.fileResults.filter(f => !f.success);

        const errorGroups = new Map();
        for (const f of failedFiles) {
          const err = (f.error ?? 'Unknown error').replace(/https?:\/\/[^:]+:\s*/g, '');
          if (!errorGroups.has(err)) errorGroups.set(err, []);
          errorGroups.get(err).push(f.path);
        }

        const parts = [`${uploadResult.failed} of ${uploadResult.total} files failed to upload.`];
        for (const [err, paths] of errorGroups) {
          parts.push(`\n${err} (${paths.length} files)`);
        }

        deployState.update((s) => ({ ...s, failedFiles: failedFiles.slice(0, 20) }));
        throw new Error(parts.join(''));
      }

      // 4. Publish phase
      deployState.update((s) => ({ ...s, step: 'publishing', progress: 0 }));
      progressDetails = 'Publishing manifest to relays...';

      let relayUrls = [...new Set([NSITE_RELAY, ...cfg.extraRelays, ...userRelays])];

      const activeBlossomUrls = blossomUrls.filter(u => !givenUpServers.has(u));
      publishResult = await publishManifest(currentSigner, hashedFiles, activeBlossomUrls, relayUrls, {
        spaFallback,
        kind: siteType === 'named' ? 35128 : 15128,
        dTag: siteType === 'named' ? dTag : undefined,
        title: deployTitle || undefined,
        description: deployDescription || undefined,
      });
      deployEvent = publishResult?.event ?? null;

      if (publishResult?.failureCount > 0 && publishResult?.successCount > 0) {
        const failedRelays = publishResult.results.filter(r => !r.success).map(r => `${r.relay}: ${r.message ?? 'rejected'}`);
        console.warn('Partial relay failures:', failedRelays);
      }

      // Remove given-up servers from user's extra blossoms config
      if (givenUpServers.size > 0) {
        serverConfig.update(c => ({
          ...c,
          extraBlossoms: c.extraBlossoms.filter(b => !givenUpServers.has(b)),
        }));
      }

      deployState.update((s) => ({ ...s, step: 'success', progress: 100 }));
      progressDetails = '';
      // Optimistically update local state so Manage tab shows the new site immediately
      existingManifest = deployEvent;
      if (deployEvent.kind === 35128) {
        const dTagVal = deployEvent.tags.find(t => t[0] === 'd')?.[1];
        if (dTagVal) {
          allSites = {
            ...allSites,
            named: [
              ...allSites.named.filter(s => {
                const sd = s.tags.find(t => t[0] === 'd')?.[1];
                return sd !== dTagVal;
              }),
              deployEvent,
            ],
          };
        }
      } else {
        allSites = { ...allSites, root: deployEvent };
      }
      // Also refresh from relays after a delay
      const postDeploySess = get(session);
      if (postDeploySess.pubkey) {
        setTimeout(() => fetchSiteInfo(postDeploySess.pubkey), 3000);
      }

      dispatch('deploy-success', {
        pubkey: get(session).pubkey,
        siteType,
        dTag: siteType === 'named' ? dTag : undefined,
        url: siteType === 'named'
          ? `${NSITE_GATEWAY_PROTOCOL}://${base36Encode(hexToBytes(get(session).pubkey))}.${NSITE_GATEWAY_HOST}/${dTag}`
          : `${NSITE_GATEWAY_PROTOCOL}://${get(session).npub}.${NSITE_GATEWAY_HOST}`,
        event: deployEvent,
        uploadResult,
        publishResult,
      });
      dispatch('operation-end', { type: 'deploy', siteId: deployEvent?.id, success: true });

    } catch (err) {
      errorMessage = err?.message ?? 'An unexpected error occurred.';
      deployState.update((s) => ({ ...s, step: 'error', error: errorMessage }));
      dispatch('deploy-error', { error: errorMessage, step: get(deployState).step });
      dispatch('operation-end', { type: 'deploy', siteId: null, success: false });
    }
  }
</script>

<!-- Login modal (only when no external signer) -->
{#if !signer}
  <LoginModal
    show={showLoginModal}
    on:close={() => (showLoginModal = false)}
    on:login={handleLogin}
  />
{/if}

<div class="deployer-widget" style="color: var(--_text);">
  <!-- Operation banner -->
  {#if showBanner}
    <div class="mb-3">
      <OperationBanner
        operationType={bannerOperationType}
        progress={bannerOperationType === 'deploy' ? $deployState.progress : 0}
        step={bannerOperationType === 'deploy' ? step : 'deleting'}
        completionState={bannerCompletionState}
        onNavigateBack={(bannerOperationType === 'deploy' && currentPage !== 'deploy') || (bannerOperationType === 'delete' && currentPage !== 'manage')
          ? () => { currentPage = bannerOperationType === 'deploy' ? 'deploy' : 'manage'; }
          : null}
      />
    </div>
  {/if}

  <!-- Tabs (only show when manage tab is available) -->
  {#if (allSites.root || allSites.named.length > 0) && $session.pubkey}
    <div class="flex gap-1 mb-4 bg-slate-800 rounded-lg p-1">
      <button
        on:click={() => { if (!isDangerousStep) currentPage = 'deploy'; }}
        disabled={isDangerousStep}
        class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
          {isDangerousStep ? 'opacity-40 cursor-not-allowed text-slate-500' : currentPage === 'deploy' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}"
      >
        Deploy
      </button>
      <button
        on:click={() => { if (!isDangerousStep) currentPage = 'manage'; }}
        disabled={isDangerousStep}
        class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
          {isDangerousStep ? 'opacity-40 cursor-not-allowed text-slate-500' : currentPage === 'manage' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}"
      >
        Manage
      </button>
    </div>
  {/if}

  <!-- Tab content -->
  {#if currentPage === 'manage'}
    <ManageSite
      sites={allSites}
      pubkey={$session.pubkey}
      relayUrls={deleteRelayUrls}
      blossomUrls={deleteBlossomUrls_list}
      signer={currentSigner}
      on:update={(e) => {
        const site = e.detail;
        currentPage = 'deploy';
        if (site.kind === 35128) {
          siteType = 'named';
          dTag = getManifestDTag(site) || '';
          dTagReadOnly = true;
        } else {
          siteType = 'root';
          dTag = '';
          dTagReadOnly = false;
        }
        deployTitle = getManifestTitle(site);
        deployDescription = getManifestDescription(site);
        resetForUpdate();
      }}
      on:site-removed={handleSiteRemoved}
      on:deleted={() => {
        setTimeout(() => fetchSiteInfo($session.pubkey), 5000);
      }}
      on:delete-start={handleDeleteStart}
      on:delete-end={handleDeleteEnd}
      on:deploy-new={() => {
        currentPage = 'deploy';
        resetForUpdate();
      }}
    />
  {:else}
    <!-- IDLE / SELECTING -->
    {#if step === 'idle' || step === 'selecting'}
      <DeployZone on:files-selected={handleFilesSelected} />

      <!-- Deploying-as indicator (only when not using external signer) -->
      {#if !signer}
        {#if $session.pubkey}
          <div class="flex items-center gap-2 mt-4 text-sm text-slate-400">
            <span>deploying as</span>
            {#if $session.avatar}
              <img src={$session.avatar} alt="" class="w-5 h-5 rounded-full" />
            {/if}
            <span class="text-purple-300 font-medium">{$session.displayName || $session.npub?.slice(0, 16) + '...'}</span>
          </div>
        {:else}
          <p class="text-slate-500 text-sm mt-4">
            or
            <button
              on:click={() => (showLoginModal = true)}
              class="text-purple-400 hover:text-purple-300 underline"
            >
              login with your nostr identity
            </button>
          </p>
        {/if}
      {/if}

    <!-- REVIEWING -->
    {:else if step === 'reviewing'}
      <section class="py-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-white">Review files</h2>
          <button
            on:click={resetDeploy}
            class="text-sm text-slate-400 hover:text-white transition-colors"
          >
            &larr; Start over
          </button>
        </div>

        <!-- Excluded VCS files notice -->
        {#if excludedCount > 0}
          <div class="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-300">
            <span class="text-slate-400">Auto-excluded</span> {excludedCount} VCS / system files (.git/, .DS_Store, etc.)
          </div>
        {/if}

        <!-- Secret / sensitive file warnings -->
        {#if fileWarnings.length > 0}
          <div class="mb-4 p-3 bg-amber-900/30 border border-amber-600/50 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span class="text-sm font-semibold text-amber-300">Potentially sensitive files detected</span>
            </div>
            <ul class="space-y-1.5">
              {#each fileWarnings as warning}
                <li class="flex items-center justify-between gap-2 text-sm">
                  <span class="text-amber-200/80 font-mono text-xs truncate">{warning.path}
                    <span class="text-amber-400/60 ml-1">({warning.type ?? 'secret'})</span>
                  </span>
                  {#if !excludedFiles.has(warning.path)}
                    <button
                      on:click={() => toggleExclude(warning.path)}
                      class="text-xs text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap"
                    >
                      Exclude
                    </button>
                  {:else}
                    <span class="text-xs text-slate-500">excluded</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Excluded files badge -->
        {#if userExcludedCount > 0}
          <div class="mb-2 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs font-medium">
              <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768l4.242 4.242m0 0L17.89 17.89M3 3l18 18" />
              </svg>
              {userExcludedCount} excluded
            </span>
          </div>
        {/if}

        <!-- File tree with overflow control -->
        <div class="relative">
          <div class="{fileListExpanded ? '' : 'max-h-64 overflow-hidden'}">
            <FileTree
              tree={fileTree}
              warnings={fileWarnings}
              onToggleExclude={toggleExclude}
              {fileDataMap}
              {excludedFiles}
            />
          </div>
          {#if !fileListExpanded && selectedFiles.length > 10}
            <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none"></div>
            <button
              on:click={() => (fileListExpanded = true)}
              class="relative w-full mt-1 py-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Show all {selectedFiles.length} files
            </button>
          {/if}
          {#if fileListExpanded && selectedFiles.length > 10}
            <button
              on:click={() => (fileListExpanded = false)}
              class="w-full mt-1 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              Collapse
            </button>
          {/if}
        </div>

        <!-- Ignored files summary -->
        {#if userExcludedCount > 0}
          {@const TRUNCATE_THRESHOLD = 10}
          {@const showAllExcluded = userExcludedPaths.length <= TRUNCATE_THRESHOLD}
          <div class="mt-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-slate-400">
                Excluded files ({userExcludedCount})
              </h3>
              {#if excludedFiles.size > 0}
                <button
                  on:click={() => {
                    for (const p of [...excludedFiles]) {
                      toggleExclude(p);
                    }
                  }}
                  class="text-xs text-purple-400 hover:text-purple-300"
                >
                  Re-include all
                </button>
              {/if}
            </div>
            <ul class="space-y-1">
              {#each (showAllExcluded || excludedSummaryExpanded ? userExcludedPaths : userExcludedPaths.slice(0, TRUNCATE_THRESHOLD)) as excludedPath}
                <li class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-mono text-slate-500 truncate">{excludedPath}</span>
                  <button
                    on:click={() => toggleExclude(excludedPath)}
                    class="text-purple-400 hover:text-purple-300 whitespace-nowrap flex-shrink-0"
                  >
                    Re-include
                  </button>
                </li>
              {/each}
            </ul>
            {#if !showAllExcluded && !excludedSummaryExpanded}
              <button
                on:click={() => (excludedSummaryExpanded = true)}
                class="mt-2 text-xs text-slate-400 hover:text-slate-300"
              >
                + {userExcludedPaths.length - TRUNCATE_THRESHOLD} more
              </button>
            {/if}
            {#if excludedSummaryExpanded && !showAllExcluded}
              <button
                on:click={() => (excludedSummaryExpanded = false)}
                class="mt-2 text-xs text-slate-400 hover:text-slate-300"
              >
                Show less
              </button>
            {/if}
          </div>
        {/if}

        <!-- Deploy options -->
        <div class="mt-4 space-y-4">
          <!-- Root/Named site selector -->
          <div>
            <p class="text-sm font-medium text-slate-300 mb-2">Site type</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="siteType"
                  value="root"
                  bind:group={siteType}
                  class="w-4 h-4 border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                />
                <span class="text-sm text-slate-300">Root site</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="siteType"
                  value="named"
                  bind:group={siteType}
                  class="w-4 h-4 border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                />
                <span class="text-sm text-slate-300">Named site</span>
              </label>
            </div>

            {#if siteType === 'root' && allSites.root && $session.pubkey && !dTagReadOnly}
              <div class="mt-3 p-3 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-amber-300">You already have a root site deployed</p>
                    <p class="text-xs text-amber-200/70 mt-1">
                      {$session.npub}.{NSITE_GATEWAY_HOST} &mdash;
                      {allSites.root.tags.filter(t => t[0] === 'path').length} files,
                      last published {new Date(allSites.root.created_at * 1000).toLocaleDateString()}
                    </p>
                    <button
                      on:click={() => handleGuardUpdate(allSites.root)}
                      class="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
                    >
                      Update existing site
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            {#if siteType === 'named'}
              <div class="mt-3">
                <label class="block text-sm text-slate-400 mb-1" for="dTagInput">
                  Site identifier (dTag)
                  {#if dTagReadOnly}
                    <span class="text-slate-500 text-xs ml-1">&mdash; cannot be changed on update</span>
                  {/if}
                </label>
                <input
                  id="dTagInput"
                  type="text"
                  value={dTag}
                  on:input={(e) => {
                    dTag = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                    e.target.value = dTag;
                  }}
                  placeholder="e.g. blog, portfolio, docs"
                  readonly={dTagReadOnly}
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white text-sm placeholder-slate-500 border transition-colors
                    {dTagError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-purple-500'}
                    {dTagReadOnly ? 'opacity-60 cursor-not-allowed' : ''}
                    focus:outline-none focus:ring-1"
                />
                {#if dTagError}
                  <p class="text-xs text-red-400 mt-1">{dTagError}</p>
                {/if}
                {#if matchingNamedSite}
                  <div class="mt-2 p-3 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                    <div class="flex items-start gap-2">
                      <svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div class="flex-1">
                        <p class="text-sm font-medium text-amber-300">You already have a named site with this identifier</p>
                        <p class="text-xs text-amber-200/70 mt-1">
                          {base36Encode(hexToBytes($session.pubkey))}.{NSITE_GATEWAY_HOST}/{dTag} &mdash;
                          {matchingNamedSite.tags.filter(t => t[0] === 'path').length} files,
                          last published {new Date(matchingNamedSite.created_at * 1000).toLocaleDateString()}
                        </p>
                        <button
                          on:click={() => handleGuardUpdate(matchingNamedSite)}
                          class="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
                        >
                          Update existing site
                        </button>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Title input (always visible) -->
          <div>
            <label class="block text-sm text-slate-400 mb-1" for="deployTitle">Title (optional)</label>
            <input
              id="deployTitle"
              type="text"
              bind:value={deployTitle}
              placeholder="My Awesome Site"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <!-- Description input (always visible) -->
          <div>
            <label class="block text-sm text-slate-400 mb-1" for="deployDescription">Description (optional)</label>
            <textarea
              id="deployDescription"
              bind:value={deployDescription}
              placeholder="A brief description of your site"
              rows="2"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            ></textarea>
          </div>

          <!-- SPA fallback checkbox -->
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={spaFallback}
              class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
            />
            <span class="text-sm text-slate-300">
              This is a single-page app &mdash; serve <code class="text-purple-400 bg-slate-800 px-1 rounded text-xs">index.html</code> for all routes
            </span>
          </label>
        </div>

        <!-- Advanced config -->
        <div class="mt-4">
          <AdvancedConfig />
        </div>

        <!-- Deploy button -->
        <div class="mt-6">
          <button
            on:click={handleDeploy}
            disabled={!canDeploy}
            class="w-full py-3 px-6 text-white font-semibold text-lg transition-colors
              {canDeploy ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'}"
            style="background-color: var(--_accent); border-radius: var(--_radius);"
          >
            {#if sitesLoading}Checking existing sites...{:else if $session.pubkey}Deploy{:else}Deploy Anonymously{/if}
          </button>
          {#if !$session.pubkey && !signer}
            <p class="text-center text-sm text-slate-500 mt-2">
              or
              <button
                on:click={() => (showLoginModal = true)}
                class="text-purple-400 hover:text-purple-300 underline"
              >
                login with your nostr identity
              </button>
            </p>
          {/if}
        </div>
      </section>

    <!-- HASHING / UPLOADING / PUBLISHING: Progress -->
    {:else if step === 'hashing' || step === 'checking' || step === 'uploading' || step === 'publishing'}
      <section class="py-4">
        <h2 class="text-xl font-semibold text-white mb-4">Deploying your site...</h2>
        <ProgressIndicator
          step={step}
          progress={$deployState.progress}
          details={progressDetails}
          {uploadProgress}
          {checkProgress}
          givenUpServers={givenUpReactive}
          serverCount={deployBlossomUrls.length}
          on:giveup={(e) => giveUpServer(e.detail)}
          on:undogiveup={(e) => undoGiveUp(e.detail)}
        />
      </section>

    <!-- SUCCESS -->
    {:else if step === 'success'}
      <section class="py-4">
        <SuccessPanel
          event={deployEvent}
          npub={$session.npub}
          nsec={deployNsec}
          signerType={$session.signerType}
          {uploadResult}
          {publishResult}
          givenUpServers={givenUpReactive}
          {siteType}
          {dTag}
          pubkeyHex={$session.pubkey || ''}
          on:manage={() => (currentPage = 'manage')}
          on:deploy-another={resetForUpdate}
        />
      </section>

    <!-- ERROR -->
    {:else if step === 'error'}
      <section class="py-4">
        <div class="bg-red-900/30 border border-red-700/50 rounded-lg p-6">
          <div class="flex items-start gap-3 mb-4">
            <svg class="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 class="text-lg font-semibold text-white mb-1">Deploy failed</h2>
              <p class="text-red-300 text-sm">{errorMessage}</p>
            </div>
          </div>
          <button
            on:click={() => deployState.update((s) => ({ ...s, step: 'reviewing' }))}
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .deployer-widget {
    --_accent: var(--deployer-accent, #a78bfa);
    --_bg: var(--deployer-bg, #0f172a);
    --_text: var(--deployer-text, #f1f5f9);
    --_radius: var(--deployer-radius, 0.5rem);
  }
</style>

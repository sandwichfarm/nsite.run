<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { session, deployState, serverConfig } from './lib/store.js';
  import {
    createAnonymousSigner,
    createExtensionSigner,
    restoreAnonymousSigner,
    saveAnonymousKey,
    NSITE_RELAY,
    NSITE_BLOSSOM,
    DEFAULT_RELAYS,
    fetchRelayList,
    fetchBlossomList,
    fetchProfile,
    fetchExistingManifest,
  } from './lib/nostr.js';
  import { npubEncode } from 'nostr-tools/nip19';
  import { hashFile } from './lib/crypto.js';
  import { checkExistence, uploadBlobs, deleteBlobs } from './lib/upload.js';
  import { publishManifest, publishEmptyManifest, publishDeletionEvent } from './lib/publish.js';

  import Navbar from './components/Navbar.svelte';
  import DeployZone from './components/DeployZone.svelte';
  import FileTree from './components/FileTree.svelte';
  import ProgressIndicator from './components/ProgressIndicator.svelte';
  import SuccessPanel from './components/SuccessPanel.svelte';
  import LoginModal from './components/LoginModal.svelte';
  import AdvancedConfig from './components/AdvancedConfig.svelte';
  import ToolsResources from './components/ToolsResources.svelte';
  import SiteInfoCard from './components/SiteInfoCard.svelte';
  import DeleteConfirmModal from './components/DeleteConfirmModal.svelte';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let showLoginModal = false;

  // Files & tree state (set when DeployZone fires 'files-selected')
  let selectedFiles = [];
  let fileTree = null;
  let fileWarnings = [];
  let excludedFiles = new Set();
  let excludedCount = 0;

  // Deploy options
  let spaFallback = false;

  // Current signer (not persisted — lost on reload)
  let currentSigner = null;
  let deployNsec = null;

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

  // Deletion state
  let showDeleteConfirm = false;
  let deleteInProgress = false;
  let deleteResults = null;

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
    // Restore anonymous session from sessionStorage
    const sess = get(session);
    if (sess.signerType === 'anonymous' && !currentSigner) {
      const restored = await restoreAnonymousSigner();
      if (restored) {
        currentSigner = restored.signer;
        deployNsec = restored.nsec;
        // Fetch existing site info for returning anonymous users
        fetchSiteInfo(sess.pubkey);
      } else {
        // Key not found in sessionStorage — session is stale, clear it
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
      }).catch(() => { /* ignore */ });
    }
    if (sess.pubkey && sess.signerType !== 'anonymous') {
      fetchUserServers(sess.pubkey);
      // Fetch existing site info for returning users
      fetchSiteInfo(sess.pubkey);
    }
  });

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  $: step = $deployState.step;
  $: includedFiles = selectedFiles.filter((f) => !excludedFiles.has(f.path));
  $: fileDataMap = new Map(selectedFiles.map(f => [f.path, f.data]));
  $: userExcludedCount = excludedFiles.size;
  $: userExcludedPaths = [...excludedFiles]; // array for rendering

  // Derived values for SiteInfoCard
  $: existingSiteUrl = (() => {
    if (!existingManifest || !$session.npub) return '';
    try { return `https://${$session.npub}.${new URL(NSITE_BLOSSOM).host}`; } catch { return ''; }
  })();
  $: existingPublishDate = existingManifest ? new Date(existingManifest.created_at * 1000) : null;
  $: existingFileCount = existingManifest ? existingManifest.tags.filter(t => t[0] === 'path').length : 0;

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

  function resetDeploy() {
    selectedFiles = [];
    fileTree = null;
    fileWarnings = [];
    excludedFiles = new Set();
    excludedCount = 0;
    fileListExpanded = false;
    excludedSummaryExpanded = false;
    spaFallback = false;
    currentSigner = null;
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
    siteInfoLoading = true;
    try {
      const relayList = [...new Set([NSITE_RELAY, ...userRelays, ...(userRelays.length === 0 ? DEFAULT_RELAYS : [])])];
      const result = await fetchExistingManifest(pubkey, relayList);
      existingManifest = result;
    } catch {
      existingManifest = null;
    } finally {
      siteInfoLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  async function handleDeleteSite() {
    if (!currentSigner || !existingManifest) return;
    deleteInProgress = true;
    deleteResults = null;

    try {
      const relays = deleteRelayUrls;
      const blossoms = deleteBlossomUrls_list;

      // 1. Publish empty manifest to all relays
      const emptyResult = await publishEmptyManifest(currentSigner, relays);

      // 2. Publish kind 5 deletion event referencing the manifest event ID
      const deletionResult = await publishDeletionEvent(currentSigner, existingManifest.id, relays);

      // Merge relay results (combine empty manifest + deletion event results)
      const relayResults = emptyResult.results.map((r, i) => ({
        relay: r.relay,
        success: r.success,
        message: r.success
          ? (deletionResult.results[i]?.success ? 'manifest cleared + deletion event sent' : 'manifest cleared (deletion event failed)')
          : r.message ?? 'failed',
      }));

      // 3. Delete blobs from blossom servers
      const sha256List = [...new Set(
        existingManifest.tags
          .filter(t => t[0] === 'path' && t[2])
          .map(t => t[2])
      )];

      let blossomResults = [];
      if (sha256List.length > 0) {
        const blobResult = await deleteBlobs(currentSigner, sha256List, blossoms);
        blossomResults = blobResult.results;
      }

      deleteResults = { relayResults, blossomResults };

      // Clear existing manifest — site is deleted
      existingManifest = null;

    } catch (err) {
      deleteResults = {
        relayResults: [{ relay: 'error', success: false, message: err?.message ?? 'Unexpected error' }],
        blossomResults: [],
      };
    } finally {
      deleteInProgress = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Deploy handler
  // ---------------------------------------------------------------------------

  async function handleDeploy() {
    errorMessage = '';

    try {
      // 1. Ensure we have a signer
      const currentSession = get(session);

      if (!currentSigner && currentSession.pubkey && currentSession.signerType === 'extension') {
        // Session restored from localStorage but signer lost — re-acquire from extension
        const { signer } = await createExtensionSigner();
        currentSigner = signer;
      }

      if (!currentSession.pubkey || !currentSigner) {
        // Anonymous deploy
        const { signer, pubkey, nsec } = await createAnonymousSigner();
        currentSigner = signer;
        deployNsec = nsec;

        const npub = npubEncode(pubkey);

        session.set({
          pubkey,
          signerType: 'anonymous',
          displayName: null,
          avatar: null,
          npub,
        });

        saveAnonymousKey(signer);
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
        // Overall progress: average across all servers
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

        // Group by error message to deduplicate
        const errorGroups = new Map();
        for (const f of failedFiles) {
          // Extract server-agnostic error (strip URL prefix)
          const err = (f.error ?? 'Unknown error').replace(/https?:\/\/[^:]+:\s*/g, '');
          if (!errorGroups.has(err)) errorGroups.set(err, []);
          errorGroups.get(err).push(f.path);
        }

        // Build structured error for the UI
        const parts = [`${uploadResult.failed} of ${uploadResult.total} files failed to upload.`];
        for (const [err, paths] of errorGroups) {
          parts.push(`\n${err} (${paths.length} files)`);
        }

        // Store failed files for the error panel to show
        deployState.update((s) => ({ ...s, failedFiles: failedFiles.slice(0, 20) }));
        throw new Error(parts.join(''));
      }

      // 4. Publish phase
      deployState.update((s) => ({ ...s, step: 'publishing', progress: 0 }));
      progressDetails = 'Publishing manifest to relays...';

      // Determine relay URLs (use pre-fetched list)
      let relayUrls = [...new Set([NSITE_RELAY, ...cfg.extraRelays, ...userRelays])];

      const activeBlossomUrls = blossomUrls.filter(u => !givenUpServers.has(u));
      publishResult = await publishManifest(currentSigner, hashedFiles, activeBlossomUrls, relayUrls, spaFallback);
      deployEvent = publishResult?.event ?? null;

      // Warn about partial relay failures (some accepted, some rejected)
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
      // Update existingManifest so SiteInfoCard reflects the latest deploy when user resets
      existingManifest = deployEvent;

    } catch (err) {
      errorMessage = err?.message ?? 'An unexpected error occurred.';
      deployState.update((s) => ({ ...s, step: 'error', error: errorMessage }));
    }
  }
</script>

<!-- Login modal -->
<LoginModal
  show={showLoginModal}
  on:close={() => (showLoginModal = false)}
  on:login={(e) => {
    currentSigner = e.detail?.signer ?? null;
    showLoginModal = false;
    // Fetch NIP-65 relay list and 10063 blossom list in background
    const sess = get(session);
    if (sess.pubkey && sess.signerType !== 'anonymous') {
      fetchUserServers(sess.pubkey);
    }
    // Fetch existing site info on login
    if (sess.pubkey) {
      fetchSiteInfo(sess.pubkey);
    }
  }}
/>

<!-- App shell -->
<div class="min-h-screen bg-slate-900 text-gray-100">

  <Navbar onLoginClick={() => (showLoginModal = true)} {deployNsec} />

  <main>

    <!-- ===== IDLE / SELECTING: Deploy Zone ===== -->
    {#if step === 'idle' || step === 'selecting'}
      {#if (existingManifest || siteInfoLoading) && $session.pubkey}
        <section class="max-w-2xl mx-auto px-4 pt-8">
          <SiteInfoCard
            siteUrl={existingSiteUrl}
            publishDate={existingPublishDate}
            fileCount={existingFileCount}
            loading={siteInfoLoading}
            on:update={resetForUpdate}
            on:delete={() => { showDeleteConfirm = true; deleteResults = null; }}
          />
        </section>
      {/if}

      <!-- Hero: full viewport -->
      <section class="min-h-screen flex flex-col items-center justify-center px-4">
        <div class="text-center mb-10">
          <h1 class="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            Deploy to the <span class="text-purple-400">decentralized web</span>
          </h1>
          <p class="text-slate-400 text-xl max-w-xl mx-auto">
            Drop your <span class="font-semibold">static website</span> files below. No account needed.
          </p>
        </div>

        <div class="w-full max-w-2xl">
          <DeployZone on:files-selected={handleFilesSelected} />
        </div>

        {#if $session.pubkey}
          <div class="flex items-center gap-2 mt-6 text-sm text-slate-400">
            <span>deploying as</span>
            {#if $session.avatar}
              <img src={$session.avatar} alt="" class="w-5 h-5 rounded-full" />
            {/if}
            <span class="text-purple-300 font-medium">{$session.displayName || $session.npub?.slice(0, 16) + '...'}</span>
          </div>
        {:else}
          <p class="text-slate-500 text-sm mt-6">
            or
            <button
              on:click={() => (showLoginModal = true)}
              class="text-purple-400 hover:text-purple-300 underline"
            >
              login with your nostr identity
            </button>
          </p>
        {/if}

        <!-- Scroll nudge -->
        <button
          on:click={() => document.getElementById('what')?.scrollIntoView({ behavior: 'smooth' })}
          class="mt-10 flex flex-col items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors animate-bounce-subtle"
        >
          <span class="text-sm">What is an nsite?</span>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </section>

      <!-- Educational content (only in idle) -->
      <div class="max-w-3xl mx-auto px-4 space-y-16 py-16" id="what">
        <!-- What are nsites? -->
        <section>
          <h2 class="text-2xl font-semibold text-white mb-4">What are nsites?</h2>
          <p class="text-slate-300 leading-relaxed">
            nsites are static websites hosted on the nostr network. Your site's files are stored as
            cryptographic blobs on blossom servers and made discoverable via signed nostr events. Anyone
            running a gateway can serve your site — no central host controls it.
          </p>
        </section>

        <!-- How it works -->
        <section>
          <h2 class="text-2xl font-semibold text-white mb-4">How it works</h2>
          <ol class="space-y-4">
            {#each [
              { n: '1', title: 'Choose your files', desc: 'Drop a folder or archive containing your site. The tool scans for sensitive files and warns you before uploading.' },
              { n: '2', title: 'Hash & upload', desc: 'Each file is SHA-256 hashed and uploaded to Blossom servers. Files already present are skipped — only changes are uploaded.' },
              { n: '3', title: 'Publish manifest', desc: 'A signed nostr event (kind 15128) maps your file paths to their hashes. Gateways query this event to serve your site.' },
            ] as step}
              <li class="flex gap-4">
                <div class="w-8 h-8 rounded-full bg-purple-700/60 flex items-center justify-center text-purple-200 font-bold text-sm flex-shrink-0">
                  {step.n}
                </div>
                <div>
                  <p class="font-medium text-white">{step.title}</p>
                  <p class="text-slate-400 text-sm mt-1">{step.desc}</p>
                </div>
              </li>
            {/each}
          </ol>
        </section>

        <!-- Why nostr? -->
        <section>
          <h2 class="text-2xl font-semibold text-white mb-4">Why nostr?</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each [
              { title: 'Censorship-resistant', desc: 'No single server controls your site. It lives on multiple Blossom servers simultaneously.' },
              { title: 'Self-sovereign identity', desc: 'Your npub is your domain. You own your site the same way you own your nostr identity.' },
              { title: 'Portable', desc: 'Works across any gateway. If one goes down, another serves the same content.' },
              { title: 'No accounts needed', desc: 'Deploy anonymously with a generated key, or use your existing nostr identity.' },
            ] as item}
              <div class="bg-slate-800 rounded-lg p-4">
                <p class="font-medium text-white mb-1">{item.title}</p>
                <p class="text-slate-400 text-sm">{item.desc}</p>
              </div>
            {/each}
          </div>
        </section>

        <!-- Tools & Resources -->
        <section id="tools">
          <ToolsResources />
        </section>
      </div>

    <!-- ===== REVIEWING: File tree + options ===== -->
    {:else if step === 'reviewing'}
      <section class="max-w-3xl mx-auto px-4 py-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-white">Review files</h2>
          <button
            on:click={resetDeploy}
            class="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Start over
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
        <div class="mt-4 space-y-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={spaFallback}
              class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
            />
            <span class="text-sm text-slate-300">
              This is a single-page app — serve <code class="text-purple-400 bg-slate-800 px-1 rounded text-xs">index.html</code> for all routes
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
            class="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-lg transition-colors"
          >
            {$session.pubkey ? 'Deploy' : 'Deploy Anonymously'}
          </button>
          {#if !$session.pubkey}
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

    <!-- ===== HASHING / UPLOADING / PUBLISHING: Progress ===== -->
    {:else if step === 'hashing' || step === 'checking' || step === 'uploading' || step === 'publishing'}
      <section class="max-w-3xl mx-auto px-4 py-10">
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

    <!-- ===== SUCCESS ===== -->
    {:else if step === 'success'}
      <section class="max-w-3xl mx-auto px-4 py-10">
        <SuccessPanel
          event={deployEvent}
          npub={$session.npub}
          nsec={deployNsec}
          signerType={$session.signerType}
          {uploadResult}
          {publishResult}
          givenUpServers={givenUpReactive}
          on:update={resetForUpdate}
        />
        <div class="mt-4 text-center">
          <button
            on:click={resetDeploy}
            class="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Deploy another site
          </button>
        </div>
      </section>

    <!-- ===== ERROR ===== -->
    {:else if step === 'error'}
      <section class="max-w-3xl mx-auto px-4 py-10">
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

  </main>

  <DeleteConfirmModal
    show={showDeleteConfirm}
    relayUrls={deleteRelayUrls}
    blossomUrls={deleteBlossomUrls_list}
    blobCount={deleteBlobCount}
    deleting={deleteInProgress}
    results={deleteResults}
    on:confirm={handleDeleteSite}
    on:close={() => { showDeleteConfirm = false; deleteResults = null; }}
  />
</div>

<script>
  /**
   * Props:
   *   step           - 'hashing' | 'checking' | 'uploading' | 'publishing' | 'done'
   *   progress       - 0-100 for the current step
   *   details        - string description
   *   uploadProgress - full upload progress object (from uploadBlobs callback)
   *   checkProgress  - { total, serverChecks: Record<url, { checked, found, total }> }
   */
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let step = 'hashing';
  export let progress = 0;
  export let details = '';
  export let uploadProgress = null;
  export let checkProgress = null;
  export let givenUpServers = new Set();
  export let serverCount = 0;

  function canGiveUp(url, allServerData, currentStep) {
    if (serverCount < 2) return false;
    if (givenUpServers.has(url)) return false;
    // Can't give up the last active server
    const activeCount = serverCount - givenUpServers.size;
    if (activeCount <= 1) return false;

    // Server already finished all its work — nothing to give up
    const self = allServerData[url];
    if (self) {
      if (currentStep === 'checking' && self.checked >= self.total) return false;
      if (currentStep !== 'checking' && (self.completed + self.skipped + self.failed) >= self.total) return false;
    }

    const entries = Object.entries(allServerData).filter(([u]) => u !== url && !givenUpServers.has(u));
    if (entries.length === 0) return false;

    // >50% of other servers must be complete
    const completedOthers = entries.filter(([, d]) => {
      if (currentStep === 'checking') return d.checked === d.total;
      return (d.completed + d.skipped + d.failed) === d.total;
    });
    if (completedOthers.length / entries.length <= 0.5) return false;

    // This server must be struggling
    if (currentStep === 'checking') {
      return self.checked < self.total;
    } else {
      return self.failed > 0 || (self.retrying ?? 0) > 0;
    }
  }

  const STEPS = [
    { id: 'hashing', label: 'Hashing' },
    { id: 'checking', label: 'Checking' },
    { id: 'uploading', label: 'Uploading' },
    { id: 'publishing', label: 'Publishing' },
    { id: 'done', label: 'Done' },
  ];

  $: currentIdx = STEPS.findIndex((s) => s.id === step);
  $: stepStates = STEPS.map((s, i) => {
    if (step === 'done') return 'complete';
    if (i < currentIdx) return 'complete';
    if (i === currentIdx) return 'current';
    return 'future';
  });

  // Server colors
  const SERVER_COLORS = [
    'text-purple-400', 'text-cyan-400', 'text-amber-400', 'text-pink-400',
    'text-lime-400', 'text-blue-400', 'text-orange-400', 'text-teal-400',
  ];

  function shortUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  // Compute bar segments for a server (upload phase)
  function serverBarSegments(sp) {
    if (!sp || sp.total === 0) return { green: 0, amber: 0, red: 0, gray: 100 };
    const green = Math.round(((sp.completed + sp.skipped) / sp.total) * 100);
    const amber = Math.round(((sp.retrying ?? 0) / sp.total) * 100);
    const red = Math.round((sp.failed / sp.total) * 100);
    const gray = Math.max(0, 100 - green - amber - red);
    return { green, amber, red, gray };
  }

  // Compute overall upload bar segments
  function overallBarSegments(up) {
    if (!up || up.total === 0) return { green: 0, yellow: 0, red: 0, gray: 100 };
    const total = up.total;
    const green = Math.round((up.uploaded / total) * 100);
    const yellow = Math.round((up.skipped / total) * 100);
    const red = Math.round((up.failed / total) * 100);
    const gray = Math.max(0, 100 - green - yellow - red);
    return { green, yellow, red, gray };
  }
</script>

<div class="bg-slate-800 rounded-lg p-6">
  <!-- Step pills -->
  <div class="flex flex-wrap gap-2 mb-6">
    {#each STEPS as s, i}
      {@const state = stepStates[i]}
      <div
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
          {state === 'complete' ? 'bg-green-800/60 text-green-300' : ''}
          {state === 'current' ? 'bg-purple-700/60 text-purple-200 ring-1 ring-purple-500' : ''}
          {state === 'future' ? 'bg-slate-700 text-slate-400' : ''}"
      >
        {#if state === 'complete'}
          <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        {:else if state === 'current'}
          <svg class="w-3.5 h-3.5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        {:else}
          <div class="w-3.5 h-3.5 rounded-full border border-slate-500" />
        {/if}
        {s.label}
      </div>
    {/each}
  </div>

  {#if step === 'checking' && checkProgress}
    <!-- Checking phase: per-server progress bars -->
    <div class="mb-3">
      <div class="flex justify-between text-xs text-slate-400 mb-1">
        <span>Checking existence on {Object.keys(checkProgress.serverChecks).length} servers</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div class="bg-purple-500 h-2 rounded-full transition-all duration-300" style="width: {progress}%" />
      </div>
    </div>

    <div class="space-y-2 mb-4">
      {#each Object.entries(checkProgress.serverChecks) as [url, sc], i}
        {@const pct = sc.total > 0 ? Math.round((sc.checked / sc.total) * 100) : 0}
        {@const isGivenUp = givenUpServers.has(url)}
        <div class:opacity-40={isGivenUp}>
          <div class="flex items-center gap-2 text-xs mb-0.5">
            <span class="{SERVER_COLORS[i % SERVER_COLORS.length]} font-medium {isGivenUp ? 'line-through' : ''}">{shortUrl(url)}</span>
            <span class="text-slate-500 ml-auto">
              {#if isGivenUp}
                <button class="text-purple-400 hover:underline" on:click={() => dispatch('undogiveup', url)}>undo</button>
              {:else}
                {sc.checked}/{sc.total}
                {#if sc.found > 0}
                  <span class="text-green-400">{sc.found} found</span>
                {/if}
                {#if canGiveUp(url, checkProgress.serverChecks, 'checking')}
                  <button class="text-slate-500 hover:text-red-400 ml-2" on:click={() => dispatch('giveup', url)}>give up</button>
                {/if}
              {/if}
            </span>
          </div>
          <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div class="bg-purple-500 transition-all duration-300 rounded-full" style="width: {pct}%"></div>
          </div>
        </div>
      {/each}
    </div>

  {:else if step === 'uploading' && uploadProgress}
    <!-- Upload-specific progress: color-segmented bars -->
    {@const overall = overallBarSegments(uploadProgress)}

    <!-- Overall bar -->
    <div class="mb-4">
      <div class="flex justify-between text-xs text-slate-400 mb-1">
        <span>
          {uploadProgress.completed}/{uploadProgress.total} files
          {#if uploadProgress.skipped > 0}
            <span class="text-slate-500">({uploadProgress.skipped} already exist)</span>
          {/if}
        </span>
        <span>
          {#if uploadProgress.failed > 0}
            <span class="text-red-400">{uploadProgress.failed} failed</span>
          {/if}
        </span>
      </div>
      <div class="w-full h-3 bg-slate-700 rounded-full overflow-hidden flex">
        {#if overall.green > 0}
          <div class="bg-green-500 transition-all duration-300" style="width: {overall.green}%"></div>
        {/if}
        {#if overall.yellow > 0}
          <div class="bg-yellow-500 transition-all duration-300" style="width: {overall.yellow}%"></div>
        {/if}
        {#if overall.red > 0}
          <div class="bg-red-500 transition-all duration-300" style="width: {overall.red}%"></div>
        {/if}
      </div>
    </div>

    <!-- Per-server bars -->
    {#if uploadProgress.serverProgress}
      <div class="space-y-2 mb-4">
        {#each Object.entries(uploadProgress.serverProgress) as [url, sp], i}
          {@const seg = serverBarSegments(sp)}
          {@const isGivenUp = givenUpServers.has(url)}
          <div class:opacity-40={isGivenUp}>
            <div class="flex items-center gap-2 text-xs mb-0.5">
              <span class="{SERVER_COLORS[i % SERVER_COLORS.length]} font-medium {isGivenUp ? 'line-through' : ''}">{shortUrl(url)}</span>
              <span class="text-slate-500 ml-auto">
                {#if isGivenUp}
                  <button class="text-purple-400 hover:underline" on:click={() => dispatch('undogiveup', url)}>undo</button>
                {:else}
                  {sp.completed + sp.skipped}/{sp.total}
                  {#if (sp.retrying ?? 0) > 0}
                    <span class="text-amber-400">{sp.retrying} retrying</span>
                  {/if}
                  {#if sp.failed > 0}
                    <span class="text-red-400">{sp.failed} fail</span>
                  {/if}
                  {#if canGiveUp(url, uploadProgress.serverProgress, 'uploading')}
                    <button class="text-slate-500 hover:text-red-400 ml-2" on:click={() => dispatch('giveup', url)}>give up</button>
                  {/if}
                {/if}
              </span>
            </div>
            <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
              {#if seg.green > 0}
                <div class="bg-green-500 transition-all duration-300" style="width: {seg.green}%"></div>
              {/if}
              {#if seg.amber > 0}
                <div class="bg-amber-500 transition-all duration-300" style="width: {seg.amber}%"></div>
              {/if}
              {#if seg.red > 0}
                <div class="bg-red-500 transition-all duration-300" style="width: {seg.red}%"></div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Current file -->
    {#if uploadProgress.current}
      <p class="text-xs text-slate-500 truncate">{uploadProgress.current}</p>
    {/if}

  {:else if step !== 'done'}
    <!-- Non-upload steps: simple progress bar -->
    <div class="mb-3">
      <div class="flex justify-between text-xs text-slate-400 mb-1">
        <span>{STEPS.find((s) => s.id === step)?.label ?? ''}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          class="bg-purple-500 h-2 rounded-full transition-all duration-300"
          style="width: {progress}%"
        />
      </div>
    </div>
  {:else}
    <div class="flex items-center gap-2 text-green-400 mb-3">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="font-medium">Deploy complete!</span>
    </div>
  {/if}

  <!-- Details text (for non-upload, non-checking steps) -->
  {#if details && step !== 'uploading' && step !== 'checking'}
    <p class="text-sm text-slate-400">{details}</p>
  {/if}
</div>

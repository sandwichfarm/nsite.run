<script>
  /**
   * Props:
   *   tree             - nested tree nodes from buildFileTree (array or single node)
   *   warnings         - [{path, type, details}] from scanFiles
   *   onToggleExclude  - function(path) called when user toggles exclude checkbox
   *   fileDataMap      - Map<path, ArrayBuffer> for inline file preview
   *   excludedFiles    - Set<path> externally managed by App.svelte
   */
  export let tree = null;
  export let warnings = [];
  export let onToggleExclude = () => {};
  export let fileDataMap = new Map(); // Map<path, ArrayBuffer>
  export let excludedFiles = new Set(); // externally-managed excluded paths from App.svelte

  // Text file extensions for inline preview
  const TEXT_EXTENSIONS = new Set([
    'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
    'json', 'yaml', 'yml', 'md', 'txt', 'svg', 'xml', 'toml',
    'csv', 'sh', 'bash', 'zsh', 'py', 'rb', 'rs', 'go', 'java',
    'c', 'cpp', 'h', 'hpp', 'vue', 'svelte', 'astro', 'php',
    'sql', 'graphql', 'gql', 'env', 'gitignore', 'dockerignore',
    'dockerfile', 'makefile', 'lock', 'conf', 'cfg', 'ini', 'log',
  ]);

  // Preview state
  let previewPath = null;     // path of currently previewed file, null = none open
  let previewLines = [];      // array of text lines for current preview
  let previewLinesShown = 100; // how many lines to show (grows by 100 on "Show more")
  let previewIsBinary = false; // true if file extension matches binary pattern

  // Track which directories are expanded/collapsed
  let collapsedDirs = new Set();

  // Build a lookup map for fast warning checks
  $: warningMap = buildWarningMap(warnings);

  // Normalize tree: if array, wrap as root children; if single node, use as-is
  $: nodes = Array.isArray(tree) ? tree : (tree?.children ?? (tree ? [tree] : []));

  function buildWarningMap(warns) {
    const m = new Map();
    if (!warns) return m;
    for (const w of warns) {
      if (!m.has(w.path)) m.set(w.path, []);
      m.get(w.path).push(w);
    }
    return m;
  }

  function toggleDir(path) {
    const next = new Set(collapsedDirs);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsedDirs = next;
  }

  function collectFilePaths(node) {
    if (!node.isDir) return [node.path];
    const paths = [];
    for (const child of node.children ?? []) {
      paths.push(...collectFilePaths(child));
    }
    return paths;
  }

  function toggleExclude(path, node) {
    if (node && node.isDir) {
      // Recursive: collect all child file paths
      const childPaths = collectFilePaths(node);
      const allExcluded = childPaths.every(p => excludedFiles.has(p));
      for (const p of childPaths) {
        if (allExcluded) {
          onToggleExclude(p); // re-include all
        } else {
          if (!excludedFiles.has(p)) {
            onToggleExclude(p); // exclude those not yet excluded
          }
        }
      }
    } else {
      onToggleExclude(path);
    }
  }

  function humanSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function dirSize(node) {
    if (!node.isDir) return node.size ?? 0;
    let total = 0;
    for (const child of node.children ?? []) {
      total += dirSize(child);
    }
    return total;
  }

  function isTextFile(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return TEXT_EXTENSIONS.has(ext);
  }

  function togglePreview(node) {
    if (previewPath === node.path) {
      // Collapse — close preview
      previewPath = null;
      previewLines = [];
      previewLinesShown = 100;
      previewIsBinary = false;
      return;
    }

    // Open preview for this file
    previewPath = node.path;
    previewLinesShown = 100;

    if (!isTextFile(node.name)) {
      previewIsBinary = true;
      previewLines = [];
      return;
    }

    previewIsBinary = false;
    const data = fileDataMap.get(node.path);
    if (!data) {
      previewLines = ['[File data not available]'];
      return;
    }

    try {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
      previewLines = text.split('\n');
    } catch {
      previewIsBinary = true;
      previewLines = [];
    }
  }

  function showMoreLines() {
    previewLinesShown += 100;
  }
</script>

<div class="bg-slate-800 rounded-lg p-4 text-sm font-mono">
  {#each nodes as node}
    {#if node.isDir}
      <!-- Directory node -->
      {@const dirChildPaths = collectFilePaths(node)}
      {@const dirAllExcluded = dirChildPaths.length > 0 && dirChildPaths.every(p => excludedFiles.has(p))}
      <div class="my-0.5">
        <button
          class="flex items-center gap-1.5 py-0.5 w-full text-left hover:bg-slate-700/40 rounded px-1 -mx-1 group {dirAllExcluded ? 'opacity-40' : ''}"
          on:click={() => toggleDir(node.path)}
        >
          <svg
            class="w-3 h-3 text-slate-400 transition-transform flex-shrink-0 {collapsedDirs.has(node.path) ? '' : 'rotate-90'}"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <svg class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <span class="text-indigo-300 font-medium flex-1 truncate">{node.name}/</span>
          <span class="text-xs text-slate-500 flex-shrink-0">{humanSize(dirSize(node))}</span>

          <!-- Hover-reveal exclude toggle for directories -->
          <button
            class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-600"
            on:click|stopPropagation={() => toggleExclude(node.path, node)}
            title="Exclude directory"
          >
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </button>

        {#if !collapsedDirs.has(node.path) && node.children}
          <div class="ml-4 border-l border-slate-700/50 pl-2">
            <svelte:self
              tree={node.children}
              {warnings}
              {onToggleExclude}
              {fileDataMap}
              {excludedFiles}
            />
          </div>
        {/if}
      </div>
    {:else}
      <!-- File node -->
      {@const nodeWarnings = warningMap.get(node.path) ?? []}
      {@const isExcluded = excludedFiles.has(node.path)}
      <div class="my-0.5">
        <div class="flex items-center gap-1.5 py-0.5 group hover:bg-slate-700/40 rounded px-1 -mx-1">
          <svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>

          <!-- clickable filename for preview -->
          <button
            class="flex-1 truncate text-left {isExcluded ? 'line-through text-slate-500 opacity-50' : 'text-slate-300 hover:text-purple-300'}"
            on:click={() => togglePreview(node)}
            title="Click to preview"
          >
            {node.name}
          </button>

          {#if node.size != null}
            <span class="text-xs text-slate-500 flex-shrink-0">{humanSize(node.size)}</span>
          {/if}

          <!-- Hover-reveal exclude toggle (all non-warned files) -->
          {#if nodeWarnings.length === 0}
            <button
              class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-600"
              on:click|stopPropagation={() => toggleExclude(node.path, node)}
              title={isExcluded ? 'Re-include file' : 'Exclude file'}
            >
              {#if isExcluded}
                <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              {:else}
                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              {/if}
            </button>
          {/if}

          {#if nodeWarnings.length > 0}
            <div class="flex items-center gap-1 flex-shrink-0" title={nodeWarnings.map((w) => w.type + (w.details ? ': ' + w.details : '')).join('; ')}>
              <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <label class="flex items-center gap-1 cursor-pointer text-xs text-amber-400">
                <input
                  type="checkbox"
                  checked={isExcluded}
                  on:change={() => toggleExclude(node.path, node)}
                  class="w-3 h-3 rounded border-amber-600 bg-slate-700 accent-amber-500"
                />
                Exclude
              </label>
            </div>
          {/if}
        </div>

        <!-- Inline preview panel -->
        {#if previewPath === node.path}
          <div class="ml-5 mt-1 mb-2 bg-slate-900 border border-slate-700 rounded p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
            {#if previewIsBinary}
              <p class="text-slate-500 italic">Binary file — cannot preview</p>
            {:else if previewLines.length === 0}
              <p class="text-slate-500 italic">Empty file</p>
            {:else}
              <pre class="text-slate-300 whitespace-pre-wrap break-words">{previewLines.slice(0, previewLinesShown).join('\n')}</pre>
              {#if previewLines.length > previewLinesShown}
                <button
                  on:click={showMoreLines}
                  class="mt-2 text-purple-400 hover:text-purple-300 text-xs font-sans"
                >
                  Show more ({previewLines.length - previewLinesShown} lines remaining)
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<script>
  import { createEventDispatcher } from 'svelte';
  import { pickDirectory, pickArchive, autoExcludeVCS, buildFileTree, extractZip, extractTarGz } from '@nsite/deployer/files';
  import { scanFiles } from '@nsite/deployer/scanner';

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let isLoading = false;
  let loadError = '';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function processFiles(files) {
    loadError = '';
    const { included, excluded, excludedCount } = autoExcludeVCS(files);
    const { warnings } = scanFiles(included);
    const tree = buildFileTree(included);
    dispatch('files-selected', {
      files: included,
      tree,
      warnings,
      excluded,
      excludedCount,
    });
  }

  // ---------------------------------------------------------------------------
  // Drag and drop
  // ---------------------------------------------------------------------------

  function onDragEnter(e) {
    e.preventDefault();
    isDragging = true;
  }

  function onDragOver(e) {
    e.preventDefault();
    isDragging = true;
  }

  function onDragLeave(e) {
    // Only clear if leaving the drop zone entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      isDragging = false;
    }
  }

  async function onDrop(e) {
    e.preventDefault();
    isDragging = false;
    isLoading = true;
    loadError = '';

    try {
      const items = e.dataTransfer?.items;
      if (!items) return;

      // First pass: classify each dropped item to detect loose multi-file drops.
      // Loose files are non-directory, non-archive file entries.
      let looseFileCount = 0;
      let hasDirectory = false;
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (!entry) continue;
        if (entry.isDirectory) {
          hasDirectory = true;
        } else if (entry.isFile) {
          const name = entry.name.toLowerCase();
          const isArchive = name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz');
          if (!isArchive) {
            looseFileCount++;
          }
        }
      }

      // Reject if 2 or more loose files are dropped without a directory
      if (!hasDirectory && looseFileCount >= 2) {
        loadError = 'Multiple files detected — please drop a folder or archive (.zip, .tar.gz)';
        isLoading = false;
        return;
      }

      const files = [];

      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (!entry) continue;

        if (entry.isDirectory) {
          await readDirectoryEntry(entry, files);
        } else if (entry.isFile) {
          const fileObj = await entryToFile(entry);
          const ext = fileObj.name.toLowerCase();
          // If a single archive file is dropped, handle it via pickArchive logic
          if (ext.endsWith('.zip') || ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
            const ab = await fileObj.arrayBuffer();
            let extracted;
            if (ext.endsWith('.zip')) {
              extracted = await extractZip(ab);
            } else {
              extracted = await extractTarGz(ab);
            }
            files.push(...extracted);
          } else {
            const ab = await fileObj.arrayBuffer();
            const path = '/' + fileObj.name;
            files.push({ path, data: ab, size: fileObj.size, type: fileObj.type || undefined });
          }
        }
      }

      if (files.length > 0) {
        processFiles(files);
      } else {
        loadError = 'No files found in the dropped items.';
      }
    } catch (err) {
      loadError = err?.message ?? 'Failed to read dropped files.';
    } finally {
      isLoading = false;
    }
  }

  function entryToFile(entry) {
    return new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
  }

  async function readDirectoryEntry(dirEntry, files, prefix = '') {
    const reader = dirEntry.createReader();
    const entries = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    for (const entry of entries) {
      if (entry.isDirectory) {
        await readDirectoryEntry(entry, files, prefix + '/' + entry.name);
      } else if (entry.isFile) {
        const fileObj = await entryToFile(entry);
        const ab = await fileObj.arrayBuffer();
        const path = prefix + '/' + entry.name;
        files.push({
          path,
          data: ab,
          size: fileObj.size,
          type: fileObj.type || undefined,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------

  async function handlePickFolder() {
    isLoading = true;
    loadError = '';
    try {
      const files = await pickDirectory();
      if (files.length > 0) processFiles(files);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        loadError = err?.message ?? 'Failed to read folder.';
      }
    } finally {
      isLoading = false;
    }
  }

  async function handlePickArchive() {
    isLoading = true;
    loadError = '';
    try {
      const files = await pickArchive();
      if (files.length > 0) processFiles(files);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        loadError = err?.message ?? 'Failed to extract archive.';
      }
    } finally {
      isLoading = false;
    }
  }
</script>

<div
  role="region"
  aria-label="File drop zone"
  class="rounded-xl border-2 border-dashed transition-colors
    {isDragging ? 'border-purple-500 bg-purple-900/10' : 'border-slate-600 hover:border-slate-500'}
    {isLoading ? 'opacity-70 pointer-events-none' : ''}"
  on:dragenter={onDragEnter}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
>
  <div class="px-8 py-16 text-center">
    <!-- Icon -->
    <div class="flex justify-center mb-5">
      {#if isLoading}
        <svg class="w-14 h-14 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      {:else}
        <svg class="w-14 h-14 {isDragging ? 'text-purple-400' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      {/if}
    </div>

    <p class="text-xl font-semibold text-slate-200 mb-2">
      {isDragging ? 'Release to upload' : 'Drop your site files here'}
    </p>
    <p class="text-slate-400 text-sm mb-8">
      Folder, ZIP, or TAR.GZ — {isLoading ? 'Reading files...' : 'drag & drop or choose below'}
    </p>

    <!-- Buttons -->
    <div class="flex justify-center gap-3 flex-wrap">
      <button
        on:click={handlePickFolder}
        disabled={isLoading}
        class="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        Choose Folder
      </button>

      <button
        on:click={handlePickArchive}
        disabled={isLoading}
        class="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        Upload Archive <span class="text-slate-400 text-xs">(.zip, .tar.gz)</span>
      </button>
    </div>

    <!-- Error -->
    {#if loadError}
      <p class="mt-4 text-sm text-red-400">{loadError}</p>
    {/if}
  </div>
</div>

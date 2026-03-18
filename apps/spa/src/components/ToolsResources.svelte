<script>
  import { onMount } from 'svelte';
  import toolsData from '../lib/tools-resources.yaml';

  let selectedVersion = 'v2';
  let headingVisible = true;
  let headingEl;

  onMount(() => {
    if (!headingEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => { headingVisible = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(headingEl);
    return () => observer.disconnect();
  });

  function sortedItems(items, version) {
    const matching = [];
    const nonMatching = [];
    for (const item of items) {
      if (!item.versions) {
        matching.push(item); // version-agnostic always "matches"
      } else if (item.versions.includes(version)) {
        matching.push(item);
      } else {
        nonMatching.push(item);
      }
    }
    return [...matching, ...nonMatching];
  }

  function itemMatches(item, version) {
    if (!item.versions) return true;
    return item.versions.includes(version);
  }
</script>

<div>
  <!-- Section heading (observed for sticky behavior) -->
  <h2 bind:this={headingEl} class="text-2xl font-semibold text-white mb-6">Tools &amp; Resources</h2>

  <!-- Sticky toggle bar -->
  <div
    class="flex gap-2 justify-center mb-8 py-3 z-10 transition-all duration-200
      {headingVisible ? '' : 'sticky top-0 bg-slate-900/95 backdrop-blur rounded-b-lg'}"
  >
    <button
      on:click={() => (selectedVersion = 'v1')}
      class="px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200
        {selectedVersion === 'v1'
          ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]'
          : 'bg-slate-800 text-slate-400 border border-slate-600 hover:bg-slate-700 hover:text-slate-300'}"
    >
      nsite v1
    </button>
    <button
      on:click={() => (selectedVersion = 'v2')}
      class="px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200
        {selectedVersion === 'v2'
          ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]'
          : 'bg-slate-800 text-slate-400 border border-slate-600 hover:bg-slate-700 hover:text-slate-300'}"
    >
      nsite v2
    </button>
  </div>

  <!-- Category listings -->
  <div class="space-y-8">
    {#each toolsData.categories as category}
      <div>
        <h3 class="text-lg font-semibold text-white mb-3">{category.name}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each sortedItems(category.items, selectedVersion) as item (item.name)}
            {@const matches = itemMatches(item, selectedVersion)}
            {#if matches}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="block bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition-all duration-300 group"
              >
                <p class="font-medium text-purple-400 group-hover:text-purple-300 transition-colors text-sm">
                  {item.name}
                </p>
                <p class="text-slate-400 text-xs mt-1 leading-relaxed">{item.description}</p>
              </a>
            {:else}
              <div
                class="block bg-slate-800 rounded-lg p-4 opacity-35 cursor-default transition-all duration-300"
              >
                <p class="font-medium text-purple-400 text-sm">
                  {item.name}
                </p>
                <p class="text-slate-400 text-xs mt-1 leading-relaxed">{item.description}</p>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

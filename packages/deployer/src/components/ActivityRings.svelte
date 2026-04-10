<script>
  /**
   * Props:
   *   serverProgress - Record<string, { total, completed, skipped, failed }>
   *   totalFiles     - number
   */
  export let serverProgress = {};
  export let totalFiles = 0;
  export let givenUpServers = new Set();

  const COLORS = ['#c084fc', '#22d3ee', '#a3e635', '#60a5fa', '#2dd4bf', '#818cf8', '#34d399', '#7dd3fc'];
  const TRACK_COLOR = '#1e293b';
  const FAIL_COLOR = '#475569';

  function shortUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  $: servers = Object.entries(serverProgress).map(([url, sp], i) => {
    const givenUp = givenUpServers.has(url);
    const ok = sp.completed + sp.skipped;
    const okFraction = sp.total > 0 ? ok / sp.total : 0;
    const failFraction = sp.total > 0 ? sp.failed / sp.total : 0;
    const radius = 88 - i * 14;
    const circumference = 2 * Math.PI * radius;
    const okOffset = circumference * (1 - okFraction);
    const failOffset = circumference * (1 - failFraction);
    const failRotation = -90 + (okFraction * 360);
    return {
      url,
      label: shortUrl(url),
      color: COLORS[i % COLORS.length],
      givenUp,
      radius,
      circumference,
      okFraction,
      failFraction,
      okOffset,
      failOffset,
      failRotation,
      completed: sp.completed,
      skipped: sp.skipped,
      failed: sp.failed,
      total: sp.total,
      ok,
      delay: i * 0.15,
    };
  });

  // Trigger animation after mount
  let mounted = false;
  import { onMount } from 'svelte';
  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });
  });
</script>

<div class="flex items-center gap-6">
  <!-- SVG rings -->
  <div class="w-36 h-36 flex-shrink-0">
    <svg viewBox="0 0 200 200" class="w-full h-full">
      {#each servers as s}
        <g opacity={s.givenUp ? 0.25 : 1}>
        <!-- Background track -->
        <circle
          cx="100" cy="100" r={s.radius}
          fill="none" stroke={TRACK_COLOR} stroke-width="6" opacity="0.3"
        />
        <!-- OK arc (completed + skipped) -->
        <circle
          cx="100" cy="100" r={s.radius}
          fill="none"
          stroke={s.color}
          stroke-width="6"
          stroke-linecap="round"
          stroke-dasharray={s.circumference}
          stroke-dashoffset={mounted ? s.okOffset : s.circumference}
          transform="rotate(-90 100 100)"
          style="transition: stroke-dashoffset 1s ease-out {s.delay}s"
        />
        <!-- Fail arc (red) -->
        {#if s.failed > 0}
          <circle
            cx="100" cy="100" r={s.radius}
            fill="none"
            stroke={FAIL_COLOR}
            stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray={s.circumference}
            stroke-dashoffset={mounted ? s.failOffset : s.circumference}
            transform="rotate({mounted ? s.failRotation : -90} 100 100)"
            style="transition: stroke-dashoffset 1s ease-out {s.delay + 0.3}s, transform 0.5s ease-out {s.delay}s"
          />
        {/if}
        </g>
      {/each}
      <!-- Center text -->
      <text x="100" y="95" text-anchor="middle" fill="white" font-size="28" font-weight="bold">
        {totalFiles}
      </text>
      <text x="100" y="115" text-anchor="middle" fill="#94a3b8" font-size="13">
        files
      </text>
    </svg>
  </div>

  <!-- Server labels with breakdown -->
  <div class="flex flex-col gap-1.5">
    {#each servers as s}
      <div class="flex items-center gap-2 text-xs {s.givenUp ? 'opacity-40' : ''}">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: {s.color}"></span>
        <span class="text-slate-300 {s.givenUp ? 'line-through' : ''}">{s.label}</span>
        <span class="ml-auto pl-3 tabular-nums">
          {#if s.givenUp}
            <span class="text-slate-500 italic">skipped</span>
          {:else}
            <span class="text-slate-300">{s.ok}</span><span class="text-slate-500">/{s.total}</span>
            {#if s.failed > 0}
              <span class="text-red-400 ml-1">{s.failed} failed</span>
            {/if}
          {/if}
        </span>
      </div>
    {/each}
  </div>
</div>

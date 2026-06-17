<script>
  import ToolsResources from './ToolsResources.svelte';

  // Provided by App.svelte so internal navigation stays within the SPA.
  export let navigate = (to) => { window.location.href = to; };

  function scrollToLearn() {
    document.getElementById('what')?.scrollIntoView({ behavior: 'smooth' });
  }
</script>

<!-- ===== Above the fold: centered hero ===== -->
<section class="min-h-screen flex flex-col items-center justify-center px-4 text-center">
  <h1 class="text-7xl md:text-8xl font-bold tracking-tight text-white mb-6">
    nsite
  </h1>

  <p class="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
    nsites are static websites that live on the nostr network instead of a central host.
    Your files are stored as cryptographic blobs on <span class="text-white font-medium">Blossom</span>
    servers and indexed by a signed nostr event, so any gateway can serve your site and no
    single provider can take it down. The protocol is specified in
    <a
      href="https://github.com/nostr-protocol/nips/blob/master/5A.md"
      target="_blank"
      rel="noopener noreferrer"
      class="text-purple-400 hover:text-purple-300 underline font-medium">NIP-5A</a>.
  </p>

  <!-- Prominent deployer link for people who still use it -->
  <a
    href="/deploy"
    on:click|preventDefault={() => navigate('/deploy')}
    class="mt-10 inline-flex items-center gap-2 px-7 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-lg transition-colors shadow-[0_0_30px_rgba(124,58,237,0.25)]"
  >
    Open the web deployer
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  </a>

  <!-- Animated "Learn more" nudge -->
  <button
    on:click={scrollToLearn}
    class="mt-14 flex flex-col items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors animate-bounce-subtle"
  >
    <span class="text-sm">Learn more</span>
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  </button>
</section>

<!-- ===== Explainer content ===== -->
<div class="max-w-3xl mx-auto px-4 space-y-16 py-16" id="what">
  <!-- What are nsites? -->
  <section>
    <h2 class="text-2xl font-semibold text-white mb-4">What are nsites?</h2>
    <p class="text-slate-300 leading-relaxed">
      nsites are static websites hosted on the nostr network. Your site's files are stored as
      cryptographic blobs on Blossom servers and made discoverable via signed nostr events. Anyone
      running a gateway can serve your site — no central host controls it.
    </p>
  </section>

  <!-- How the protocol works -->
  <section>
    <h2 class="text-2xl font-semibold text-white mb-4">How the protocol works</h2>
    <ol class="space-y-4">
      {#each [
        { n: '1', title: 'Files as content-addressed blobs', desc: 'Each file is identified by the SHA-256 hash of its contents and stored on one or more Blossom servers. The same bytes have the same address everywhere, so any server can hold a copy.' },
        { n: '2', title: 'A signed manifest event', desc: 'A nostr event maps each path in the site (e.g. /index.html) to the hash of its file. Because the event is signed by the author’s key, anyone can verify the site is authentic and unmodified.' },
        { n: '3', title: 'Resolution by npub', desc: 'An author’s npub is the address of their site. A gateway looks up the latest manifest for that key, fetches the referenced blobs from Blossom, and serves the files — no central host required.' },
      ] as item}
        <li class="flex gap-4">
          <div class="w-8 h-8 rounded-full bg-purple-700/60 flex items-center justify-center text-purple-200 font-bold text-sm flex-shrink-0">
            {item.n}
          </div>
          <div>
            <p class="font-medium text-white">{item.title}</p>
            <p class="text-slate-400 text-sm mt-1">{item.desc}</p>
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
        { title: 'No accounts needed', desc: 'A site is owned by a nostr keypair, not a hosting account. Any key — new or existing — can publish a site.' },
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

  <!-- Closing deploy CTA -->
  <section class="text-center pt-4">
    <p class="text-slate-400 mb-4">Ready to publish your own nsite?</p>
    <a
      href="/deploy"
      on:click|preventDefault={() => navigate('/deploy')}
      class="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
    >
      Open the web deployer
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </a>
  </section>
</div>

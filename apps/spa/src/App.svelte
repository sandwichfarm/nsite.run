<script>
  import Navbar from './components/Navbar.svelte';
  import NIP5ABanner from './components/NIP5ABanner.svelte';
  import ToolsResources from './components/ToolsResources.svelte';
  import { DeployerWidget } from '@nsite/deployer';
  import { clearAnonymousKey } from '@nsite/deployer/nostr';
  import { base36Encode } from '@nsite/deployer/base36';
  import { hexToBytes } from 'nostr-tools/utils';

  // Session state for Navbar (synced from DeployerWidget auth-change events)
  let sessionPubkey = null;
  let sessionDisplayName = null;
  let sessionAvatar = null;
  let sessionNpub = null;
  let sessionSignerType = null;
  let deployNsec = null;

  // Whether the login modal inside DeployerWidget should open
  // (Navbar login click triggers DeployerWidget's built-in auth)
  let showLoginModal = false;

  function handleAuthChange(e) {
    const { pubkey, signerType, authenticated } = e.detail;
    if (authenticated) {
      sessionPubkey = pubkey;
      sessionSignerType = signerType;
      // displayName and avatar may come in later profile fetch
      // DeployerWidget stores them internally; we get them from the initial auth event
    } else {
      sessionPubkey = null;
      sessionDisplayName = null;
      sessionAvatar = null;
      sessionNpub = null;
      sessionSignerType = null;
      deployNsec = null;
    }
  }

  function handleDeploySuccess(e) {
    // Update session info from deploy success (covers anonymous deploy case)
    if (e.detail?.pubkey) {
      sessionPubkey = e.detail.pubkey;
    }
  }

  function handleNavbarLogout() {
    // Navbar handles clearAnonymousKey internally
    // Reset local session state
    sessionPubkey = null;
    sessionDisplayName = null;
    sessionAvatar = null;
    sessionNpub = null;
    sessionSignerType = null;
    deployNsec = null;
    // Force page reload to reset DeployerWidget internal state
    window.location.reload();
  }
</script>

<!-- App shell -->
<div class="min-h-screen bg-slate-900 text-gray-100">

  <NIP5ABanner />

  <Navbar
    pubkey={sessionPubkey}
    displayName={sessionDisplayName}
    avatar={sessionAvatar}
    npub={sessionNpub}
    signerType={sessionSignerType}
    {deployNsec}
    onLoginClick={() => (showLoginModal = true)}
    on:logout={handleNavbarLogout}
  />

  <main>

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
        <DeployerWidget
          on:deploy-success={handleDeploySuccess}
          on:auth-change={handleAuthChange}
        />
      </div>

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

    <!-- Educational content -->
    <div class="max-w-3xl mx-auto px-4 space-y-16 py-16" id="what">
      <!-- What are nsites? -->
      <section>
        <h2 class="text-2xl font-semibold text-white mb-4">What are nsites?</h2>
        <p class="text-slate-300 leading-relaxed">
          nsites are static websites hosted on the nostr network. Your site's files are stored as
          cryptographic blobs on blossom servers and made discoverable via signed nostr events. Anyone
          running a gateway can serve your site &mdash; no central host controls it.
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

  </main>

</div>

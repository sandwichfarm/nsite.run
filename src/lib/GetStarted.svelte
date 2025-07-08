<script>
  import toolsData from './tools-resources.yaml';
  import SignerBadge from './SignerBadge.svelte';
  
  export let scrollY = 0;
  export let innerHeight = 0;
  
  let sectionElement;
  let isVisible = false;
  let activeTab = 'view';
  let selectedDeployTool = '';
  let automateDeployment = null;
  let npubInput = '';
  let npubError = '';
  let selectedGateway = '';
  
  // Validate npub
  function validateNpub(npub) {
    if (!npub) {
      npubError = '';
      return false;
    }
    
    // Basic npub validation - starts with npub1 and has correct length
    if (!npub.startsWith('npub1') || npub.length !== 63) {
      npubError = 'Invalid npub format';
      return false;
    }
    
    // Check if it's valid bech32
    try {
      // Basic character validation for bech32
      const validChars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const npubBody = npub.slice(5); // Remove 'npub1' prefix
      for (let char of npubBody) {
        if (!validChars.includes(char)) {
          npubError = 'Invalid characters in npub';
          return false;
        }
      }
      npubError = '';
      return true;
    } catch (e) {
      npubError = 'Invalid npub encoding';
      return false;
    }
  }
  
  function viewNsite(npub) {
    if (validateNpub(npub)) {
      const gateway = nsiteGateways.find(g => g.name === selectedGateway);
      if (gateway && gateway.url) {
        const gatewayUrl = gateway.url.endsWith('/') ? gateway.url.slice(0, -1) : gateway.url;
        window.open(`${gatewayUrl}/${npub}`, '_blank');
      }
    }
  }
  
  $: validateNpub(npubInput);
  
  $: if (sectionElement && scrollY >= 0) {
    const rect = sectionElement.getBoundingClientRect();
    isVisible = rect.top < innerHeight * 0.8 && rect.bottom > 0;
  }
  
  const { deploymentTools, gateways, reference, managementTools, nsiteGateways } = toolsData;
  const nsiteAction = managementTools.find(tool => tool.name === 'nsite-action');
  
  // Set default gateway after data loads
  $: if (!selectedGateway && nsiteGateways && nsiteGateways.length > 0) {
    selectedGateway = nsiteGateways[0].name;
  }
</script>

<section bind:this={sectionElement} id="get-started" class="min-h-screen py-20 flex items-center">
  <div class="container mx-auto px-4">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-4xl md:text-5xl font-bold mb-8 text-center
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 ease-out">
        Getting Started
      </h2>
      
      <p class="text-xl text-gray-300 mb-12 text-center
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 delay-200 ease-out">
        Choose your path to join the decentralized web
      </p>
      
      <!-- Tab Navigation -->
      <div class="flex justify-center mb-12">
        <div class="bg-gray-800 p-1 rounded-lg inline-flex
          {isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} 
          transition-all duration-700 delay-300 ease-out">
          <button 
            on:click={() => activeTab = 'view'}
            class="px-6 py-3 rounded-md font-semibold transition-all duration-200
              {activeTab === 'view' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}">
            View nsite
          </button>
          <button 
            on:click={() => activeTab = 'deploy'}
            class="px-6 py-3 rounded-md font-semibold transition-all duration-200
              {activeTab === 'deploy' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}">
            Deploy an nsite
          </button>
          <button 
            on:click={() => activeTab = 'gateway'}
            class="px-6 py-3 rounded-md font-semibold transition-all duration-200
              {activeTab === 'gateway' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}">
            Run a gateway
          </button>
          <button 
            on:click={() => activeTab = 'contribute'}
            class="px-6 py-3 rounded-md font-semibold transition-all duration-200
              {activeTab === 'contribute' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}">
            Contribute
          </button>
        </div>
      </div>
      
      <!-- Tab Content -->
      <div class="bg-gray-800 rounded-lg p-8
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 delay-400 ease-out">
        
        <!-- View nsite Tab -->
        {#if activeTab === 'view'}
          <div class="space-y-8">
            <h3 class="text-2xl font-semibold mb-6 text-purple-400">View an nsite</h3>
            
            <div class="space-y-6">
              <!-- Gateway selector -->
              <div>
                <label class="block text-sm font-medium mb-2">Select a gateway:</label>
                <div class="grid md:grid-cols-2 gap-2">
                  {#each nsiteGateways as gateway}
                    <label class="cursor-pointer">
                      <input
                        type="radio"
                        name="gateway"
                        value={gateway.name}
                        bind:group={selectedGateway}
                        class="sr-only peer"
                      />
                      <div class="bg-gray-900 p-3 rounded-lg border-2 border-gray-700 
                        peer-checked:border-purple-600 peer-checked:bg-purple-900/20
                        hover:border-gray-600 transition-all">
                        <span class="font-semibold">{gateway.name}</span>
                        {#if gateway.desc}
                          <span class="text-gray-400 text-sm ml-2">{gateway.desc}</span>
                        {/if}
                      </div>
                    </label>
                  {/each}
                </div>
              </div>

              <!-- npub input -->
              <div>
                <label for="npub-input" class="block text-sm font-medium mb-2">Enter an npub to view their nsite:</label>
                <div class="flex gap-2">
                  <input
                    id="npub-input"
                    type="text"
                    bind:value={npubInput}
                    placeholder="npub1..."
                    class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    on:click={() => viewNsite(npubInput)}
                    disabled={!npubInput || !!npubError}
                    class="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors">
                    View
                  </button>
                </div>
                {#if npubError}
                  <p class="text-red-400 text-sm mt-2">{npubError}</p>
                {/if}
              </div>
              
              <!-- Example nsites -->
              <div>
                <p class="text-gray-400 mb-4">Or check out these example nsites:</p>
                <div class="grid md:grid-cols-2 gap-3">
                  <button
                    on:click={() => viewNsite('npub1uac67zc9er54ln0kl6e4qp2y6ta3enfcg7ywnayshvlw9r5w6ehsqq99rx')}
                    class="bg-gray-900 hover:bg-gray-700 p-4 rounded-lg text-left transition-colors">
                    <h4 class="font-semibold mb-1">bread (sandwich.farm)</h4>
                    <p class="text-gray-400 text-sm">Creator of nsyte</p>
                  </button>
                  <button
                    on:click={() => viewNsite('npub1zel93ag8c3jx24nzlqtq24q56y4zqzxqr3ht4grrpf2y8p5p9jqqlmpu7')}
                    class="bg-gray-900 hover:bg-gray-700 p-4 rounded-lg text-left transition-colors">
                    <h4 class="font-semibold mb-1">hzrd149</h4>
                    <p class="text-gray-400 text-sm">Creator of nsite-gateway</p>
                  </button>
                  <button
                    on:click={() => viewNsite('npub1nf9vm6uhs4j7yayqrxdlqvw8euh49rh3tc3p524t8ewkgtae8zcqpfq7sx')}
                    class="bg-gray-900 hover:bg-gray-700 p-4 rounded-lg text-left transition-colors">
                    <h4 class="font-semibold mb-1">flox1an</h4>
                    <p class="text-gray-400 text-sm">Creator of nsite-cli</p>
                  </button>
                  <button
                    on:click={() => viewNsite('npub19ejgkuqv94s7seh936l97zy0pj77ym36yc9caqkkz5xfzld5l08qp8uctf')}
                    class="bg-gray-900 hover:bg-gray-700 p-4 rounded-lg text-left transition-colors">
                    <h4 class="font-semibold mb-1">sepehr-safari</h4>
                    <p class="text-gray-400 text-sm">Creator of nostr-deploy</p>
                  </button>
                </div>
              </div>
              
              <div class="bg-gray-900 p-6 rounded-lg">
                <h4 class="text-lg font-semibold mb-2">How it works:</h4>
                <p class="text-gray-300">
                  nsites are static websites hosted on the Nostr network. Each site is tied to a user's npub (Nostr public key). 
                  When you enter an npub, the gateway fetches and displays their published website content.
                </p>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Deploy an nsite Tab -->
        {#if activeTab === 'deploy'}
          <div class="space-y-8">
            <h3 class="text-2xl font-semibold mb-6 text-purple-400">Deploy an nsite</h3>
            
            <!-- Step 1: Pick a deploy tool -->
            <div>
              <h4 class="text-xl font-semibold mb-4">Step 1: Pick a deployment tool</h4>
              <div class="grid md:grid-cols-2 gap-4 mb-6">
                {#each deploymentTools as tool}
                  <label class="cursor-pointer">
                    <input 
                      type="radio" 
                      name="deployTool" 
                      value={tool.name}
                      bind:group={selectedDeployTool}
                      class="sr-only peer"
                    />
                    <div class="bg-gray-900 p-4 rounded-lg border-2 border-gray-700 
                      peer-checked:border-purple-600 peer-checked:bg-purple-900/20
                      hover:border-gray-600 transition-all">
                      <div class="flex items-start justify-between mb-1">
                        <h5 class="font-semibold text-lg">{tool.name}</h5>
                        {#if tool.signerCapability}
                          <div class="flex gap-1">
                            {#each tool.signerCapability as capability}
                              <SignerBadge {capability} />
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <p class="text-gray-400 text-sm">{tool.desc}</p>
                    </div>
                  </label>
                {/each}
              </div>
            </div>
            
            <!-- Step 2: Automation question (only for nsyte) -->
            {#if selectedDeployTool === 'nsyte'}
              <div>
                <h4 class="text-xl font-semibold mb-4">Step 2: Do you want to automate deployment from GitHub?</h4>
                <div class="flex gap-4 mb-6">
                  <button 
                    on:click={() => automateDeployment = true}
                    class="px-6 py-3 rounded-lg font-semibold transition-all
                      {automateDeployment === true ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}">
                    Yes, automate it
                  </button>
                  <button 
                    on:click={() => automateDeployment = false}
                    class="px-6 py-3 rounded-lg font-semibold transition-all
                      {automateDeployment === false ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}">
                    No, deploy locally
                  </button>
                </div>
              </div>
            {/if}
            
            <!-- Step 3: Show instructions -->
            {#if (automateDeployment !== null && selectedDeployTool === 'nsyte') || (selectedDeployTool && selectedDeployTool !== 'nsyte')}
              <div class="bg-gray-900 p-6 rounded-lg">
                {#if automateDeployment && selectedDeployTool === 'nsyte'}
                  <h4 class="text-xl font-semibold mb-4 text-purple-400">GitHub Action Setup with nsyte</h4>
                  <p class="text-gray-300 mb-4">
                    Use <a href={nsiteAction.url} target="_blank" class="text-purple-400 hover:text-purple-300 underline">nsite-action</a> to automatically deploy your nsite when you push to GitHub.
                  </p>
                  <ol class="list-decimal list-inside text-gray-300 space-y-2">
                    <li>Install nsyte locally: <code class="bg-gray-800 px-2 py-1 rounded">curl -fsSL https://nsyte.run/get/install.sh | bash</code></li>
                    <li>Run <code class="bg-gray-800 px-2 py-1 rounded">nsyte ci</code> to generate an <code class="bg-gray-800 px-2 py-1 rounded">nbunksec</code> (Bunker secret key)</li>
                    <li>Add the <code class="bg-gray-800 px-2 py-1 rounded">nbunksec</code> as a GitHub secret in your repository settings</li>
                    <li>Create <code class="bg-gray-800 px-2 py-1 rounded">.github/workflows/deploy.yml</code> with the nsite-action configuration</li>
                    <li>Specify your website directory, relays, and Blossom servers in the workflow</li>
                    <li>Your site will automatically deploy to nsite on every push</li>
                  </ol>
                  <div class="mt-4">
                    <a href={nsiteAction.url} target="_blank" 
                      class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                      View nsite-action Documentation
                    </a>
                  </div>
                {:else}
                  <h4 class="text-xl font-semibold mb-4 text-purple-400">Local Deployment with {selectedDeployTool}</h4>
                  {@const selectedTool = deploymentTools.find(t => t.name === selectedDeployTool)}
                  <p class="text-gray-300 mb-4">
                    Deploy your nsite locally using <a href={selectedTool.docsUrl || selectedTool.url} target="_blank" class="text-purple-400 hover:text-purple-300 underline">{selectedDeployTool}</a>.
                  </p>
                  <ol class="list-decimal list-inside text-gray-300 space-y-2">
                    <li>Install {selectedDeployTool} following the documentation</li>
                    <li>Build your static website files</li>
                    <li>Configure your signing method:
                      {#if selectedTool.signerCapability.includes('bunker')}
                        <ul class="list-disc list-inside ml-4 mt-1">
                          <li>Use Bunker for remote signing (more secure)</li>
                          <li>Or use your Nostr private key directly</li>
                        </ul>
                      {:else}
                        <span class="text-gray-400"> - Requires your Nostr private key</span>
                      {/if}
                    </li>
                    <li>Run the deployment command</li>
                    <li>Your site will be published to the nsite network</li>
                  </ol>
                  {#if selectedDeployTool !== 'nsyte'}
                    <p class="text-sm text-gray-400 mt-4">
                      Note: GitHub Action automation is currently only available with nsyte
                    </p>
                  {/if}
                  <div class="mt-4">
                    <a href={selectedTool.docsUrl || selectedTool.url} target="_blank" 
                      class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                      View {selectedDeployTool} Documentation
                    </a>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Run a gateway Tab -->
        {#if activeTab === 'gateway'}
          <div class="space-y-8">
            <h3 class="text-2xl font-semibold mb-6 text-purple-400">Run a Gateway</h3>
            
            <p class="text-gray-300 mb-6">
              Gateways serve nsite content to web browsers. Choose a gateway implementation:
            </p>
            
            <div class="grid gap-4">
              {#each gateways as gateway}
                <a href={gateway.url} target="_blank" 
                  class="bg-gray-900 p-6 rounded-lg hover:bg-gray-700 transition-all group">
                  <h4 class="font-semibold text-xl mb-2 group-hover:text-purple-400 transition-colors">
                    {gateway.name}
                  </h4>
                  <p class="text-gray-400 mb-4">{gateway.desc}</p>
                  <span class="text-purple-400 group-hover:text-purple-300 inline-flex items-center gap-2">
                    View Documentation 
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
                </a>
              {/each}
            </div>
            
            <div class="bg-gray-900 p-6 rounded-lg mt-6">
              <h4 class="text-lg font-semibold mb-3">Gateway Requirements:</h4>
              <ul class="list-disc list-inside text-gray-300 space-y-2">
                <li>A server with a public IP address or domain</li>
                <li>Node.js or compatible runtime environment</li>
                <li>Access to Nostr relays for fetching nsite events</li>
                <li>Storage for caching served content</li>
              </ul>
            </div>
          </div>
        {/if}
        
        <!-- Contribute Tab -->
        {#if activeTab === 'contribute'}
          <div class="space-y-8">
            <h3 class="text-2xl font-semibold mb-6 text-purple-400">Contribute to nsite</h3>
            
            <p class="text-gray-300 mb-6">
              Help build the future of decentralized web hosting by contributing to the nsite ecosystem.
            </p>
            
            <div class="space-y-6">
              <div class="bg-gray-900 p-6 rounded-lg">
                <h4 class="text-xl font-semibold mb-3">1. Read the NIP (Nostr Implementation Possibility)</h4>
                <p class="text-gray-300 mb-4">
                  Understand the nsite protocol specification and how it works:
                </p>
                <div class="space-y-3">
                  {#each reference.filter(r => r.name.includes('NIP')) as nip}
                    <a href={nip.url} target="_blank" 
                      class="block p-3 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
                      <h5 class="font-semibold text-purple-400">{nip.name}</h5>
                      <p class="text-sm text-gray-400">{nip.desc}</p>
                    </a>
                  {/each}
                </div>
              </div>
              
              <div class="bg-gray-900 p-6 rounded-lg">
                <h4 class="text-xl font-semibold mb-3">2. Open a Pull Request</h4>
                <p class="text-gray-300 mb-4">
                  Contribute to the nsite ecosystem by submitting pull requests to relevant repositories:
                </p>
                <ul class="list-disc list-inside text-gray-300 space-y-2">
                  <li>Add new features to existing tools</li>
                  <li>Fix bugs and improve performance</li>
                  <li>Enhance documentation</li>
                  <li>Create new tools and integrations</li>
                </ul>
                <div class="mt-4">
                  <a href="https://github.com/nostrver-se/awesome-nsite" target="_blank" 
                    class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                    Browse nsite Projects
                  </a>
                </div>
              </div>
              
              <div class="bg-gray-900 p-6 rounded-lg">
                <h4 class="text-xl font-semibold mb-3">Ways to Contribute:</h4>
                <div class="grid md:grid-cols-2 gap-4">
                  <div>
                    <h5 class="font-semibold text-purple-400 mb-2">Development</h5>
                    <ul class="text-sm text-gray-300 space-y-1">
                      <li>• Build new deployment tools</li>
                      <li>• Create gateway implementations</li>
                      <li>• Develop browser extensions</li>
                      <li>• Improve existing tools</li>
                    </ul>
                  </div>
                  <div>
                    <h5 class="font-semibold text-purple-400 mb-2">Infrastructure</h5>
                    <ul class="text-sm text-gray-300 space-y-1">
                      <li>• Run public gateways</li>
                      <li>• Host Blossom servers</li>
                      <li>• Operate Nostr relays</li>
                      <li>• Provide documentation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
      
    </div>
  </div>
</section>
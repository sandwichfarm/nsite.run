<script>
  import toolsData from './tools-resources.yaml';
  
  export let scrollY = 0;
  export let innerHeight = 0;
  
  let sectionElement;
  let isVisible = false;
  
  $: if (sectionElement && scrollY >= 0) {
    const rect = sectionElement.getBoundingClientRect();
    isVisible = rect.top < innerHeight * 0.8 && rect.bottom > 0;
  }
  
  const { gateways, deploymentTools, managementTools, nsiteGateways, blossomServers, nostrRelays, informationals, genesis } = toolsData;
</script>

<section bind:this={sectionElement} id="tools" class="min-h-screen py-20 bg-gray-800/50">
  <div class="container mx-auto px-4">
    <h2 class="text-4xl md:text-5xl font-bold text-center mb-16
      {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-700 ease-out">
      <a  href="https://github.com/nostrver-se/awesome-nsite" 
          target="_blank"
          class="text-white/50 hover:text-white/80"
      >
        Awesome nsite
      </a>
    </h2>
    
    <div class="max-w-6xl mx-auto">
      <!-- Genesis -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-200 ease-out">
          Genesis
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each genesis as tool, i}
            <a href={tool.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {300 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{tool.name}</h4>
              <p class="text-gray-400 text-sm">{tool.desc}</p>
            </a>
          {/each}
        </div>
      </div>

      <!-- Information -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-200 ease-out">
          Informational Resources
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each informationals as tool, i}
            <a href={tool.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {300 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{tool.name}</h4>
              <p class="text-gray-400 text-sm">{tool.desc}</p>
            </a>
          {/each}
        </div>
      </div>

      <!-- Gateways -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-200 ease-out">
          Gateways & Servers
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each gateways as tool, i}
            <a href={tool.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {300 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{tool.name}</h4>
              <p class="text-gray-400 text-sm">{tool.desc}</p>
            </a>
          {/each}
        </div>
      </div>
      
      <!-- Deployment Tools -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-400 ease-out">
          Deployment Tools
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each deploymentTools as tool, i}
            <a href={tool.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {500 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{tool.name}</h4>
              <p class="text-gray-400 text-sm">{tool.desc}</p>
            </a>
          {/each}
        </div>
      </div>
      
      <!-- Management Tools -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-700 ease-out">
          Management & Automation
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each managementTools as tool, i}
            <a href={tool.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {800 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{tool.name}</h4>
              <p class="text-gray-400 text-sm">{tool.desc}</p>
            </a>
          {/each}
        </div>
      </div>
      
      <!-- nsite Gateways -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-900 ease-out">
          nsite Gateways
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each nsiteGateways as gateway, i}
            <a href={gateway.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {1000 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{gateway.name}</h4>
              {#if gateway.desc}
                <p class="text-gray-400 text-sm">{gateway.desc}</p>
              {/if}
            </a>
          {/each}
        </div>
      </div>
      
      <!-- Blossom Servers -->
      <div class="mb-12">
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-1000 ease-out">
          Blossom Servers
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each blossomServers as server, i}
            <a href={server.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {1100 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{server.name}</h4>
              <p class="text-gray-400 text-sm">{server.desc}</p>
            </a>
          {/each}
        </div>
      </div>
      
      <!-- Nostr Relays -->
      <div>
        <h3 class="text-2xl font-semibold mb-6 text-purple-400
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
          transition-all duration-700 delay-1100 ease-out">
          Relays Optimized for nsite
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          {#each nostrRelays as relay, i}
            <a href={relay.url} target="_blank" rel="noreferrer"
              class="bg-gray-900 p-4 rounded-lg hover:bg-gray-700 transition-colors
              {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
              transition-all duration-700 ease-out"
              style="transition-delay: {1200 + i * 100}ms">
              <h4 class="font-semibold text-lg mb-1">{relay.name}</h4>
              <p class="text-gray-400 text-sm">{relay.desc}</p>
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>
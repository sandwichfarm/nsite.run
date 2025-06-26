<script>
  export let scrollY = 0;
  export let innerHeight = 0;
  
  let sectionElement;
  let isVisible = false;
  
  $: if (sectionElement && scrollY >= 0) {
    const rect = sectionElement.getBoundingClientRect();
    isVisible = rect.top < innerHeight * 0.8 && rect.bottom > 0;
  }
</script>

<section bind:this={sectionElement} id="concept" class="min-h-screen py-20 relative">
  <div class="container mx-auto px-4">
    <h2 class="text-4xl md:text-5xl font-bold text-center mb-16
      {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-700 ease-out">
      What is nsite?
    </h2>
    
    <div class="grid md:grid-cols-2 gap-12 items-center">
      <div class="{isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'} 
        transition-all duration-700 delay-200 ease-out">
        <h3 class="text-2xl font-semibold mb-4 text-purple-400">Pubkey Static Websites</h3>
        <p class="text-gray-300 mb-6">
          nsite enables you to host static websites under Nostr public keys. Your website becomes 
          cryptographically tied to your identity, accessible through specialized host servers.
        </p>
        
        <h3 class="text-2xl font-semibold mb-4 text-purple-400">Decentralized & Censorship Resistant</h3>
        <p class="text-gray-300">
          Using Nostr's distributed relay network and Blossom's content-addressed storage, 
          your website remains online even if individual servers go down.
        </p>
      </div>
      
      <div class="{isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'} 
        transition-all duration-700 delay-400 ease-out">
        <div class="bg-gray-800 rounded-lg p-8 shadow-2xl">
          <div class="mb-4">
            <span class="text-purple-400 font-mono">npub1example.nsite.run</span>
          </div>
          <div class="text-gray-400 text-sm">
            <p class="mb-2">↓ Resolves to public key</p>
            <p class="mb-2">↓ Fetches static file events</p>
            <p class="mb-2">↓ Retrieves content from Blossom</p>
            <p>↓ Serves your website</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
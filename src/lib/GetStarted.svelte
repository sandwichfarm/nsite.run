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

<section bind:this={sectionElement} id="get-started" class="min-h-screen py-20 flex items-center">
  <div class="container mx-auto px-4">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class="text-4xl md:text-5xl font-bold mb-8
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 ease-out">
        build.
      </h2>
      
      <p class="text-xl text-gray-300 mb-12
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 delay-200 ease-out">
        Join the future of decentralized web hosting
      </p>
      
      <div class="grid md:grid-cols-3 gap-8 mb-12">
        <div class="bg-gray-800 p-8 rounded-lg
          {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
          transition-all duration-700 delay-300 ease-out">
          <h3 class="text-2xl font-semibold mb-4 text-purple-400">For Publishers</h3>
          <ol class="text-left text-gray-300 space-y-2">
            <li>1. Create your static website files</li>
            <li>2. Upload files to Blossom servers</li>
            <li>3. Publish kind 34128 events to Nostr</li>
            <li>4. Access via npub subdomain</li>
          </ol>
        </div>
        
        <div class="bg-gray-800 p-8 rounded-lg
          {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
          transition-all duration-700 delay-400 ease-out">
          <h3 class="text-2xl font-semibold mb-4 text-purple-400">For Sys Admins</h3>
          <ol class="text-left text-gray-300 space-y-2">
            <li>1. Run a Nostr relay</li>
            <li>2. Host a Blossom server</li>
            <li>3. Set up an nsite gateway</li>
            <li>4. Maintain infrastructure</li>
          </ol>
        </div>
        
        <div class="bg-gray-800 p-8 rounded-lg
          {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
          transition-all duration-700 delay-500 ease-out">
          <h3 class="text-2xl font-semibold mb-4 text-purple-400">For Developers</h3>
          <ol class="text-left text-gray-300 space-y-2">
            <li>1. Build nsite gateways</li>
            <li>2. Create deployment tools</li>
            <li>3. Develop publishing clients</li>
            <li>4. Contribute to ecosystem</li>
          </ol>
        </div>
      </div>
      
      <div class="{isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 delay-600 ease-out">
        <a href="https://github.com/nostr-protocol/nips" 
          class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors">
          Read the Specification
        </a>
      </div>
    </div>
  </div>
</section>
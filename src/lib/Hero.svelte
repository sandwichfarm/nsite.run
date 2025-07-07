<script>
  import { onMount } from 'svelte';
  
  let visible = false;
  
  onMount(() => {
    visible = true;
  });
</script>

<section class="min-h-screen flex items-center justify-center relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent"></div>
  
  <div class="container mx-auto px-4 text-center z-10">
    <h1 class="text-6xl md:text-8xl font-bold mb-6 
      {visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-1000 ease-out">
      nsite
    </h1>
    
    <p class="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto
      {visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-1000 delay-300 ease-out">
      Decentralized static website hosting using Nostr public keys
    </p>
    
    <div class="{visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-1000 delay-500 ease-out space-y-4">
      <div class="flex flex-wrap justify-center gap-4 mb-8">
        <a href="#get-started" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors text-lg">
          Get Started
        </a>
        <a href="#concept" class="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">
          Learn More
        </a>
        <a href="#tools" class="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">
          Tools & Resources
        </a>
      </div>
      <a href="#concept" class="inline-flex items-center text-purple-400 hover:text-purple-300 transition-colors">
        <span class="mr-2">Scroll to explore</span>
        <svg class="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </a>
    </div>
  </div>
  
  <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-900 to-transparent"></div>
</section>
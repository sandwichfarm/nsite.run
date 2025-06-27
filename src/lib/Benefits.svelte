<script>
  export let scrollY = 0;
  export let innerHeight = 0;
  
  let sectionElement;
  let isVisible = false;
  
  $: if (sectionElement && scrollY >= 0) {
    const rect = sectionElement.getBoundingClientRect();
    isVisible = rect.top < innerHeight * 0.8 && rect.bottom > 0;
  }
  
  const benefits = [
    {
      icon: "🔐",
      title: "Cryptographic Identity",
      description: "Your website is cryptographically tied to your Nostr identity"
    },
    {
      icon: "🌐",
      title: "Decentralized",
      description: "No single point of failure - content distributed across multiple relays and servers"
    },
    {
      icon: "🚀",
      title: "Censorship Resistant",
      description: "Can't be taken down by any single entity or service provider"
    },
    {
      icon: "⚡",
      title: "Fast & Efficient",
      description: "Content-addressed storage ensures efficient caching and delivery"
    },
    {
      icon: "🔄",
      title: "Version Control",
      description: "Event-based system naturally provides version history"
    },
    {
      icon: "🎯",
      title: "Simple & Focused",
      description: "Just static files - no complex server infrastructure needed"
    }
  ];
</script>

<section bind:this={sectionElement} class="min-h-screen py-20 bg-gray-800/50">
  <div class="container mx-auto px-4">
    <h2 class="text-4xl md:text-5xl font-bold text-center mb-16
      {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-700 ease-out">
      why.
    </h2>
    
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {#each benefits as benefit, i}
        <div class="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors
          {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
          transition-all duration-700 ease-out"
          style="transition-delay: {200 + i * 100}ms">
          <div class="text-4xl mb-4">{benefit.icon}</div>
          <h3 class="text-xl font-semibold mb-2 text-purple-400">{benefit.title}</h3>
          <p class="text-gray-300">{benefit.description}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
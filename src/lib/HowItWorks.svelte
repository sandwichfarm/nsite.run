<script>
  export let scrollY = 0;
  export let innerHeight = 0;
  
  let sectionElement;
  let isVisible = false;
  
  $: if (sectionElement && scrollY >= 0) {
    const rect = sectionElement.getBoundingClientRect();
    isVisible = rect.top < innerHeight * 0.8 && rect.bottom > 0;
  }
  
  const steps = [
    {
      number: "1",
      title: "Publish Static File Events",
      description: "Create Nostr events (kind 34128) that define your website files with paths and content hashes"
    },
    {
      number: "2",
      title: "Upload to Blossom",
      description: "Store your actual file content on Blossom servers using SHA256 content addressing"
    },
    {
      number: "3",
      title: "Host Server Resolution",
      description: "nsite servers resolve your pubkey from the URL and fetch your file events from relays"
    },
    {
      number: "4",
      title: "Content Delivery",
      description: "The server retrieves files from Blossom and serves them to visitors with proper headers"
    }
  ];
</script>

<section bind:this={sectionElement} class="min-h-screen py-20 bg-gray-800/50">
  <div class="container mx-auto px-4">
    <h2 class="text-4xl md:text-5xl font-bold text-center mb-16
      {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
      transition-all duration-700 ease-out">
      how.
    </h2>
    
    <div class="max-w-4xl mx-auto">
      {#each steps as step, i}
        <div class="flex items-start mb-12
          {isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'} 
          transition-all duration-700 ease-out"
          style="transition-delay: {200 + i * 100}ms">
          
          <div class="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold mr-6">
            {step.number}
          </div>
          
          <div class="flex-1">
            <h3 class="text-2xl font-semibold mb-2">{step.title}</h3>
            <p class="text-gray-300">{step.description}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
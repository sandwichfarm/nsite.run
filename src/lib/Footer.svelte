<script>
  export let scrollY = 0;
  export let innerHeight = 0;
  
  let sectionElement;
  let isVisible = false;
  
  $: if (sectionElement && scrollY >= 0) {
    const rect = sectionElement.getBoundingClientRect();
    isVisible = rect.top < innerHeight * 0.8 && rect.bottom > 0;
  }
  
  const links = [
    {
      title: "GitHub",
      url: "https://github.com/nostrver-se/awesome-nsite",
      desc: "Awesome nsite collection"
    },
    {
      title: "Nostr",
      url: "https://github.com/nostr-protocol/nips",
      desc: "Protocol documentation"
    },
    {
      title: "Blossom",
      url: "https://github.com/hzrd149/blossom",
      desc: "Storage specification"
    },
    {
      title: "Community",
      url: "https://following.space/d/5gpy56fm3dga?p=e771af0b05c8e95fcdf6feb3500544d2fb1ccd384788e9f490bb3ee28e8ed66f",
      desc: "Follow nsite developers"
    }
  ];
</script>

<section bind:this={sectionElement} class="py-20 bg-gray-900">
  <div class="container mx-auto px-4">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12 text-gray-400
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
        transition-all duration-700 ease-out">
        Links
      </h2>
      
      <div class="grid md:grid-cols-2 gap-6">
        {#each links as link, i}
          <a href={link.url} target="_blank" rel="noreferrer"
            class="bg-gray-800/50 p-6 rounded-lg hover:bg-gray-800 transition-colors group
            {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} 
            transition-all duration-700 ease-out"
            style="transition-delay: {200 + i * 100}ms">
            <h3 class="font-semibold text-lg mb-1 group-hover:text-purple-400 transition-colors">{link.title}</h3>
            <p class="text-gray-500 text-sm">{link.desc}</p>
          </a>
        {/each}
      </div>
    </div>
  </div>
</section>

<div class="py-8 bg-gray-950">
  <div class="container mx-auto px-4 text-center">
    <a href="https://njump.me/bread@sandwich.farm" 
       target="_blank"
       class="font-mono text-sm text-gray-600 hover:text-gray-500 transition-colors">
      vibed by npub1uac67zc9er54ln0kl6e4qp2y6ta3enfcg7ywnayshvlw9r5w6ehsqq99rx
    </a>
  </div>
</div>
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

<section bind:this={sectionElement} class="min-h-screen py-20">
  <div class="container mx-auto px-4">
    <h2 class="text-4xl md:text-5xl font-bold text-center mb-16
      {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
      transition-all duration-700 ease-out">
      tech.
    </h2>

    <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      <div class="bg-gray-800 p-6 rounded-lg
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        transition-all duration-700 delay-200 ease-out">
        <h3 class="text-xl font-semibold mb-4 text-purple-400">Event Structure</h3>
        <pre class="text-sm text-gray-300 overflow-x-auto"><code>{`{
  "kind": 34128,
  "tags": [
    ["d", "/index.html"],
    ["x", "sha256hash..."]
  ],
  "content": ""
}`}</code></pre>
      </div>

      <div class="bg-gray-800 p-6 rounded-lg
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        transition-all duration-700 delay-300 ease-out">
        <h3 class="text-xl font-semibold mb-4 text-purple-400">URL Format</h3>
        <p class="text-gray-300 mb-2">Domain routing:</p>
        <code class="text-sm bg-gray-700 px-2 py-1 rounded">npub1xxx.example.com</code>
        <p class="text-gray-300 mt-4 text-sm">
          nsite uses domain-based routing where each pubkey gets its own subdomain.
        </p>
      </div>

      <div class="bg-gray-800 p-6 rounded-lg
        {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        transition-all duration-700 delay-400 ease-out">
        <h3 class="text-xl font-semibold mb-4 text-purple-400">Dependencies</h3>
        <ul class="text-gray-300 space-y-2">
          <li>• <a href="https://github.com/nostr-protocol/nips" target="_blank" rel="noopener noreferrer" class="underline">Nostr protocol</a></li>
          <li>• <a href="https://github.com/hzrd149/blossom" target="_blank" rel="noopener noreferrer" class="underline">Blossom (BUD-01)</a></li>
          <li>• <a href="https://github.com/nostr-protocol/nips/blob/master/65.md" target="_blank" rel="noopener noreferrer" class="underline">NIP-65 relay lists</a></li>
          <li>• SHA256 hashing</li>
        </ul>
      </div>
    </div>

    <div class="mt-12 max-w-4xl mx-auto
      {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
      transition-all duration-700 delay-500 ease-out">
      <div class="bg-gray-800 p-8 rounded-lg">
        <h3 class="text-2xl font-semibold mb-4 text-purple-400">Implementation Flow</h3>
        <ol class="list-decimal list-inside text-gray-300 space-y-2">
          <li>Host server receives HTTP request for pubkey domain</li>
          <li>Fetches user's relay list using NIP-65</li>
          <li>Queries relays for kind 34128 events from that pubkey</li>
          <li>Maps requested path to event with matching 'd' tag</li>
          <li>Retrieves blob from Blossom using 'x' tag hash</li>
          <li>Serves content with appropriate MIME type</li>
        </ol>
      </div>
    </div>
  </div>
</section>

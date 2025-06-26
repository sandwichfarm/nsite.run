<script>
  import { onMount } from 'svelte';
  import Hero from './lib/Hero.svelte';
  import Concept from './lib/Concept.svelte';
  import HowItWorks from './lib/HowItWorks.svelte';
  import TechnicalDetails from './lib/TechnicalDetails.svelte';
  import Benefits from './lib/Benefits.svelte';
  import ToolsResources from './lib/ToolsResources.svelte';
  import GetStarted from './lib/GetStarted.svelte';

  let scrollY = 0;
  let innerHeight = 0;

  onMount(() => {
    const handleScroll = () => scrollY = window.scrollY;
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<svelte:window bind:scrollY bind:innerHeight />

<main class="bg-gray-900 text-white overflow-x-hidden">
  <Hero />
  <Concept {scrollY} {innerHeight} />
  <HowItWorks {scrollY} {innerHeight} />
  <TechnicalDetails {scrollY} {innerHeight} />
  <Benefits {scrollY} {innerHeight} />
  <ToolsResources {scrollY} {innerHeight} />
  <GetStarted {scrollY} {innerHeight} />
</main>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
  
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>

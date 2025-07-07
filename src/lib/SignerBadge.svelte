<script>
  export let capability;
  
  const badgeColors = {
    'bunker': 'bg-purple-900/30 text-purple-300 border-purple-700/30',
    'private-key': 'bg-gray-800/30 text-gray-400 border-gray-700/30'
  };
  
  const badgeIcons = {
    'bunker': '🔐',
    'private-key': '🔑'
  };
  
  const badgeLabels = {
    'bunker': 'Bunker',
    'private-key': 'Private Key'
  };
</script>

<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border {badgeColors[capability] || 'bg-gray-800/30 text-gray-400 border-gray-700/30'}">
  <span class="mr-1">{badgeIcons[capability] || '🔒'}</span>
  {badgeLabels[capability] || capability}
</span>
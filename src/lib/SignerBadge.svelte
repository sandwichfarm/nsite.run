<script>
  export let capability;
  
  const badgeColors = {
    'bunker': 'bg-purple-100 text-purple-800 border-purple-200',
    'private-key': 'bg-gray-100 text-gray-800 border-gray-200'
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

<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border {badgeColors[capability] || 'bg-gray-100 text-gray-800 border-gray-200'}">
  <span class="mr-1">{badgeIcons[capability] || '🔒'}</span>
  {badgeLabels[capability] || capability}
</span>
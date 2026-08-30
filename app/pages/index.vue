<script setup lang="ts">
async function onSearch(query: string) {
  console.log('Searching for:', query);

  try {
    const results = await $fetch('/api/search', {
      query: {
        q: query,
      },
    });

    console.log('Results:', results);
  } catch (error) {
    console.error('Search failed:', error);
  }
}
</script>

<template>
  <SearchBar @search="onSearch" />
</template>
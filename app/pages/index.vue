<script setup lang="ts">
import { SearchBar } from '#components';
import SearchResult from '~/components/search/SearchResult.vue';
import { useSearch } from '~/composables/useSearch';

const { results, loading, error, hasMore, search, showMore } = useSearch();
const hasSearched = ref(false);

function onSearch(query: string) {
  hasSearched.value = true;
  search(query);
}

function onDownload(songId: number) {
  console.log('Download:', songId);
}
</script>

<template>
  <div class="page">
    <header class="header">
      <h1 class="logo">Open Tab</h1>
      <SearchBar @search="onSearch" />
    </header>

    <main class="main">
      <div v-if="loading && results.length === 0" class="status">
        Searching...
      </div>

      <div v-else-if="error" class="status error">
        {{ error }}
      </div>

      <div v-else-if="hasSearched && results.length === 0 && !loading" class="status">
        No results found
      </div>

      <div v-else class="results">
        <SearchResult
          v-for="result in results"
          :key="result.songId"
          :result="result"
          @download="onDownload"
        />

        <button
          v-if="hasMore"
          class="show-more"
          :disabled="loading"
          @click="showMore"
        >
          {{ loading ? 'Loading...' : 'Show more' }}
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
}

.logo {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.5px;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status {
  text-align: center;
  color: #666;
  padding: 40px 0;
  font-size: 14px;
}

.status.error {
  color: #f87171;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.show-more {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #111;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.show-more:hover:not(:disabled) {
  background: #1a1a1a;
  border-color: #444;
  color: #ccc;
}

.show-more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

import { ref } from 'vue';

interface Track {
  instrumentId: number;
  instrument: string;
  tuning?: number[];
  difficulty?: number;
  hash: string;
}

interface SearchResult {
  songId: number;
  title: string;
  artist: string;
  source: string;
  tracks: Track[];
}

export function useSearch() {
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(false);

  let currentQuery = '';
  let currentOffset = 0;
  const PAGE_SIZE = 10;

  async function search(query: string, append = false) {
    currentQuery = query;
    currentOffset = append ? results.value.length : 0;
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams({
        q: query,
        size: String(PAGE_SIZE),
        from: String(currentOffset),
        more: 'true',
      });

      const response = await $fetch<SearchResult[]>(`/api/search?${params.toString()}`);

      if (append) {
        results.value = [...results.value, ...response];
      } else {
        results.value = response;
      }

      hasMore.value = response.length >= PAGE_SIZE;
    } catch (e: any) {
      error.value = e.message || 'Search failed';
      if (!append) results.value = [];
    } finally {
      loading.value = false;
    }
  }

  function showMore() {
    if (currentQuery && hasMore.value && !loading.value) {
      search(currentQuery, true);
    }
  }

  return {
    results,
    loading,
    error,
    hasMore,
    search,
    showMore,
  };
}

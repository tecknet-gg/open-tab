<script setup lang="ts">
import { ref } from 'vue';

const query = ref('');
const emit = defineEmits<{ search: [query: string] }>();

function submitSearch() {
  const trimmedQuery = query.value.trim();
  if (!trimmedQuery) return;
  emit('search', trimmedQuery);
}
</script>

<template>
  <form class="search-bar" @submit.prevent="submitSearch">
    <input
      v-model="query"
      type="text"
      placeholder="Search for a song..."
      class="search-input"
    />
    <button type="submit" class="search-btn">
      Search
    </button>
  </form>
</template>

<style scoped>
.search-bar {
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 500px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #111;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: #555;
}

.search-input::placeholder {
  color: #555;
}

.search-btn {
  padding: 10px 20px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #1a1a1a;
  color: #ccc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.search-btn:hover {
  background: #222;
  border-color: #555;
  color: #fff;
}
</style>

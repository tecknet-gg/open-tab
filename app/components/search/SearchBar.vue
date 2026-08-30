<script setup lang="ts">
import { ref, watch } from 'vue';
const query = ref('');
let timeout: ReturnType<typeof setTimeout>;

const emit = defineEmits<{
  search: [query: string];
}>();

watch(query, (newQuery) => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    emit('search', newQuery);
  },300)
});



function submitSearch() {
  emit('search', query.value);
}
</script>

<template>
  <div
    class="search-bar">
    <input
        class="search-input"
        v-model="query"
        type="text"
        placeholder="Search for a song"
    />
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.search-input {
  width: 400px;
  padding: 10px 14px;

  background: #0b0f11;
  color: #f1f1f1;

  border: 1px solid #252c30;
  border-radius: 8px;

  font-size: 14px;
  outline: none;

}
.search-button {
  box-sizing: border-box;

  width: 100px;
  padding: 10px 14px;

  background: #0b0f11;
  color: #f1f1f1;

  border: 1px solid #252c30;
  border-radius: 8px;

  font-size: 14px;
  cursor: pointer;
}
</style>
<script setup lang="ts">
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

const props = defineProps<{ result: SearchResult }>();

const emit = defineEmits<{
  download: [songId: number];
}>();

const guitarTrack = computed(() =>
  props.result.tracks.find(
    (t) => t.instrumentId === 25 || t.instrumentId === 26 || t.instrument?.toLowerCase().includes('guitar')
  )
);

const difficultyLabel = computed(() => {
  const d = guitarTrack.value?.difficulty;
  if (!d) return null;
  if (d <= 2) return 'Easy';
  if (d <= 3) return 'Medium';
  return 'Hard';
});

const difficultyColor = computed(() => {
  const d = guitarTrack.value?.difficulty;
  if (!d) return '#666';
  if (d <= 2) return '#4ade80';
  if (d <= 3) return '#facc15';
  return '#f87171';
});
</script>

<template>
  <div class="search-result">
    <div class="result-info">
      <div class="result-title">{{ result.title }}</div>
      <div class="result-artist">{{ result.artist }}</div>
      <div class="result-meta">
        <span class="track-count">{{ result.tracks.length }} tracks</span>
        <span v-if="difficultyLabel" class="difficulty" :style="{ color: difficultyColor }">
          {{ difficultyLabel }}
        </span>
      </div>
    </div>
    <button class="download-btn" @click="emit('download', result.songId)">
      Download
    </button>
  </div>
</template>

<style scoped>
.search-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid #222;
  border-radius: 8px;
  background: #111;
  transition: border-color 0.15s;
}

.search-result:hover {
  border-color: #444;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-title {
  font-weight: 600;
  font-size: 15px;
  color: #fff;
}

.result-artist {
  font-size: 13px;
  color: #888;
}

.result-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.difficulty {
  font-weight: 500;
}

.download-btn {
  padding: 8px 16px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a1a;
  color: #ccc;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.download-btn:hover {
  background: #222;
  border-color: #555;
  color: #fff;
}
</style>

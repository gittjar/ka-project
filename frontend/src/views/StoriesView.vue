<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api';

interface Story {
  _id: string;
  title: string;
  content: string;
  author: string;
  imageUrl: string;
  createdAt: string;
}

const stories = ref<Story[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get('/stories');
    stories.value = data;
  } finally {
    loading.value = false;
  }
});

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-8">Tarinoita</h1>

    <div v-if="loading" class="text-gray-500">Ladataan...</div>

    <div v-else-if="stories.length === 0" class="text-gray-500 italic">Ei tarinoita vielä.</div>

    <div v-else class="space-y-8">
      <article v-for="s in stories" :key="s._id" class="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 class="text-xl font-bold text-white mb-1">{{ s.title }}</h2>
        <p class="text-xs text-gray-500 mb-4">{{ s.author }} · {{ formatDate(s.createdAt) }}</p>
        <img v-if="s.imageUrl" :src="s.imageUrl" :alt="s.title" class="rounded-lg mb-4 max-h-64 object-cover w-full" />
        <p class="text-gray-300 whitespace-pre-line leading-relaxed">{{ s.content }}</p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';

interface Member {
  _id: string;
  name: string;
  aliases: string[];
  quote: string;
  born: string;
  highestPromille: string;
  favDrink: string;
  location: string;
  avatarUrl: string;
  points: number;
}

const members = ref<Member[]>([]);
const search = ref('');
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get('/members');
    members.value = data;
  } finally {
    loading.value = false;
  }
});

const filtered = computed(() =>
  members.value.filter(m =>
    m.name.toLowerCase().includes(search.value.toLowerCase()) ||
    m.location.toLowerCase().includes(search.value.toLowerCase()) ||
    m.aliases.some(a => a.toLowerCase().includes(search.value.toLowerCase()))
  )
);
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-6">Jäsenet</h1>

    <input v-model="search" type="text" placeholder="Hae nimellä, aliaksella tai paikkakunnalla..."
      class="w-full max-w-md px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-8" />

    <div v-if="loading" class="text-gray-500">Ladataan...</div>

    <div v-else-if="filtered.length === 0" class="text-gray-500 italic">Ei tuloksia haulla "{{ search }}"</div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="m in filtered" :key="m._id"
        class="bg-gray-800/60 border border-gray-700 rounded-xl p-5 hover:border-purple-600 transition-colors">

        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-full bg-purple-900 flex items-center justify-center text-xl overflow-hidden">
            <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" class="w-full h-full object-cover" />
            <span v-else>🧙</span>
          </div>
          <div>
            <div class="font-bold text-gray-100">{{ m.name }}</div>
            <div v-if="m.aliases.length" class="text-xs text-gray-400">{{ m.aliases.join(', ') }}</div>
          </div>
        </div>

        <p v-if="m.quote" class="text-sm italic text-purple-300 mb-2">"{{ m.quote }}"</p>

        <div class="text-xs text-gray-400 space-y-0.5">
          <div v-if="m.location">📍 {{ m.location }}</div>
          <div v-if="m.favDrink">🍺 {{ m.favDrink }}</div>
          <div v-if="m.highestPromille">💀 Korkein: {{ m.highestPromille }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

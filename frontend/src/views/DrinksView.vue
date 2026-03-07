<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api';

interface Drink {
  _id: string;
  name: string;
  instructions: string;
  author: string;
  imageUrl: string;
}

const drinks = ref<Drink[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get('/drinks');
    drinks.value = data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-8">Juomat</h1>

    <div v-if="loading" class="text-gray-500">Ladataan...</div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="text-xs uppercase text-gray-500 border-b border-gray-700">
          <tr>
            <th class="py-3 pr-4 w-40">Drinkki</th>
            <th class="py-3 pr-4">Ohjeet</th>
            <th class="py-3">Tekijä</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in drinks" :key="d._id" class="border-b border-gray-800 hover:bg-gray-800/40">
            <td class="py-3 pr-4 font-semibold text-purple-300 align-top">{{ d.name }}</td>
            <td class="py-3 pr-4 text-gray-300 align-top whitespace-pre-line">{{ d.instructions }}</td>
            <td class="py-3 text-gray-400 align-top">{{ d.author }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="drinks.length === 0" class="text-gray-500 italic mt-4">Ei drinkkejä vielä.</p>
    </div>
  </div>
</template>

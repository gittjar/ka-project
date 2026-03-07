<script setup lang="ts">
import { ref } from 'vue';

interface GalleryImage { url: string; blobName: string; }

const images = ref<GalleryImage[]>([]);
const lightbox = ref<string | null>(null);
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-8">Kuvia</h1>

    <div v-if="images.length === 0" class="text-gray-500 italic">
      Ei kuvia vielä. Lisää kuvia admin-paneelista.
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      <img v-for="img in images" :key="img.blobName" :src="img.url"
        class="rounded-lg object-cover aspect-square cursor-pointer hover:opacity-80 transition-opacity"
        @click="lightbox = img.url" />
    </div>

    <!-- Lightbox -->
    <div v-if="lightbox" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      @click="lightbox = null">
      <img :src="lightbox" class="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl" @click.stop />
      <button class="absolute top-4 right-4 text-white text-3xl" @click="lightbox = null">✕</button>
    </div>
  </div>
</template>

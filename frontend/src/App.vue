<script setup lang="ts">
import { onMounted } from 'vue';
import NavBar from './components/NavBar.vue';
import Footer from './components/Footer.vue';

// Ping backend on first load so Render's free-tier instance wakes up early
onMounted(() => {
  const base = import.meta.env.VITE_API_URL ?? '/api';
  fetch(`${base}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {/* ignore */});
});
</script>

<template>
  <div class="flex flex-col min-h-screen bg-ink text-gray-100">
    <NavBar />
    <main class="flex-1 pt-2">
      <RouterView />
    </main>
    <Footer />
  </div>
</template>

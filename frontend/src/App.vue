<script setup lang="ts">
import NavBar from './components/NavBar.vue';
import Footer from './components/Footer.vue';
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

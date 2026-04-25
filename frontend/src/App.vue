<script setup lang="ts">
import { ref, onMounted } from 'vue';
import NavBar from './components/NavBar.vue';
import Footer from './components/Footer.vue';

const sessionExpired = ref(false);

// Ping backend on first load so Render's free-tier instance wakes up early
onMounted(() => {
  const base = import.meta.env.VITE_API_URL ?? '/api';
  fetch(`${base}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {/* ignore */});

  // Näytä toast jos session vanhentui
  if (sessionStorage.getItem('kk_session_expired')) {
    sessionStorage.removeItem('kk_session_expired');
    sessionExpired.value = true;
    setTimeout(() => { sessionExpired.value = false; }, 6000);
  }
});
</script>

<template>
  <div class="flex flex-col min-h-screen bg-ink text-gray-100">
    <NavBar />
    <main class="flex-1 pt-2">
      <RouterView />
    </main>
    <Footer />

    <!-- Session expired toast -->
    <Transition name="toast">
      <div v-if="sessionExpired"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]
               flex items-center gap-3 px-5 py-3 rounded-xl
               bg-dpurple-900/95 border border-dpurple-600/50
               text-dpurple-400 text-sm shadow-xl backdrop-blur-sm"
        role="alert"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
        </svg>
        <span>Kirjautumisesi on vanhentunut — kirjaudu uudelleen</span>
        <button @click="sessionExpired = false" class="ml-2 text-dpurple-400/60 hover:text-dpurple-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.35s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 1.5rem); }
</style>


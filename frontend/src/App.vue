<script setup lang="ts">
import { ref, onMounted } from 'vue';
import NavBar from './components/NavBar.vue';
import Footer from './components/Footer.vue';
import api from './api';
import { overlayVisible, isDown, elapsedSec } from './composables/backendStatus';

const sessionExpired = ref(false);
function reloadPage() { window.location.reload(); }

// Ping backend on first load so Render's free-tier instance wakes up early.
// Goes through the api instance so the status tracker can show the overlay.
onMounted(() => {
  api.get('/health').catch(() => {/* ignore — status tracker handles it */});

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

    <!-- Backend käynnistyy -overlay (Render ilmaispalvelu cold-start) -->
    <Transition name="backend-overlay">
      <div v-if="overlayVisible"
        class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
        aria-live="polite"
      >
        <div class="mx-4 max-w-sm w-full bg-neutral-900 border border-neutral-700/80 rounded-2xl p-8 text-center shadow-2xl">

          <!-- Käynnistystila -->
          <template v-if="!isDown">
            <!-- Spinner -->
            <div class="flex justify-center mb-5">
              <svg class="w-10 h-10 animate-spin text-dgreen-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
                <path class="opacity-90" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <h3 class="text-white font-semibold text-lg mb-1">Herätellään palvelinta…</h3>
            <p class="text-gray-400 text-sm mb-1">
              Käytämme Renderin ilmaispalvelua — palvelin käynnistyy noin 30 sekunnissa.
            </p>
            <p class="text-gray-600 text-xs mb-4">Pidä hetki — sivu latautuu automaattisesti.</p>
            <!-- Aikamittari -->
            <div class="text-xs text-gray-500 font-mono mb-2">{{ Math.floor(elapsedSec) }}s</div>
            <!-- Progress -->
            <div class="h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div class="h-full bg-dgreen-600 rounded-full transition-all duration-300"
                   :style="{ width: Math.min(100, (elapsedSec / 60) * 100) + '%' }" />
            </div>
          </template>

          <!-- Aikakatkaisu / alhaalla -->
          <template v-else>
            <div class="flex justify-center mb-5 text-red-400">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <h3 class="text-white font-semibold text-lg mb-2">Palvelimeen ei saada yhteyttä</h3>
            <p class="text-gray-400 text-sm mb-5">
              Tule takaisin hetken kuluttua — palvelin saattaa olla hetkellisesti alhaalla.
            </p>
            <button
              @click="reloadPage"
              class="px-5 py-2 rounded-lg bg-dgreen-800/60 hover:bg-dgreen-700/60
                     border border-dgreen-700/50 text-dgreen-300 text-sm font-medium
                     transition-colors"
            >
              Yritä uudelleen
            </button>
          </template>

        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.35s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 1.5rem); }

.backend-overlay-enter-active { transition: opacity 0.4s ease; }
.backend-overlay-leave-active { transition: opacity 0.6s ease; }
.backend-overlay-enter-from,
.backend-overlay-leave-to { opacity: 0; }
</style>


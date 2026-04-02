<script setup lang="ts">
import { RouterLink } from 'vue-router';

const links = [
  { to: '/jasenet',  label: 'Jäsenet' },
  { to: '/galleria', label: 'Kuvia' },
  { to: '/tarinat',  label: 'Tarinoita' },
  { to: '/historia', label: 'Historiikki' },
  { to: '/juomat',   label: 'Juomat' },
  { to: '/hakemus',  label: 'Hakemus' },
];

const year = new Date().getFullYear();
</script>

<template>
  <footer class="mt-auto relative overflow-hidden">
    <!-- Yläreuna-gradient -->
    <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-dpurple-700/60 to-transparent" />
    <!-- Taustaglöw -->
    <div class="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[600px] h-48
                bg-dpurple-900/20 blur-3xl rounded-full pointer-events-none" />

    <div class="relative px-6 sm:px-10 lg:px-16 pt-12 pb-8">
      <div class="max-w-5xl mx-auto">

        <!-- Yläosa: brandi + linkit -->
        <div class="flex flex-col sm:flex-row sm:items-start gap-10 sm:gap-16 mb-10">

          <!-- Brandi -->
          <div class="shrink-0">
            <RouterLink to="/"
              class="inline-block font-black text-2xl tracking-tight
                     bg-gradient-to-r from-dpurple-400 via-dgreen-400 to-dpurple-300
                     bg-clip-text text-transparent hover:opacity-80 transition-opacity">
              Kanniaalio+
            </RouterLink>
            <p class="text-gray-500 text-xs mt-2 max-w-[200px] leading-relaxed">
              BatMUD-killan perintöä<br>vuodesta 2003.
            </p>
          </div>

          <!-- Linkit -->
          <nav class="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-2.5">
            <RouterLink
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              class="text-sm text-gray-500 hover:text-dgreen-400 transition-colors"
            >
              {{ l.label }}
            </RouterLink>
          </nav>
        </div>

        <!-- Alatunniste -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-2
                    pt-6 border-t border-white/5 text-xs text-gray-700">
          <span>© Kanniaalio+ 2003–{{ year }}</span>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-dgreen-600/70 animate-pulse" />
            <span>Vue 3 · Node.js · MongoDB</span>
          </div>
        </div>

      </div>
    </div>
  </footer>
</template>

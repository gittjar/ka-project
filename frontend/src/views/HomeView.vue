<script setup lang="ts">
import { RouterLink } from 'vue-router';

const nav = [
  { to: '/jasenet',  label: 'Jäsenet',    icon: '🧑‍🤝‍🧑', desc: 'Tutki seuran jäseniä' },
  { to: '/kuvat',    label: 'Kuvia',       icon: '📷',       desc: 'Galleria vuosien varrelta' },
  { to: '/tarinat',  label: 'Tarinoita',   icon: '📖',       desc: 'Jäsenten kertomuksia' },
  { to: '/historia', label: 'Historiikki', icon: '🏺',       desc: 'Seuran historia vuodesta 2003' },
  { to: '/juomat',   label: 'Juomat',      icon: '🍹',       desc: 'Reseptit ja drinkkilista' },
  { to: '/hakemus',  label: 'Hakemus',     icon: '📝',       desc: 'Liity seuran jäseneksi' },
];
</script>

<template>
  <!-- Hero -->
  <section class="relative overflow-hidden">
    <!-- Taustahehku -->
    <div class="pointer-events-none absolute inset-0 -z-10">
      <div class="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[400px]
                  bg-purple-700/20 blur-3xl rounded-full"></div>
    </div>

    <div class="max-w-3xl mx-auto px-4 pt-16 pb-10 text-center">
      <div class="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full
                  bg-purple-900/40 border border-purple-700/50 text-purple-300 text-xs font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
        Vuodesta 2003
      </div>

      <h1 class="text-5xl sm:text-6xl font-extrabold text-white mb-4 tracking-tight leading-tight">
        Kanniaalio<span class="text-purple-400">+</span>
      </h1>
      <p class="text-gray-400 text-lg sm:text-xl max-w-md mx-auto leading-relaxed">
        Internet-aikakausien perintöä. Yhteisö, historia ja meininki yhdessä paikassa.
      </p>

      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <RouterLink to="/jasenet"
          class="w-full sm:w-auto px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500
                 text-white font-semibold transition-colors shadow-lg shadow-purple-900/40">
          Tutustu jäseniin
        </RouterLink>
        <RouterLink to="/hakemus"
          class="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-600 hover:border-purple-500
                 text-gray-300 hover:text-white font-semibold transition-colors">
          Hae jäseneksi
        </RouterLink>
      </div>
    </div>
  </section>

  <!-- Navigaatiokortit -->
  <section class="max-w-3xl mx-auto px-4 pb-16">
    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 text-center">
      Mitä löydät
    </h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="group flex flex-col gap-2 p-4 sm:p-5 rounded-2xl
               bg-gray-800/60 hover:bg-purple-900/30
               border border-gray-700/60 hover:border-purple-600/60
               transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/20"
      >
        <span class="text-2xl sm:text-3xl">{{ item.icon }}</span>
        <div>
          <p class="text-sm font-semibold text-gray-100 group-hover:text-white">{{ item.label }}</p>
          <p class="text-xs text-gray-500 mt-0.5 leading-snug">{{ item.desc }}</p>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

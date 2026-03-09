<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Users, Camera, BookOpen, ScrollText, GlassWater, ClipboardList } from 'lucide-vue-next';

const nav = [
  { to: '/jasenet',  label: 'Jäsenet',    icon: Users,         desc: 'Tutki seuran jäseniä' },
  { to: '/kuvat',    label: 'Kuvia',       icon: Camera,        desc: 'Galleria vuosien varrelta' },
  { to: '/tarinat',  label: 'Tarinoita',   icon: BookOpen,      desc: 'Jäsenten kertomuksia' },
  { to: '/historia', label: 'Historiikki', icon: ScrollText,    desc: 'Seuran historia vuodesta 2003' },
  { to: '/juomat',   label: 'Juomat',      icon: GlassWater,    desc: 'Reseptit ja drinkkilista' },
  { to: '/hakemus',  label: 'Hakemus',     icon: ClipboardList, desc: 'Liity seuran jäseneksi' },
];
</script>

<template>
  <!-- Hero -->
  <section class="relative overflow-hidden">
    <!-- Taustahehkut -->
    <div class="pointer-events-none absolute inset-0 -z-10">
      <div class="absolute left-1/4 top-0 w-[500px] h-[400px]
                  bg-dpurple-900/30 blur-3xl rounded-full"></div>
      <div class="absolute right-1/4 top-10 w-[400px] h-[300px]
                  bg-dgreen-900/25 blur-3xl rounded-full"></div>
    </div>

    <div class="px-4 sm:px-8 lg:px-12 pt-12 pb-10 text-center">
      <div class="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full
                  bg-dgreen-900/50 border border-dgreen-800/60 text-dgreen-400 text-xs font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-dgreen-400 animate-pulse"></span>
        Vuodesta 2003
      </div>

      <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-4 tracking-tight leading-tight">
        Kanniaalio<span class="text-dpurple-400">+</span>
      </h1>
      <p class="text-gray-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
        Internet-aikakausien perintöä. Yhteisö, historia ja meininki yhdessä paikassa.
      </p>

      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <RouterLink to="/jasenet"
          class="w-full sm:w-auto px-6 py-3 rounded-xl bg-dgreen-800 hover:bg-dgreen-600
                 text-white font-semibold transition-all duration-200 shadow-lg shadow-dgreen-900/40
                 hover:shadow-dgreen-800/40 hover:-translate-y-0.5">
          Tutustu jäseniin
        </RouterLink>
        <RouterLink to="/hakemus"
          class="w-full sm:w-auto px-6 py-3 rounded-xl border border-dpurple-800/70
                 hover:border-dpurple-600 hover:bg-dpurple-900/40
                 text-gray-300 hover:text-white font-semibold transition-all duration-200">
          Hae jäseneksi
        </RouterLink>
      </div>
    </div>
  </section>

  <!-- Navigaatiokortit -->
  <section class="px-4 sm:px-8 lg:px-12 pb-16">
    <h2 class="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-4 text-center">
      Mitä löydät
    </h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="group flex flex-col gap-2 p-4 sm:p-5 rounded-2xl
               bg-black/60 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        :class="nav.indexOf(item) % 2 === 0
          ? 'border-dgreen-900/50 hover:bg-dgreen-950/60 hover:border-dgreen-800/70 hover:shadow-dgreen-900/20'
          : 'border-dpurple-900/50 hover:bg-dpurple-950/60 hover:border-dpurple-800/70 hover:shadow-dpurple-900/20'"
      >
        <component :is="item.icon" class="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.5]"
          :class="nav.indexOf(item) % 2 === 0 ? 'text-dgreen-400' : 'text-dpurple-400'" />
        <div>
          <p class="text-sm font-semibold text-gray-200 group-hover:text-white">{{ item.label }}</p>
          <p class="text-xs text-gray-600 mt-0.5 leading-snug">{{ item.desc }}</p>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

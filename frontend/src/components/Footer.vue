<script setup lang="ts">
import { RouterLink } from 'vue-router';

const links = [
  { to: '/jasenet',  label: 'Jäsenet' },
  { to: '/kuvat',    label: 'Kuvia' },
  { to: '/tarinat',  label: 'Tarinoita' },
  { to: '/historia', label: 'Historiikki' },
  { to: '/juomat',   label: 'Juomat' },
  { to: '/hakemus',  label: 'Hakemus' },
];

const year = new Date().getFullYear();
</script>

<template>
  <footer class="mt-auto border-t border-dgreen-900/40 bg-black/80">
    <div class="px-4 sm:px-8 lg:px-12 py-8 sm:py-10">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">

        <!-- Brandi -->
        <div class="flex-shrink-0">
          <RouterLink to="/"
            class="font-bold text-xl tracking-wide
                   bg-gradient-to-r from-dpurple-400 to-dgreen-400 bg-clip-text text-transparent
                   hover:from-dpurple-300 hover:to-dgreen-300 transition-all">
            Kanniaalio+
          </RouterLink>
          <p class="text-gray-600 text-sm mt-2 max-w-xs leading-relaxed">
            Internet-aikakausien perintöä vuodesta&nbsp;2003.
          </p>
        </div>

        <!-- Linkit -->
        <nav class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="text-sm text-gray-600 hover:text-dgreen-400 transition-colors"
          >
            {{ l.label }}
          </RouterLink>
        </nav>
      </div>

      <!-- Alatunniste -->
      <div class="mt-8 pt-6 border-t border-dgreen-900/30 flex flex-col sm:flex-row
                  items-center justify-between gap-2 text-xs text-gray-700">
        <span>© Kanniaalio+ 2003–{{ year }}. Kaikki oikeudet pidätetään.</span>
        <span class="text-gray-800">Rakennettu Vue&nbsp;3 + Node.js</span>
      </div>
    </div>
  </footer>
</template>

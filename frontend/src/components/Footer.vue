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
  <footer class="mt-auto border-t border-gray-800 bg-gray-950">
    <div class="max-w-6xl mx-auto px-4 py-8 sm:py-10">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">

        <!-- Brandi -->
        <div class="flex-shrink-0">
          <RouterLink to="/" class="text-purple-400 font-bold text-xl tracking-wide hover:text-purple-300">
            Kanniaalio+
          </RouterLink>
          <p class="text-gray-500 text-sm mt-2 max-w-xs leading-relaxed">
            Internet-aikakausien perintöä vuodesta&nbsp;2003.
          </p>
        </div>

        <!-- Linkit -->
        <nav class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="text-sm text-gray-400 hover:text-purple-300 transition-colors"
          >
            {{ l.label }}
          </RouterLink>
        </nav>
      </div>

      <!-- Alatunniste -->
      <div class="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row
                  items-center justify-between gap-2 text-xs text-gray-600">
        <span>© Kanniaalio+ 2003–{{ year }}. Kaikki oikeudet pidätetään.</span>
        <span class="text-gray-700">Rakennettu Vue&nbsp;3 + Node.js</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const mobileOpen = ref(false);

const links = [
  { to: '/', label: 'Etusivu' },
  { to: '/jasenet', label: 'Jäsenet' },
  { to: '/kuvat', label: 'Kuvia' },
  { to: '/tarinat', label: 'Tarinoita' },
  { to: '/historia', label: 'Historiikki' },
  { to: '/juomat', label: 'Juomat' },
  { to: '/hakemus', label: 'Hakemus' },
];
</script>

<template>
  <nav class="bg-gray-900 border-b border-purple-800/40 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
      <!-- Logo -->
      <RouterLink to="/" class="text-purple-400 font-bold text-lg tracking-wide hover:text-purple-300">
        Kanniaalio+
      </RouterLink>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-1">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-purple-900/40 transition-colors"
          active-class="text-purple-300 bg-purple-900/30"
          exact-active-class="text-purple-300 bg-purple-900/30"
        >
          {{ l.label }}
        </RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin"
          class="ml-2 px-3 py-1.5 rounded text-sm text-yellow-400 hover:bg-yellow-900/20 transition-colors">
          Admin
        </RouterLink>
        <button v-if="auth.isLoggedIn" @click="auth.logout()"
          class="ml-3 text-xs text-gray-500 hover:text-red-400 transition-colors">
          Kirjaudu ulos
        </button>
      </div>

      <!-- Mobile hamburger -->
      <button class="md:hidden text-gray-400 hover:text-white" @click="mobileOpen = !mobileOpen">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"/>
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-if="mobileOpen" class="md:hidden border-t border-gray-800 px-4 py-2 flex flex-col gap-1">
      <RouterLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="block px-3 py-2 rounded text-sm text-gray-300 hover:text-white hover:bg-purple-900/30"
        @click="mobileOpen = false"
      >
        {{ l.label }}
      </RouterLink>
    </div>
  </nav>
</template>

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
  <!-- Kelluva navbar pienillä reunamarginaaleilla -->
  <div class="sticky top-2 z-50 px-3 sm:px-5 lg:px-8">
    <nav class="bg-black/95 backdrop-blur-md border border-green-900/60 rounded-2xl
                shadow-xl shadow-black/60">
      <div class="px-4 sm:px-5 flex items-center justify-between h-13">
        <!-- Logo -->
        <RouterLink to="/"
          class="font-bold text-lg tracking-wide
                 bg-gradient-to-r from-dpurple-400 to-dgreen-400 bg-clip-text text-transparent
                 hover:from-dpurple-300 hover:to-dgreen-300 transition-all">
          Kanniaalio+
        </RouterLink>

        <!-- Desktop links -->
        <div class="hidden md:flex items-center gap-0.5">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="px-3 py-1.5 rounded-xl text-sm text-gray-400
                   hover:text-green-300 hover:bg-dgreen-900/60 transition-all duration-150"
            active-class="!text-dpurple-400 bg-dpurple-900/50"
            exact-active-class="!text-dpurple-400 bg-dpurple-900/50"
          >
            {{ l.label }}
          </RouterLink>
          <RouterLink v-if="auth.isAdmin" to="/admin"
            class="ml-2 px-3 py-1.5 rounded-xl text-sm text-yellow-400
                   hover:bg-yellow-900/20 transition-all">
            Admin
          </RouterLink>
          <button v-if="auth.isLoggedIn" @click="auth.logout()"
            class="ml-3 text-xs text-gray-600 hover:text-red-400 transition-colors border-0 bg-transparent p-0">
            Kirjaudu ulos
          </button>
        </div>

        <!-- Mobile hamburger -->
        <button class="md:hidden text-gray-400 hover:text-green-300 transition-colors border-0 bg-transparent"
          @click="mobileOpen = !mobileOpen">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Mobile menu -->
      <div v-if="mobileOpen"
        class="md:hidden border-t border-green-900/40 px-3 py-2 flex flex-col gap-0.5 rounded-b-2xl">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="block px-3 py-2 rounded-xl text-sm text-gray-400
                 hover:text-green-300 hover:bg-dgreen-900/50 transition-all"
          active-class="!text-dpurple-400 bg-dpurple-900/40"
          @click="mobileOpen = false"
        >
          {{ l.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

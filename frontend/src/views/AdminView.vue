<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { ShieldCheck, LogOut } from 'lucide-vue-next';

const auth = useAuthStore();
const router = useRouter();

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">
    <!-- Otsikko -->
    <div class="flex items-center gap-3 mb-10">
      <div class="flex items-center justify-center w-10 h-10 rounded-xl
                  bg-dpurple-900/60 border border-dpurple-800/50">
        <ShieldCheck class="w-5 h-5 text-dpurple-400" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white">Admin-paneeli</h1>
        <p class="text-xs text-gray-600">Kirjautunut: <span class="text-gray-400">{{ auth.username }}</span></p>
      </div>
      <button @click="logout"
        class="ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors border-0 bg-transparent">
        <LogOut class="w-4 h-4" />
        Kirjaudu ulos
      </button>
    </div>

    <!-- Sisältö -->
    <div class="border border-dgreen-900/40 rounded-2xl p-6 bg-black/40 text-gray-500 italic text-sm">
      Admin-toiminnot tulossa...
    </div>
  </div>
</template>

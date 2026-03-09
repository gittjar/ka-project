<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { LogIn, Lock, User } from 'lucide-vue-next';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    const redirect = (route.query.redirect as string) || '/admin';
    router.push(redirect);
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Kirjautuminen epäonnistui';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4">
    <!-- Taustatehosteet -->
    <div class="pointer-events-none fixed inset-0 -z-10">
      <div class="absolute left-1/3 top-1/4 w-[400px] h-[400px] bg-dpurple-900/25 blur-3xl rounded-full"></div>
      <div class="absolute right-1/3 bottom-1/4 w-[300px] h-[300px] bg-dgreen-900/20 blur-3xl rounded-full"></div>
    </div>

    <div class="w-full max-w-sm">
      <!-- Otsikko -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                    bg-dpurple-900/60 border border-dpurple-800/60 mb-4">
          <Lock class="w-6 h-6 text-dpurple-400" />
        </div>
        <h1 class="text-2xl font-bold text-white">Kirjaudu sisään</h1>
        <p class="text-gray-600 text-sm mt-1">Admin-paneeli · Kanniaalio+</p>
      </div>

      <!-- Lomake -->
      <form @submit.prevent="submit"
        class="bg-black/60 border border-dgreen-900/40 rounded-2xl p-6 space-y-4">

        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Käyttäjänimi</label>
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              v-model="username"
              type="text"
              placeholder="käyttäjänimi"
              required
              autocomplete="username"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-gray-800
                     text-white placeholder-gray-700 text-sm
                     focus:outline-none focus:border-dpurple-700 focus:ring-1 focus:ring-dpurple-800/50
                     transition-colors"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Salasana</label>
          <div class="relative">
            <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-gray-800
                     text-white placeholder-gray-700 text-sm
                     focus:outline-none focus:border-dpurple-700 focus:ring-1 focus:ring-dpurple-800/50
                     transition-colors"
            />
          </div>
        </div>

        <div v-if="error"
          class="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm
                 bg-dpurple-800 hover:bg-dpurple-600 disabled:opacity-50 disabled:cursor-not-allowed
                 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-dpurple-900/40"
        >
          <LogIn v-if="!loading" class="w-4 h-4" />
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          {{ loading ? 'Kirjaudutaan...' : 'Kirjaudu sisään' }}
        </button>
      </form>
    </div>
  </div>
</template>

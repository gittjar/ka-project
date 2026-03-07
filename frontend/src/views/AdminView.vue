<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function login() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Kirjautuminen epäonnistui';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-8">Admin-paneeli</h1>

    <!-- Kirjautuminen -->
    <div v-if="!auth.isLoggedIn" class="max-w-sm">
      <form @submit.prevent="login" class="space-y-4">
        <input v-model="username" type="text" placeholder="Käyttäjänimi" required
          class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        <input v-model="password" type="password" placeholder="Salasana" required
          class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        <div v-if="error" class="text-red-400 text-sm">{{ error }}</div>
        <button type="submit" :disabled="loading"
          class="w-full py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg font-semibold text-white transition-colors">
          {{ loading ? 'Kirjaudutaan...' : 'Kirjaudu' }}
        </button>
      </form>
    </div>

    <!-- Admin-sisältö -->
    <div v-else-if="auth.isAdmin">
      <p class="text-gray-400 mb-6">Kirjautunut: <strong class="text-white">{{ auth.username }}</strong></p>
      <p class="text-gray-500 italic">Admin-toiminnot tulossa...</p>
      <button @click="auth.logout()" class="mt-6 text-sm text-gray-500 hover:text-red-400">Kirjaudu ulos</button>
    </div>

    <div v-else>
      <p class="text-red-400">Sinulla ei ole admin-oikeuksia.</p>
      <button @click="auth.logout()" class="mt-4 text-sm text-gray-500 hover:text-red-400">Kirjaudu ulos</button>
    </div>
  </div>
</template>

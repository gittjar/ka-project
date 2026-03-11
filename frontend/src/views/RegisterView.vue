<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UserPlus, AlertCircle, Check } from 'lucide-vue-next';
import api from '../api';

const route = useRoute();
const router = useRouter();

const username = ref('');
const password = ref('');
const password2 = ref('');
const inviteCode = ref('');
const loading = ref(false);
const error = ref('');
const success = ref(false);

onMounted(() => {
  if (route.query.koodi) inviteCode.value = String(route.query.koodi);
});

async function register() {
  error.value = '';
  if (!username.value.trim() || !password.value || !inviteCode.value.trim()) {
    error.value = 'Täytä kaikki kentät'; return;
  }
  if (password.value !== password2.value) {
    error.value = 'Salasanat eivät täsmää'; return;
  }
  if (password.value.length < 8) {
    error.value = 'Salasanan tulee olla vähintään 8 merkkiä'; return;
  }
  loading.value = true;
  try {
    await api.post('/auth/register', {
      username: username.value.trim(),
      password: password.value,
      inviteCode: inviteCode.value.trim(),
    });
    success.value = true;
    setTimeout(() => router.push('/login'), 3000);
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Rekisteröinti epäonnistui';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <div class="flex items-center justify-center mb-6">
        <div class="flex items-center justify-center w-12 h-12 rounded-2xl
                    bg-dgreen-900/40 border border-dgreen-800/50">
          <UserPlus class="w-6 h-6 text-dgreen-400" />
        </div>
      </div>

      <h1 class="text-xl font-bold text-white text-center mb-1">Rekisteröidy</h1>
      <p class="text-xs text-gray-600 text-center mb-7">Tarvitset kutsukoodin rekisteröityäksesi</p>

      <div v-if="success"
        class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-dgreen-950/50 border border-dgreen-800/40
               text-dgreen-400 text-sm mb-4">
        <Check class="w-4 h-4 shrink-0" />
        Rekisteröinti onnistui! Odota admin-hyväksyntää. Sinut ohjataan kirjautumissivulle...
      </div>

      <form v-else @submit.prevent="register" class="space-y-3">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Kutsukoodi</label>
          <input v-model="inviteCode" type="text" placeholder="kk-xxxxxxxx"
            class="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-200
                   placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors
                   font-mono" />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Käyttäjänimi</label>
          <input v-model="username" type="text" placeholder="tunnus"
            class="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-200
                   placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Salasana</label>
          <input v-model="password" type="password" placeholder="Vähintään 8 merkkiä"
            class="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-200
                   placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Salasana uudelleen</label>
          <input v-model="password2" type="password" placeholder="Toista salasana"
            class="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-200
                   placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
        </div>

        <div v-if="error"
          class="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/50 border border-red-900/50
                 text-red-400 text-sm">
          <AlertCircle class="w-4 h-4 shrink-0" />{{ error }}
        </div>

        <button type="submit" :disabled="loading"
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                 border-0 bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-50 transition-all mt-1">
          <UserPlus class="w-4 h-4" />{{ loading ? 'Rekisteröidään...' : 'Rekisteröidy' }}
        </button>

        <p class="text-xs text-gray-700 text-center pt-1">
          Onko sinulla jo tunnus?
          <RouterLink to="/login" class="text-dgreen-600 hover:text-dgreen-400 transition-colors">
            Kirjaudu sisään
          </RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>

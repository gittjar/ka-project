<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { LogIn, Lock, User, HelpCircle, ChevronDown, Eye, EyeOff } from 'lucide-vue-next';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const showHelp = ref(false);
const showPassword = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    const redirect = (route.query.redirect as string) || (auth.isAdmin ? '/admin' : '/profiili');
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
        <p class="text-gray-600 text-sm mt-1">Kirjaudu sisään tunnuksillasi · Kanniaalio+</p>
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
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              required
              autocomplete="current-password"
              class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-black/60 border border-gray-800
                     text-white placeholder-gray-700 text-sm
                     focus:outline-none focus:border-dpurple-700 focus:ring-1 focus:ring-dpurple-800/50
                     transition-colors"
            />
            <button type="button" @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400
                     border-0 bg-transparent transition-colors">
              <Eye v-if="!showPassword" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
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

      <!-- Ei tunnuksia? -->
      <div class="mt-4">
        <button
          @click="showHelp = !showHelp"
          class="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dpurple-900/50 bg-dpurple-950/30 text-gray-500 text-sm hover:border-dpurple-800/60 hover:text-gray-400 transition-colors"
        >
          <span class="flex items-center gap-2">
            <HelpCircle class="w-4 h-4 text-dpurple-400/70" />
            Ei tunnuksia? Miten pääsen mukaan?
          </span>
          <ChevronDown
            class="w-4 h-4 transition-transform duration-200"
            :class="showHelp ? 'rotate-180' : ''"
          />
        </button>

        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="showHelp"
            class="mt-2 rounded-xl border border-dpurple-800/50 bg-dpurple-950/50 px-5 py-4 space-y-3 text-sm"
          >
            <p class="text-gray-300 font-medium">Tunnukset myönnetään kutsulla</p>
            <p class="text-gray-500 leading-relaxed">
              Kanniaalio+:aan ei voi rekisteröityä vapaasti. Jäsenyys myönnetään hallitusti
              BatMUD-pelin kautta — ota yhteyttä kiltamestareihin suoraan pelissä.
            </p>
            <div class="rounded-lg border border-dpurple-900/60 bg-black/40 px-4 py-3 space-y-1.5">
              <p class="text-dpurple-400 text-xs font-semibold uppercase tracking-wider">BatMUD-ohjeet</p>
              <p class="text-gray-400">
                Kirjaudu BatMUD:iin (<span class="text-gray-300 font-mono text-xs">telnet:bat.org 23</span>)
                ja lähetä viestiä kiltamestareille!
              </p>
            </div>
            <p class="text-gray-600 text-xs">
              Voit myös lähettää hakemuksen
              <RouterLink to="/hakemus" class="text-dpurple-400 hover:text-dpurple-300 underline underline-offset-2">hakemussivun</RouterLink>
              kautta.
            </p>
          </div>
        </Transition>
      </div>

    </div>
  </div>
</template>

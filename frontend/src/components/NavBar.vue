<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useInboxStore } from '../stores/inbox';
import api from '../api';
import { Users, BookOpen, GlassWater, Calendar, Image, FolderOpen, Search, X, ChevronRight, Loader2 } from 'lucide-vue-next';

const auth = useAuthStore();
const inbox = useInboxStore();
const router = useRouter();
const mobileOpen = ref(false);

function logout() {
  auth.logout();
  inbox.setUnread(0);
  mobileOpen.value = false;
  router.push('/login');
}

const links = [
  { to: '/', label: 'Etusivu' },
  { to: '/jasenet', label: 'Jäsenet' },
  { to: '/galleria', label: 'Kuvia', auth: true },
  { to: '/tarinat', label: 'Tarinoita', auth: true },
  { to: '/historia', label: 'Historiikki' },
  { to: '/juomat', label: 'Juomat' },
  { to: '/tapahtumat', label: 'Tapahtumat', auth: true },
  { to: '/hakemus', label: 'Hakemus' },
];

const upcomingEvents = ref(0);
async function fetchUpcoming() {
  try {
    const { data } = await api.get('/events/upcoming');
    upcomingEvents.value = data.count ?? 0;
  } catch {}
}

// Poll unread reply count for non-admin logged-in users
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchUnread() {
  if (!auth.isLoggedIn || auth.isAdmin) return;
  try {
    const { data } = await api.get('/messages/mine');
    inbox.setUnread(data.filter((m: any) => !m.repliesRead && m.replies?.length > 0).length);
  } catch {}
}

// ── Haku ──────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: string;
  id: string;
  title: string;
  snippet: string;
  url: string;
  meta?: string | null;
  avatar?: string | null;
  imageUrl?: string | null;
}

const TYPE_ICON_COMPONENTS: Record<string, unknown> = {
  'jäsen':     Users,
  'tarina':    BookOpen,
  'juoma':     GlassWater,
  'tapahtuma': Calendar,
  'kansio':    FolderOpen,
  'kuva':      Image,
};
const TYPE_COLORS: Record<string, string> = {
  'jäsen':     'text-dgreen-400',
  'tarina':    'text-dpurple-400',
  'juoma':     'text-yellow-400',
  'tapahtuma': 'text-blue-400',
  'kansio':    'text-orange-400',
  'kuva':      'text-pink-400',
};

const searchOpen  = ref(false);
const searchQuery = ref('');
const searchResults = ref<SearchResult[]>([]);
const searchLoading = ref(false);
const activeIdx = ref(-1);
const searchInputRef = ref<HTMLInputElement | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function openSearch() {
  searchOpen.value = true;
  nextTick(() => searchInputRef.value?.focus());
}

function closeSearch() {
  searchOpen.value = false;
  searchQuery.value = '';
  searchResults.value = [];
  activeIdx.value = -1;
}

watch(searchQuery, (q) => {
  activeIdx.value = -1;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q.trim() || q.trim().length < 2) { searchResults.value = []; searchLoading.value = false; return; }
  searchLoading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/search', { params: { q: q.trim() } });
      searchResults.value = data;
    } catch {
      searchResults.value = [];
    } finally {
      searchLoading.value = false;
    }
  }, 320);
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { closeSearch(); return; }
  if (!searchResults.value.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIdx.value = Math.min(activeIdx.value + 1, searchResults.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIdx.value = Math.max(activeIdx.value - 1, -1);
  } else if (e.key === 'Enter' && activeIdx.value >= 0) {
    e.preventDefault();
    const r = searchResults.value[activeIdx.value]; if (r) navigateTo(r);
  }
}

function navigateTo(result: SearchResult) {
  router.push(result.url);
  closeSearch();
}

// Sulje klikkaamalla ulkopuolelle
function onClickOutside(e: MouseEvent) {
  const el = document.getElementById('search-container');
  if (el && !el.contains(e.target as Node)) closeSearch();
}

// Highlight hakusana boldilla
function highlight(text: string, q: string): string {
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<strong class="text-white">$1</strong>');
}

onMounted(() => {
  fetchUnread();
  fetchUpcoming();
  pollTimer = setInterval(() => { fetchUnread(); fetchUpcoming(); }, 60_000);
  document.addEventListener('mousedown', onClickOutside);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  document.removeEventListener('mousedown', onClickOutside);
});
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
            v-for="l in links.filter(l => !l.auth || auth.isLoggedIn)"
            :key="l.to"
            :to="l.to"
            class="px-3 py-1.5 rounded-xl text-sm text-gray-400
                   hover:text-green-300 hover:bg-dgreen-900/60 transition-all duration-150"
            :class="l.to === '/tapahtumat' && upcomingEvents > 0
              ? 'text-dgreen-400 bg-dgreen-900/20' : ''"
            active-class="!text-dpurple-400 bg-dpurple-900/50"
            exact-active-class="!text-dpurple-400 bg-dpurple-900/50"
          >
            {{ l.label }}
            <span v-if="l.to === '/tapahtumat' && upcomingEvents > 0"
              class="inline-flex items-center justify-center ml-0.5
                     w-4 h-4 rounded-full bg-dgreen-700/80 text-white text-[10px] font-bold">
              {{ upcomingEvents > 9 ? '9+' : upcomingEvents }}
            </span>
          </RouterLink>
          <RouterLink v-if="auth.isAdmin" to="/admin"
            class="ml-2 px-3 py-1.5 rounded-xl text-sm text-yellow-400
                   hover:bg-yellow-900/20 transition-all">
            Admin
          </RouterLink>
          <RouterLink v-else-if="auth.isLoggedIn" to="/profiili"
            class="ml-2 relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-dgreen-400
                   hover:bg-dgreen-900/20 transition-all">
            {{ auth.username }}
            <span v-if="inbox.unreadReplies > 0"
              class="inline-flex items-center justify-center w-4 h-4 rounded-full
                     bg-dgreen-600 text-white text-[10px] font-bold leading-none">
              {{ inbox.unreadReplies > 9 ? '9+' : inbox.unreadReplies }}
            </span>
          </RouterLink>
          <button v-if="auth.isLoggedIn" @click="logout()"
            class="ml-3 text-xs text-gray-500 hover:text-red-400 transition-colors border-0 bg-transparent p-0">
            Kirjaudu ulos
          </button>
          <template v-else>
            <RouterLink to="/rekisteroidy"
              class="ml-3 px-3 py-1.5 rounded-xl text-sm text-gray-400
                     hover:text-gray-200 transition-all">
              Rekisteröidy
            </RouterLink>
            <RouterLink to="/login"
              class="ml-1 px-3 py-1.5 rounded-xl text-sm font-medium text-dpurple-400 border border-dpurple-800/50
                     hover:bg-dpurple-900/40 hover:border-dpurple-600/60 transition-all">
              Kirjaudu
            </RouterLink>
          </template>

          <!-- Hakupainike (vain kirjautuneille) -->
          <button v-if="auth.isLoggedIn"
            @click="openSearch"
            class="ml-2 p-1.5 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-800/60
                   transition-all border-0 bg-transparent"
            title="Haku (/)">
            <Search class="w-4 h-4" />
          </button>
        </div>

        <!-- Mobile hamburger -->
        <div class="md:hidden flex items-center gap-2">
          <!-- Hakupainike mobiilissa -->
          <button v-if="auth.isLoggedIn"
            @click="openSearch"
            class="p-1.5 text-gray-400 hover:text-gray-200 border-0 bg-transparent">
            <Search class="w-4 h-4" />
          </button>
          <button class="text-gray-400 hover:text-green-300 transition-colors border-0 bg-transparent"
            @click="mobileOpen = !mobileOpen">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <div v-if="mobileOpen"
        class="md:hidden border-t border-green-900/40 px-3 py-2 flex flex-col gap-0.5 rounded-b-2xl">
        <RouterLink
          v-for="l in links.filter(l => !l.auth || auth.isLoggedIn)"
          :key="l.to"
          :to="l.to"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-400
                 hover:text-green-300 hover:bg-dgreen-900/50 transition-all"
          :class="l.to === '/tapahtumat' && upcomingEvents > 0
            ? 'text-dgreen-400 bg-dgreen-900/20' : ''"
          active-class="!text-dpurple-400 bg-dpurple-900/40"
          @click="mobileOpen = false"
        >
          {{ l.label }}
          <span v-if="l.to === '/tapahtumat' && upcomingEvents > 0"
            class="inline-flex items-center justify-center
                   w-4 h-4 rounded-full bg-dgreen-700/80 text-white text-[10px] font-bold">
            {{ upcomingEvents > 9 ? '9+' : upcomingEvents }}
          </span>
        </RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin"
          class="block px-3 py-2 rounded-xl text-sm text-yellow-400
                 hover:bg-yellow-900/20 transition-all"
          active-class="bg-yellow-900/20"
          @click="mobileOpen = false">
          Admin
        </RouterLink>
        <RouterLink v-else-if="auth.isLoggedIn" to="/profiili"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-dgreen-400
                 hover:bg-dgreen-900/20 transition-all"
          active-class="bg-dgreen-900/20"
          @click="mobileOpen = false">
          {{ auth.username }}
          <span v-if="inbox.unreadReplies > 0"
            class="inline-flex items-center justify-center w-4 h-4 rounded-full
                   bg-dgreen-600 text-white text-[10px] font-bold leading-none">
            {{ inbox.unreadReplies > 9 ? '9+' : inbox.unreadReplies }}
          </span>
        </RouterLink>
        <button v-if="auth.isLoggedIn" @click="logout()"
          class="block px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-400
                 transition-all border-0 bg-transparent text-left">
          Kirjaudu ulos
        </button>
        <template v-else>
          <RouterLink to="/rekisteroidy"
            class="block px-3 py-2 rounded-xl text-sm text-gray-500
                   hover:text-gray-300 transition-all"
            @click="mobileOpen = false">
            Rekisteröidy
          </RouterLink>
          <RouterLink to="/login"
            class="block px-3 py-2 rounded-xl text-sm font-medium text-dpurple-400
                   hover:bg-dpurple-900/40 transition-all"
            @click="mobileOpen = false">
            Kirjaudu
          </RouterLink>
        </template>
      </div>
    </nav>
  </div>

  <!-- ── Hakumodaali ── -->
  <Teleport to="body">
    <Transition name="search-fade">
      <div v-if="searchOpen"
        class="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex flex-col items-center pt-[10vh] px-4"
        @mousedown.self="closeSearch">

        <div id="search-container" class="w-full max-w-2xl">

          <!-- Hakukenttä -->
          <div class="flex items-center gap-3 px-4 py-3 rounded-2xl
                      bg-gray-950 border border-gray-700
                      shadow-2xl">
            <Search class="w-5 h-5 text-gray-500 shrink-0" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              @keydown="onKeydown"
              type="text"
              placeholder="Hae jäsenistä, tarinoista, juomista, tapahtumista…"
              class="flex-1 bg-transparent text-white placeholder-gray-600 text-base outline-none border-0"
              autocomplete="off"
            />
            <Loader2 v-if="searchLoading" class="w-4 h-4 text-dpurple-400 animate-spin shrink-0" />
            <button v-else @click="closeSearch"
              class="text-gray-600 hover:text-gray-300 border-0 bg-transparent p-0 shrink-0">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Tulokset -->
          <div v-if="searchResults.length"
            class="mt-2 rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl overflow-hidden">

            <!-- Ryhmitellään tyypin mukaan -->
            <template v-for="type in ['jäsen','tarina','juoma','tapahtuma','kansio','kuva']" :key="type">
              <template v-if="searchResults.filter(r => r.type === type).length">
                <!-- Kategorian otsikko -->
                <div class="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest
                            text-gray-600 bg-gray-900/60 border-b border-gray-800/50 flex items-center gap-1.5">
                  <component :is="TYPE_ICON_COMPONENTS[type]" class="w-3 h-3" />
                  {{ type }}t
                </div>
                <!-- Tulokset -->
                <button
                  v-for="result in searchResults.filter(r => r.type === type)"
                  :key="result.id"
                  @click="navigateTo(result)"
                  @mouseenter="activeIdx = searchResults.indexOf(result)"
                  class="w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-800/40
                         last:border-0 transition-colors duration-100 border-x-0"
                  :class="activeIdx === searchResults.indexOf(result)
                    ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'"
                >
                  <!-- Avatar tai kuvapreview tai tyyppi-ikoni -->
                  <div class="shrink-0 mt-0.5">
                    <img v-if="result.avatar" :src="result.avatar"
                      class="w-8 h-8 rounded-full object-cover border border-gray-700" />
                    <img v-else-if="result.imageUrl" :src="result.imageUrl"
                      class="w-8 h-8 rounded object-cover border border-gray-700" />
                    <component v-else :is="TYPE_ICON_COMPONENTS[result.type]"
                      class="w-5 h-5 mt-0.5" :class="TYPE_COLORS[result.type]" />
                  </div>
                  <!-- Teksti -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="font-semibold text-white text-sm truncate"
                        v-html="highlight(result.title, searchQuery)"></span>
                      <span v-if="result.meta"
                        class="text-[11px] text-gray-600 shrink-0">{{ result.meta }}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed"
                      v-html="highlight(result.snippet, searchQuery)"></p>
                  </div>
                  <!-- Nuoli -->
                  <ChevronRight class="w-4 h-4 text-gray-700 shrink-0 mt-1" />
                </button>
              </template>
            </template>
          </div>

          <!-- Ei tuloksia -->
          <div v-else-if="searchQuery.trim().length >= 2 && !searchLoading"
            class="mt-2 px-5 py-6 rounded-2xl bg-gray-950 border border-gray-800 text-center">
            <p class="text-gray-500 text-sm">Ei tuloksia haulle <span class="text-gray-300">"{{ searchQuery }}"</span></p>
          </div>

          <!-- Ohje -->
          <div class="mt-2 flex items-center gap-3 px-1 text-[11px] text-gray-700">
            <span>↑↓ navigoi</span>
            <span>↵ avaa</span>
            <span>Esc sulkee</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-fade-enter-active, .search-fade-leave-active {
  transition: opacity 0.2s ease;
}
.search-fade-enter-from, .search-fade-leave-to {
  opacity: 0;
}
</style>

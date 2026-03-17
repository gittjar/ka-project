<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import {
  Search, ArrowUpDown,
  MapPin, GlassWater, Flame, Cake, Star, Globe, Mail, Hash,
  ChevronLeft, ChevronRight,
} from 'lucide-vue-next';
import api from '../api';

interface MemberPhoto { _id: string; url: string; mediaType: 'image' | 'video'; }
interface Member {
  _id: string;
  name: string;
  aliases: string[];
  quote: string;
  born: string;
  highestPromille: string;
  favDrink: string;
  location: string;
  email: string;
  website: string;
  avatarUrl: string;
  points: number;
  photos: MemberPhoto[];
}

const members = ref<Member[]>([]);
const search = ref('');
const sortKey = ref<'name' | 'location' | 'points'>('name');
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get('/members');
    members.value = data;
    for (const m of data) { slideIdx[m._id] = 0; startSlideTimer(m._id); }
  } finally {
    loading.value = false;
  }
});
onUnmounted(() => { for (const id of Object.keys(slideTimers)) clearTimeout(slideTimers[id]); });

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  let result = members.value.filter(m =>
    !q ||
    m.name.toLowerCase().includes(q) ||
    (m.location || '').toLowerCase().includes(q) ||
    m.aliases.some(a => a.toLowerCase().includes(q)) ||
    (m.quote || '').toLowerCase().includes(q)
  );
  if (sortKey.value === 'name')     result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  if (sortKey.value === 'location') result = [...result].sort((a, b) => (a.location || '').localeCompare(b.location || '', 'fi'));
  if (sortKey.value === 'points')   result = [...result].sort((a, b) => (b.points || 0) - (a.points || 0));
  return result;
});

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_BASE = 'https://digital.pictures.fi/kuvat/k%C3%A4/members-collection/';
const TRIPOD_RE = /kanniaalio\.tripod\.com\/members\/([^?#]+)/i;
function avatarSrc(url: string): string {
  if (!url) return '';
  const tripodMatch = url.match(TRIPOD_RE);
  if (tripodMatch) return `${AVATAR_BASE}${tripodMatch[1]}/_full.jpg`;
  if (!url.startsWith('http')) return `${AVATAR_BASE}${url}/_full.jpg`;
  return url;
}

// ── Slideshow per member ───────────────────────────────────────────────
const slideIdx = reactive<Record<string, number>>({});
const slideTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function getSlides(m: Member): Array<{ url: string; mediaType: 'image' | 'video' }> {
  const slides: Array<{ url: string; mediaType: 'image' | 'video' }> = [];
  const av = avatarSrc(m.avatarUrl);
  if (av) slides.push({ url: av, mediaType: 'image' });
  for (const p of m.photos ?? []) slides.push({ url: avatarSrc(p.url), mediaType: p.mediaType });
  return slides;
}
function curSlideIdx(id: string) { return slideIdx[id] ?? 0; }
function startSlideTimer(memberId: string) {
  clearTimeout(slideTimers[memberId]);
  const m = members.value.find(x => x._id === memberId);
  if (!m) return;
  const slides = getSlides(m);
  if (slides.length <= 1) return;
  if (slides[slideIdx[memberId] ?? 0]?.mediaType !== 'video') {
    slideTimers[memberId] = setTimeout(() => {
      const m2 = members.value.find(x => x._id === memberId);
      if (!m2) return;
      const slides2 = getSlides(m2);
      slideIdx[memberId] = ((slideIdx[memberId] ?? 0) + 1) % slides2.length;
      startSlideTimer(memberId);
    }, 6000);
  }
}
function nextSlide(m: Member) {
  const slides = getSlides(m);
  if (slides.length <= 1) return;
  slideIdx[m._id] = ((slideIdx[m._id] ?? 0) + 1) % slides.length;
  startSlideTimer(m._id);
}
function prevSlide(m: Member) {
  const slides = getSlides(m);
  if (slides.length <= 1) return;
  slideIdx[m._id] = ((slideIdx[m._id] ?? 0) - 1 + slides.length) % slides.length;
  startSlideTimer(m._id);
}
function goSlide(m: Member, idx: number) {
  slideIdx[m._id] = idx;
  startSlideTimer(m._id);
}
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">

    <!-- Otsikko -->
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold text-white mb-1">Jäsenet</h1>
      <p class="text-gray-600 text-sm">{{ members.length }} jäsentä rekisterissä</p>
    </div>

    <!-- Hakupalkki + lajittelu -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
        <input
          v-model="search" type="text"
          placeholder="Hae nimellä, aliaksella, quotella tai paikkakunnalla..."
          class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/60 border border-gray-800
                 text-gray-200 placeholder-gray-700 text-sm
                 focus:outline-none focus:border-dgreen-700 transition-colors"
        />
      </div>
      <div class="relative shrink-0">
        <select v-model="sortKey"
          class="appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-black/60 border border-gray-800
                 text-gray-400 text-sm focus:outline-none focus:border-dgreen-700 cursor-pointer">
          <option value="name">A–Z</option>
          <option value="location">Paikkakunta</option>
          <option value="points">Pisteet</option>
        </select>
        <ArrowUpDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
      </div>
    </div>

    <!-- Ladataan -->
    <div v-if="loading" class="text-gray-600 py-20 text-center text-sm">Ladataan jäseniä...</div>

    <!-- Ei tuloksia -->
    <div v-else-if="filtered.length === 0" class="text-gray-600 italic py-20 text-center text-sm">
      Ei tuloksia haulla "{{ search }}"
    </div>

    <!-- Kortit -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="m in filtered" :key="m._id"
        class="flex flex-col sm:flex-row sm:h-48 overflow-hidden rounded-2xl bg-gray-950
               border border-gray-800 hover:border-dgreen-900/60 hover:bg-dgreen-950/20
               transition-all duration-150"
      >
        <!-- Avatar / Slideshow -->
        <div class="relative sm:flex-shrink-0 sm:w-44
                    h-44 sm:h-full
                    bg-dpurple-900/40 sm:border-r sm:border-b-0 border-b border-dpurple-800/20
                    flex items-center justify-center overflow-hidden select-none"
             @contextmenu.prevent>

          <!-- Current slide -->
          <template v-if="getSlides(m).length">
            <img v-if="getSlides(m)[curSlideIdx(m._id)]?.mediaType !== 'video'"
                 :key="'img-' + m._id + '-' + curSlideIdx(m._id)"
                 :src="getSlides(m)[curSlideIdx(m._id)]!.url"
                 :alt="m.name" draggable="false"
                 class="w-full h-full object-cover object-top" />
            <video v-else
                   :key="'vid-' + m._id + '-' + curSlideIdx(m._id)"
                   :src="getSlides(m)[curSlideIdx(m._id)]!.url"
                   autoplay muted playsinline
                   :loop="getSlides(m).length <= 1"
                   @ended="nextSlide(m)"
                   class="w-full h-full object-cover" />
          </template>
          <span v-else class="text-5xl sm:text-3xl font-bold text-dpurple-400/30">
            {{ initials(m.name) }}
          </span>

          <!-- Arrows + dots (only if >1 slide) -->
          <template v-if="getSlides(m).length > 1">
            <button @click.stop="prevSlide(m)"
              class="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full
                     bg-black/40 hover:bg-black/70 text-white border-0 transition-all">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button @click.stop="nextSlide(m)"
              class="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full
                     bg-black/40 hover:bg-black/70 text-white border-0 transition-all">
              <ChevronRight class="w-4 h-4" />
            </button>
            <div class="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex gap-1 pointer-events-none">
              <button v-for="(_, i) in getSlides(m)" :key="i"
                @click.stop="goSlide(m, i)"
                class="rounded-full border-0 transition-all duration-200 pointer-events-auto"
                :class="i === curSlideIdx(m._id)
                  ? 'w-3.5 h-1.5 bg-white'
                  : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'" />
            </div>
          </template>

          <!-- Pisteet-badge kuvan päälle mobiilissa -->
          <div v-if="m.points"
            class="absolute top-3 right-3 sm:hidden flex items-center gap-1 text-xs font-semibold
                   text-dgreen-400 bg-gray-950/80 border border-dgreen-900/50
                   px-2 py-0.5 rounded-full backdrop-blur-sm z-20">
            <Star class="w-3 h-3" />{{ m.points }}p
          </div>
        </div>

        <!-- Sisältö -->
        <div class="flex-1 min-w-0 p-3 sm:p-5 flex flex-col gap-2 sm:gap-3">

          <!-- Ylärivi: nimi + pisteet (desktop) -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-base sm:text-xl font-bold text-white leading-snug">{{ m.name }}</h2>
              <!-- Aliakset -->
              <div v-if="m.aliases.length" class="flex flex-wrap gap-1.5 mt-1.5">
                <span v-for="a in m.aliases" :key="a"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                         bg-dpurple-900/40 border border-dpurple-800/30 text-dpurple-400/80">
                  <Hash class="w-2.5 h-2.5" />{{ a }}
                </span>
              </div>
            </div>
            <div v-if="m.points"
              class="hidden sm:flex shrink-0 items-center gap-1 text-xs font-semibold
                     text-dgreen-400 bg-dgreen-950/40 border border-dgreen-900/40
                     px-2 py-0.5 rounded-full">
              <Star class="w-3 h-3" />{{ m.points }}p
            </div>
          </div>

          <!-- Quote -->
          <p v-if="m.quote" class="text-xs sm:text-sm italic text-dpurple-400/70 leading-relaxed line-clamp-2">
            "{{ m.quote }}"
          </p>

          <!-- Meta-tiedot -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500">
            <span v-if="m.born" class="flex items-center gap-1.5 truncate">
              <Cake class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.born }}
            </span>
            <span v-if="m.location" class="flex items-center gap-1.5 truncate">
              <MapPin class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.location }}
            </span>
            <span v-if="m.favDrink" class="flex items-center gap-1.5 truncate">
              <GlassWater class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.favDrink }}
            </span>
            <span v-if="m.highestPromille" class="flex items-center gap-1.5 truncate">
              <Flame class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.highestPromille }}
            </span>
            <a v-if="m.website && m.website.startsWith('http')"
              :href="m.website" target="_blank" rel="noopener noreferrer"
              class="flex items-center gap-1.5 hover:text-dgreen-400 transition-colors truncate">
              <Globe class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.website.replace(/^https?:\/\//, '') }}
            </a>
            <span v-if="m.email" class="flex items-center gap-1.5 truncate">
              <Mail class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.email }}
            </span>
          </div>

        </div>
      </div>
    </div>

    <!-- Laskuri -->
    <p v-if="!loading && filtered.length > 0" class="text-xs text-gray-700 mt-8 text-center">
      {{ filtered.length }} / {{ members.length }} jäsentä
    </p>

  </div>
</template>

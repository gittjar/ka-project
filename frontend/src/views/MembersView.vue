<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import {
  Search, ArrowUpDown,
  MapPin, GlassWater, Flame, Cake, Star, Globe, Mail, Hash,
} from 'lucide-vue-next';
import api from '../api';

interface MemberPhoto { _id: string; url: string; mediaType: 'image' | 'video'; }
interface Deceased { year: number | null; note: string; }
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
  deceased?: Deceased | null;
}

const members = ref<Member[]>([]);
const search = ref('');
const sortKey = ref<'name' | 'location' | 'points'>('name');
const deceasedFilter = ref<'all' | 'alive' | 'memorial'>('all');
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
  let result = members.value.filter(m => {
    if (deceasedFilter.value === 'alive' && m.deceased?.year) return false;
    if (deceasedFilter.value === 'memorial' && !m.deceased?.year) return false;
    return !q ||
      m.name.toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q) ||
      m.aliases.some(a => a.toLowerCase().includes(q)) ||
      (m.quote || '').toLowerCase().includes(q);
  });
  if (sortKey.value === 'name')     result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  if (sortKey.value === 'location') result = [...result].sort((a, b) => (a.location || '').localeCompare(b.location || '', 'fi'));
  if (sortKey.value === 'points')   result = [...result].sort((a, b) => (b.points || 0) - (a.points || 0));
  return result;
});

const memorialCount = computed(() => members.value.filter(m => m.deceased?.year).length);

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

const brokenSlides = reactive<Record<string, boolean>>({});
function onSlideImgError(m: Member) {
  const key = m._id + '-' + (slideIdx[m._id] ?? 0);
  brokenSlides[key] = true;
  const slides = getSlides(m);
  if (slides.length > 1) nextSlide(m);
}

</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">

    <!-- Otsikko -->
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold text-white mb-1">Jäsenet</h1>
      <p class="text-gray-400 text-sm">{{ members.length }} jäsentä rekisterissä</p>
    </div>

    <!-- Hakupalkki + lajittelu -->
    <div class="flex flex-col sm:flex-row gap-3 mb-3">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
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
        <ArrowUpDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      </div>
    </div>

    <!-- Deceased filter -->
    <div v-if="memorialCount > 0" class="flex gap-2 mb-6">
      <button
        v-for="opt in ([['all', 'Kaikki'], ['alive', 'Elossa'], ['memorial', '✦ Muistomerkki']] as const)"
        :key="opt[0]"
        @click="deceasedFilter = opt[0]"
        class="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
        :class="deceasedFilter === opt[0]
          ? (opt[0] === 'memorial'
              ? 'bg-amber-900/40 border-amber-700/50 text-amber-300'
              : 'bg-dpurple-900/40 border-dpurple-700/50 text-dpurple-300')
          : 'bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-400'">
        {{ opt[1] }}
        <span v-if="opt[0] === 'memorial'" class="ml-1 opacity-70">({{ memorialCount }})</span>
      </button>
    </div>

    <!-- Ladataan -->
    <div v-if="loading" class="text-gray-400 py-20 text-center text-sm">Ladataan jäseniä...</div>

    <!-- Ei tuloksia -->
    <div v-else-if="filtered.length === 0" class="text-gray-400 italic py-20 text-center text-sm">
      Ei tuloksia haulla "{{ search }}"
    </div>

    <!-- Kortit -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="m in filtered" :key="m._id"
        class="flex flex-col sm:flex-row sm:h-48 overflow-hidden rounded-2xl bg-gray-950
               border transition-all duration-150"
        :class="m.deceased?.year
          ? 'border-amber-900/40 hover:border-amber-800/60'
          : 'border-gray-800 hover:border-dgreen-900/60 hover:bg-dgreen-950/20'"
      >
        <!-- Avatar / Slideshow -->
        <div class="relative sm:flex-shrink-0 sm:w-44
                    h-44 sm:h-full
                    bg-dpurple-900/40 sm:border-r sm:border-b-0 border-b border-dpurple-800/20
                    flex items-center justify-center select-none"
             @contextmenu.prevent>

          <!-- Image clip wrapper -->
          <div class="absolute inset-0 overflow-hidden rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl rounded-br-none sm:rounded-tr-none sm:rounded-bl-2xl">
            <!-- Current slide -->
            <template v-if="getSlides(m).length">
              <template v-if="getSlides(m)[curSlideIdx(m._id)]?.mediaType !== 'video'">
                <!-- Broken image fallback -->
                <span v-if="brokenSlides[m._id + '-' + curSlideIdx(m._id)]"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-2
                         text-dpurple-400/40 bg-dpurple-950/30">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3l18 18M9.75 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="text-[11px] text-dpurple-400/50 font-medium">{{ initials(m.name) }}</span>
                </span>
                <img v-else
                     :key="'img-' + m._id + '-' + curSlideIdx(m._id)"
                     :src="getSlides(m)[curSlideIdx(m._id)]!.url"
                     :alt="m.name" draggable="false"
                     class="w-full h-full object-cover object-top"
                     @error="onSlideImgError(m)" />
              </template>
              <video v-else
                     :key="'vid-' + m._id + '-' + curSlideIdx(m._id)"
                     :src="getSlides(m)[curSlideIdx(m._id)]!.url"
                     autoplay muted playsinline
                     :loop="getSlides(m).length <= 1"
                     @ended="nextSlide(m)"
                     class="w-full h-full object-cover" />
            </template>
            <span v-else class="absolute inset-0 flex items-center justify-center text-5xl sm:text-3xl font-bold text-dpurple-400/30">
              {{ initials(m.name) }}
            </span>
          </div>

          <!-- Arrows — outside overflow-hidden, so not clipped -->
          <template v-if="getSlides(m).length > 1">
            <div class="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-1"
                 style="background:rgba(0,0,0,0.55)">
              <button @click.stop="prevSlide(m)"
                class="w-7 h-7 rounded-full flex items-center justify-center border-0 transition-colors select-none"
                style="background:rgba(20,0,40,0.85);color:#d1d5db;font-size:16px;line-height:1">
                &#8249;
              </button>
              <button @click.stop="nextSlide(m)"
                class="w-7 h-7 rounded-full flex items-center justify-center border-0 transition-colors select-none"
                style="background:rgba(20,0,40,0.85);color:#d1d5db;font-size:16px;line-height:1">
                &#8250;
              </button>
            </div>
          </template>

          <!-- Pisteet-badge kuvan päälle mobiilissa -->
          <div v-if="m.points && !m.deceased?.year"
            class="absolute top-3 right-3 sm:hidden flex items-center gap-1 text-xs font-semibold
                   text-dgreen-400 bg-gray-950/80 border border-dgreen-900/50
                   px-2 py-0.5 rounded-full backdrop-blur-sm z-20">
            <Star class="w-3 h-3" />{{ m.points }}p
          </div>
          <!-- In memoriam overlay on avatar -->
          <div v-if="m.deceased?.year"
            class="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center
                   py-1.5 gap-1.5"
            style="background:linear-gradient(to top,rgba(0,0,0,0.85) 60%,transparent)">
            <span class="text-amber-300 text-xs font-semibold tracking-wide">
              ✦ {{ m.deceased.year }}
            </span>
          </div>
        </div>

        <!-- Sisältö -->
        <div class="flex-1 min-w-0 p-3 sm:p-5 flex flex-col gap-2 sm:gap-3">

          <!-- Ylärivi: nimi + pisteet (desktop) -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-base sm:text-xl font-bold leading-snug"
                :class="m.deceased?.year ? 'text-amber-100' : 'text-white'">{{ m.name }}</h2>
              <!-- In memoriam badge -->
              <div v-if="m.deceased?.year" class="flex flex-col gap-1 mt-1">
                <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full self-start
                             bg-amber-900/40 border border-amber-700/40 text-amber-300 font-medium">
                  ✦ In memoriam {{ m.deceased.year }}
                </span>
                <p v-if="m.deceased.note" class="text-xs text-amber-200/60 italic px-0.5">
                  {{ m.deceased.note }}
                </p>
              </div>
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
          <p v-if="m.quote" class="text-xs sm:text-sm italic text-dpurple-400/90 leading-relaxed sm:line-clamp-2">
            "{{ m.quote }}"
          </p>

          <!-- Meta-tiedot -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-400">
            <span v-if="m.born" class="flex items-center gap-1.5 sm:truncate">
              <Cake class="w-3.5 h-3.5 text-gray-500 shrink-0" />{{ m.born }}
            </span>
            <span v-if="m.location" class="flex items-center gap-1.5 sm:truncate">
              <MapPin class="w-3.5 h-3.5 text-gray-500 shrink-0" />{{ m.location }}
            </span>
            <span v-if="m.favDrink" class="flex items-center gap-1.5 sm:truncate">
              <GlassWater class="w-3.5 h-3.5 text-gray-500 shrink-0" />{{ m.favDrink }}
            </span>
            <span v-if="m.highestPromille" class="flex items-center gap-1.5 sm:truncate">
              <Flame class="w-3.5 h-3.5 text-gray-500 shrink-0" />{{ m.highestPromille }}
            </span>
            <a v-if="m.website && m.website.startsWith('http')"
              :href="m.website" target="_blank" rel="noopener noreferrer"
              class="flex items-center gap-1.5 hover:text-dgreen-400 transition-colors sm:truncate">
              <Globe class="w-3.5 h-3.5 text-gray-500 shrink-0" />{{ m.website.replace(/^https?:\/\//, '') }}
            </a>
            <span v-if="m.email" class="flex items-center gap-1.5 sm:truncate">
              <Mail class="w-3.5 h-3.5 text-gray-500 shrink-0" />{{ m.email }}
            </span>
          </div>

        </div>
      </div>
    </div>

    <!-- Laskuri -->
    <p v-if="!loading && filtered.length > 0" class="text-xs text-gray-500 mt-8 text-center">
      {{ filtered.length }} / {{ members.length }} jäsentä
    </p>

  </div>
</template>

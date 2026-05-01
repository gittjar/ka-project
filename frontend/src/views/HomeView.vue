<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { Users, Camera, BookOpen, ScrollText, GlassWater, ClipboardList } from 'lucide-vue-next';
import api from '../api';

interface CarouselItem {
  _id: string;
  url: string;
  mediaType: 'image' | 'video';
  caption?: string;
}

const nav = [
  { to: '/jasenet',  label: 'Jäsenet',    icon: Users,         desc: 'Tutki seuran jäseniä' },
  { to: '/galleria',    label: 'Kuvia',       icon: Camera,        desc: 'Galleria vuosien varrelta' },
  { to: '/tarinat',  label: 'Tarinoita',   icon: BookOpen,      desc: 'Jäsenten kertomuksia' },
  { to: '/historia', label: 'Historiikki', icon: ScrollText,    desc: 'Seuran historia vuodesta 2003' },
  { to: '/juomat',   label: 'Juomat',      icon: GlassWater,    desc: 'Reseptit ja drinkkilista' },
  { to: '/hakemus',  label: 'Hakemus',     icon: ClipboardList, desc: 'Liity seuran jäseneksi' },
];

// ── Carousel ──────────────────────────────────────────────────────────────────

const carouselItems = ref<CarouselItem[]>([]);
const activeIdx = ref(0);
const transitioning = ref(false);
let autoTimer: ReturnType<typeof setInterval> | null = null;

const timerProgress = ref(100);
let timerTick: ReturnType<typeof setInterval> | null = null;
const AUTO_MS = 6000;
const TICK_MS = 50;

function startTimerTick() {
  if (timerTick) clearInterval(timerTick);
  timerProgress.value = 100;
  timerTick = setInterval(() => {
    timerProgress.value = Math.max(0, timerProgress.value - (100 * TICK_MS / AUTO_MS));
  }, TICK_MS);
}
function stopTimerTick() {
  if (timerTick) { clearInterval(timerTick); timerTick = null; }
  timerProgress.value = 100;
}

const activeItem = computed(() => carouselItems.value[activeIdx.value] ?? null);
const hasCarousel = computed(() => carouselItems.value.length > 0);

// Ref-taulukko kaikille video-elementeille (v-for täyttää tämän automaattisesti)
const videoRefs = ref<(HTMLVideoElement | null)[]>([]);

async function loadCarousel() {
  try {
    const { data } = await api.get('/images/carousel');
    carouselItems.value = data;
    preloadAll();
  } catch { /* näytetään normaali hero ilman carousel-kuvia */ }
}

function preloadAll() {
  const items = carouselItems.value;
  items.forEach((item, i) => {
    if (item.mediaType !== 'image') return;
    const delay = i === 0 ? 0 : i === 1 ? 400 : 400 + (i - 1) * 800;
    setTimeout(() => {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = item.url;
    }, delay);
  });
}

function playVideoAt(idx: number) {
  const v = videoRefs.value[idx];
  if (!v) return;
  v.currentTime = 0;
  v.play().catch(() => {});
}
function pauseVideoAt(idx: number) {
  const v = videoRefs.value[idx];
  if (v && !v.paused) { v.pause(); v.currentTime = 0; }
}

function goTo(idx: number) {
  if (transitioning.value || idx === activeIdx.value) return;
  transitioning.value = true;
  setTimeout(() => {
    activeIdx.value = idx;
    transitioning.value = false;
  }, 400);
}

function next() { goTo((activeIdx.value + 1) % carouselItems.value.length); }
function prev() { goTo((activeIdx.value - 1 + carouselItems.value.length) % carouselItems.value.length); }

function startAuto() {
  stopAuto();
  if (carouselItems.value.length <= 1) return;
  // Käytä suoraa taulukkoa — computed voi olla stale watch-kutsuhetkellä
  const current = carouselItems.value[activeIdx.value];
  if (!current || current.mediaType === 'video') return;
  autoTimer = setInterval(next, AUTO_MS);
  startTimerTick();
}
function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  stopTimerTick();
}
function onVideoEnded() {
  if (carouselItems.value.length > 1) next();
}

// Watch: soita oikeaa videota kun aktiivinen slide vaihtuu.
// Koska kaikki videot ovat DOM:issa (v-for), .play() toimii
// luotettavasti myös iOS Safarilla — elementti ei tule DOM:iin myöhässä.
watch(activeIdx, (newIdx, oldIdx) => {
  startAuto();
  // Pysäytä edellinen video
  if (oldIdx !== undefined) pauseVideoAt(oldIdx);
  // Käynnistä uusi video jos slide on video
  const current = carouselItems.value[newIdx];
  if (current?.mediaType === 'video') {
    nextTick(() => playVideoAt(newIdx));
  }
}, { flush: 'post' });

// ── Touch swipe ───────────────────────────────────────────────────────────────
let touchStartX = 0;
function onTouchStart(e: TouchEvent) { touchStartX = e.touches[0]?.clientX ?? 0; }
function onTouchEnd(e: TouchEvent) {
  const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
  if (Math.abs(dx) > 40) {
    if (dx < 0) { next(); stopAuto(); startAuto(); }
    else { prev(); stopAuto(); startAuto(); }
  }
}

// ── Storage badge ─────────────────────────────────────────────────────

const blobBytes = ref<number | null>(null);
const imageCount = ref<number | null>(null);
const videoCount = ref<number | null>(null);
const memberCount = ref<number | null>(null);
const memberList = ref<{ _id: string; name: string }[]>([]);
const VIP_NAMES = ['Caitline', 'Fimir'];
function isVip(name: string): boolean {
  return VIP_NAMES.some(v => name.toLowerCase().includes(v.toLowerCase()));
}
function getMemberPillClass(_id: string): string {
  return 'bg-neutral-900/80 text-white/50 border border-white/10';
}
function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  return (b / 1e3).toFixed(0) + ' KB';
}
const tickerStyle = computed(() => ({ '--ticker-duration': memberList.value.length * 1.4 + 's' }) as Record<string, string>);

onMounted(async () => {
  await loadCarousel();
  startAuto();
  const first = carouselItems.value[0];
  if (first?.mediaType === 'video') {
    nextTick(() => playVideoAt(0));
  }
  // Fetch public storage size + media counts
  api.get('/images/storage/public').then(r => {
    blobBytes.value = r.data.used;
    imageCount.value = r.data.imageCount ?? null;
    videoCount.value = r.data.videoCount ?? null;
  }).catch(() => {});
  // Fetch member list + count
  api.get('/members').then(r => {
    if (Array.isArray(r.data)) {
      memberCount.value = r.data.length;
      memberList.value = r.data.map((m: any) => ({ _id: m._id, name: m.name }));
    }
  }).catch(() => {});
});
onUnmounted(stopAuto);
</script>

<template>
  <!-- ── Hero – carousel tai staattinen taustahehku ── -->
  <section
    class="relative overflow-hidden min-h-[82vh] sm:min-h-[70vh] flex flex-col rounded-lg sm:rounded-2xl sm:mx-[5px] carousel-border"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >

    <!-- Carousel-slidet: kaikki renderoidaan DOM:iin (v-for), näkyvyys
         vaihdetaan opacity-CSS:llä. Tämä on luotettavin tapa iOS Safarin
         kanssa: video on jo DOM:issa kun .play() kutsutaan. -->
    <template v-if="hasCarousel">
      <template v-for="(item, idx) in carouselItems" :key="item._id">
        <img v-if="item.mediaType === 'image'"
          :src="item.url"
          referrerpolicy="no-referrer"
          :fetchpriority="idx === 0 ? 'high' : 'low'"
          class="absolute inset-0 w-full h-full object-cover rounded-none
                 transition-opacity duration-700"
          :class="idx === activeIdx ? 'opacity-100' : 'opacity-0'" />
        <video v-else
          :ref="(el) => { videoRefs[idx] = el as HTMLVideoElement | null }"
          :src="item.url"
          muted playsinline preload="auto"
          :loop="carouselItems.length <= 1"
          @ended="idx === activeIdx && onVideoEnded()"
          class="absolute inset-0 w-full h-full object-cover
                 transition-opacity duration-700"
          :class="idx === activeIdx ? 'opacity-100' : 'opacity-0'" />
      </template>
    </template>

    <!-- Tummentaja overlay -->
    <div v-if="hasCarousel"
      class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80 pointer-events-none" />

    <!-- Staattinen taustahehku (jos ei carousel-kuvia) -->
    <div v-else class="pointer-events-none absolute inset-0 -z-10">
      <div class="absolute left-1/4 top-0 w-[500px] h-[400px]
                  bg-dpurple-900/30 blur-3xl rounded-full"></div>
      <div class="absolute right-1/4 top-10 w-[400px] h-[300px]
                  bg-dgreen-900/25 blur-3xl rounded-full"></div>
    </div>

    <!-- Mediabadget — hero top-left -->
    <div class="absolute top-3 left-3 z-20 flex flex-col items-start gap-1 pointer-events-none">
      <!-- Tiedostokoko -->
      <div v-if="blobBytes !== null"
        class="flex items-center gap-1.5 px-2.5 py-[3px] rounded-full
               bg-white/5 backdrop-blur-sm border border-white/8 text-white/35
               text-[10px] tracking-wide">
        <svg class="w-2.5 h-2.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
        </svg>
        Känniääliödata {{ fmtBytes(blobBytes) }}
      </div>
      <!-- Jaettu badge: kuvat + videot -->
      <div v-if="imageCount !== null && videoCount !== null"
        class="flex items-stretch rounded-full overflow-hidden
               bg-white/5 backdrop-blur-sm border border-white/8
               text-[10px] tracking-wide">
        <!-- kuvat-puoli -->
        <div class="flex items-center gap-1 px-2.5 py-[3px] text-white/40">
          <svg class="w-2.5 h-2.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          {{ imageCount }}
        </div>
        <!-- divider -->
        <div class="w-px bg-white/10 self-stretch"></div>
        <!-- videot-puoli -->
        <div class="flex items-center gap-1 px-2.5 py-[3px] text-white/40">
          <svg class="w-2.5 h-2.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          {{ videoCount }}
        </div>
      </div>
    </div>

    <!-- Ghost member count + jäsenpillerit — hero top-right -->
    <div v-if="memberCount !== null"
      class="absolute top-0 right-0 z-10 flex flex-col items-end pr-5 pt-4 pointer-events-none select-none">
      <span class="text-[7rem] sm:text-[10rem] font-black leading-none text-white/[0.07] tracking-tighter"
            style="-webkit-text-stroke: 1px rgba(20, 83, 45, 0.5);">
        {{ memberCount }}
      </span>
      <span class="text-xs tracking-[0.25em] uppercase text-white/25 -mt-3 mr-0.5">jäsentä</span>
    </div>

    <!-- Sisältö -->
    <div class="relative z-10 px-4 sm:px-8 lg:px-12 pt-16 pb-10 sm:pt-20 sm:pb-16 flex-1 flex flex-col items-center justify-center w-full">
      <div class="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full
                  bg-dgreen-900/60 border border-dgreen-800/60 text-dgreen-400 text-xs font-medium backdrop-blur-sm">
        <span class="w-1.5 h-1.5 rounded-full bg-dgreen-400 animate-pulse"></span>
        Vuodesta 2003
      </div>

      <h1 class="w-full text-center text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-3 tracking-tight leading-tight
                 drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)]">
        Kanniaalio<span class="text-dpurple-400">+</span>
      </h1>

      <!-- Lyhyt teksti mobiilissa, pidempi isommilla näytöillä -->
      <p class="sm:hidden text-center text-gray-400 text-sm mb-5 w-full max-w-[280px] leading-relaxed drop-shadow">
        BatMUD-pelaajien yhteisö vuodesta 2003.
      </p>
      <div class="hidden sm:block rounded-2xl border border-dpurple-800/40 bg-black/30 backdrop-blur-sm
                  px-6 py-4 max-w-xl mx-auto shadow-lg mb-2">
        <p class="text-gray-300 text-lg sm:text-xl leading-relaxed drop-shadow">
          BatMUD-pelaajien yhteisö (pelin paras), joka on toiminut jo vuodesta 2003. Päivän polttavat keskustelut käydään BatMUD:in puolella, mutta täällä voit tutustua jäseniin, selailla kuvia ja tarinoita sekä hakea mukaan!
        </p>
      </div>

      <div class="mt-5 flex items-center justify-center gap-2 flex-wrap">
        <RouterLink to="/jasenet"
          class="px-4 py-2 rounded-lg border border-dgreen-700/60 text-dgreen-300 text-sm font-medium
                 hover:bg-dgreen-900/40 hover:border-dgreen-600 backdrop-blur-sm transition-colors">
          Jäsenet
        </RouterLink>
        <RouterLink to="/hakemus"
          class="px-4 py-2 rounded-lg border border-dpurple-700/60 text-dpurple-300 text-sm font-medium
                 hover:bg-dpurple-900/40 hover:border-dpurple-600 backdrop-blur-sm transition-colors">
          Hae jäseneksi
        </RouterLink>
      </div>
    </div>

    <!-- Carousel navigaatio (vain jos useampi kuva) -->
    <template v-if="hasCarousel && carouselItems.length > 1">
      <!-- Nuolinapit — piilotettu mobiilissa, pyyhkäisy hoitaa navigoinnin -->
      <button @click="prev(); stopAuto(); startAuto()"
        class="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full
               bg-black/30 hover:bg-black/60 text-white border border-white/10
               backdrop-blur-sm transition-all items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="next(); stopAuto(); startAuto()"
        class="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full
               bg-black/30 hover:bg-black/60 text-white border border-white/10
               backdrop-blur-sm transition-all items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Dots (piilotettu mobiilissa) -->
      <div class="hidden sm:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-20 gap-1.5">
        <button v-for="(_, i) in carouselItems" :key="i"
          @click="goTo(i); stopAuto(); startAuto()"
          class="rounded-full transition-all duration-300 border-0 bg-black"
          :class="i === activeIdx
            ? 'w-2.5 h-2.5 ring-1 ring-dgreen-500 bg-dgreen-500'
            : 'w-2 h-2 bg-black ring-1 ring-dgreen-900/80 hover:ring-dgreen-700'" />
      </div>

      <!-- Drinking glass countdown (fills from empty→full then slide changes) -->
      <div v-if="activeItem?.mediaType !== 'video'"
        class="absolute bottom-3 right-4 z-20 opacity-75 pointer-events-none">
        <svg width="30" height="42" viewBox="0 0 36 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="home-glass-clip">
              <polygon points="4,4 32,4 29,47 7,47" />
            </clipPath>
          </defs>
          <g clip-path="url(#home-glass-clip)">
            <!-- Dark glass bg -->
            <rect x="0" y="0" width="36" height="50" fill="#14532d" opacity="0.3" />
            <!-- Reactive fill: timerProgress 100→0 means full→empty -->
            <rect x="0" width="36" fill="#16a34a" opacity="0.82"
              :y="47 - (timerProgress / 100) * 43"
              :height="(timerProgress / 100) * 43" />
            <!-- Bubble 1 -->
            <circle cx="14" cy="30" r="1.4" fill="#4ade80" opacity="0.5">
              <animate attributeName="cy" values="45;10" dur="2s" repeatCount="indefinite" begin="0.2s" />
              <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" begin="0.2s" />
            </circle>
            <!-- Bubble 2 -->
            <circle cx="22" cy="38" r="1" fill="#4ade80" opacity="0.4">
              <animate attributeName="cy" values="45;14" dur="1.6s" repeatCount="indefinite" begin="0.9s" />
              <animate attributeName="opacity" values="0.4;0" dur="1.6s" repeatCount="indefinite" begin="0.9s" />
            </circle>
          </g>
          <!-- Glass outline -->
          <polygon points="4,4 32,4 29,47 7,47" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5" stroke-linejoin="round" />
          <!-- Rim highlight -->
          <line x1="4" y1="4" x2="32" y2="4" stroke="rgba(255,255,255,0.38)" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </div>

      <!-- Caption -->
      <Transition name="caption-fade">
        <p v-if="activeItem?.caption" :key="activeItem._id"
          class="absolute bottom-12 left-1/2 -translate-x-1/2 z-20
                 text-xs text-white/70 whitespace-nowrap">
          {{ activeItem.caption }}
        </p>
      </Transition>
    </template>
  </section>

  <!-- Jäsenten nimibändi — vaaka-looppi karusellinkuvan alla -->
  <div v-if="memberList.length"
    class="overflow-hidden border-y border-white/5 bg-black/30 py-3 select-none"
    style="-webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
           mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)">
    <div class="ticker-band flex gap-2.5 w-max"
      :style="tickerStyle">
      <template v-for="i in 2" :key="i">
        <template v-for="m in memberList" :key="`${i}-${m._id}`">
          <!-- VIP: kännimestarit -->
          <span v-if="isVip(m.name)"
            class="flex-shrink-0 inline-flex items-center px-3.5 py-1.5 rounded-full
                   text-[12px] font-semibold whitespace-nowrap
                   bg-dpurple-950/90 text-dpurple-400 border border-white/10">
            {{ m.name }}
          </span>
          <!-- Tavalliset jäsenet -->
          <span v-else
            class="flex-shrink-0 inline-flex items-center px-3.5 py-1.5 rounded-full
                   text-[12px] whitespace-nowrap"
            :class="getMemberPillClass(m._id)">
            {{ m.name }}
          </span>
        </template>
      </template>
    </div>
  </div>

  <!-- Navigaatiolinkit -->
  <section class="px-4 sm:px-8 lg:px-12 pb-12 pt-7">
    <p class="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-4 text-center">
      Mitä löydät
    </p>
    <div class="flex flex-wrap gap-2 justify-center">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border
               border-dpurple-600/30 text-dpurple-400/80 text-sm font-medium
               bg-dpurple-950/30 backdrop-blur-sm
               hover:border-dpurple-600/60 hover:text-dpurple-400 hover:bg-dpurple-900/40
               transition-colors duration-150"
      >
        <component :is="item.icon" class="w-4 h-4 shrink-0 stroke-[1.5]" />
        {{ item.label }}
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.caption-fade-enter-active,
.caption-fade-leave-active {
  transition: opacity 0.3s ease;
}
.caption-fade-enter-from,
.caption-fade-leave-to {
  opacity: 0;
}

.carousel-border {
  border: 1px solid transparent;
  border-image: linear-gradient(to bottom, rgba(147, 51, 234, 0.55) 0%, rgba(0, 0, 0, 0) 100%) 1;
  /* border-image ei tue border-radius — käytetään outline + pseudo-element -tekniikkaa */
  border: none;
  position: relative;
}
.carousel-border::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(to bottom, rgba(120, 40, 200, 0.68), rgba(0, 0, 0, 0));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 30;
}

/* Jäsenten nimibändi: looppaava vaakavieritys oikealta vasemmalle */
.ticker-band {
  animation: ticker-roll var(--ticker-duration, 60s) linear infinite;
  will-change: transform;
}
.ticker-band:hover {
  animation-play-state: paused;
}
@keyframes ticker-roll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>

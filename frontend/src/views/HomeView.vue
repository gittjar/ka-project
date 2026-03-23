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
  { to: '/kuvat',    label: 'Kuvia',       icon: Camera,        desc: 'Galleria vuosien varrelta' },
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
const CIRC = 2 * Math.PI * 9; // r=9 → ≈56.55

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

// Ref aktiiviseen video-elementtiin (tarvitaan mobiili-autoplay-korjaukseen)
const videoRef = ref<HTMLVideoElement | null>(null);

async function loadCarousel() {
  try {
    const { data } = await api.get('/images/carousel');
    carouselItems.value = data;
    preloadAll();
  } catch { /* näytetään normaali hero ilman carousel-kuvia */ }
}

function preloadAll() {
  // Ladataan kuvat porrastetusti: aktiivinen välittömästi, seuraava 400ms viiveellä,
  // loput 800ms + välein — vältetään kaistanleveyden ylikuormitus mobiilissa
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

// Restart timer whenever active slide changes (image vs video may differ).
// mode="out-in" poistettu templatesta, joten uusi video-elementti on DOM:issa flush:'post' aikana.
// .play() varmistaa iOS Safarin autoplayn myös siitä suunnasta.
watch(activeIdx, () => {
  startAuto();
  const current = carouselItems.value[activeIdx.value];
  if (current?.mediaType === 'video') {
    nextTick(() => {
      const v = videoRef.value;
      if (v) {
        v.load(); // pakottaa iOS:n lataamaan uudelleen
        v.play().catch(() => {});
      }
    });
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

onMounted(async () => {
  await loadCarousel();
  startAuto();
});
onUnmounted(stopAuto);
</script>

<template>
  <!-- ── Hero – carousel tai staattinen taustahehku ── -->
  <section
    class="relative overflow-hidden min-h-[82vh] sm:min-h-[70vh] flex flex-col rounded-lg sm:rounded-2xl sm:mx-[5px]"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >

    <!-- Esilataajat: piilotetut <video> -elementit ei-aktiivisille videoille.
         Käytetään preload="metadata" (ei "auto") mobiilikaistan säästämiseksi —
         haetaan vain ensimmäinen kehys eikä koko videota. -->
    <template v-if="hasCarousel">
      <video
        v-for="item in carouselItems.filter(i => i.mediaType === 'video' && i._id !== activeItem?._id)"
        :key="'preload-' + item._id"
        :src="item.url"
        preload="metadata"
        muted
        playsinline
        style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden"
      />
    </template>

    <!-- Carousel-taustakuva -->
    <!-- mode="out-in" poistettu: uusi video liitetään DOM:iin HETI kun activeIdx vaihtuu,
         ei vasta 700ms jälkeen. iOS Safari tarvitsee elementin DOM:issa ennen .play()-kutsua.
         Molemmat elementit ovat absolute inset-0, joten ristiinhhäipyminen toimii silti. -->
    <Transition name="carousel-fade">
      <template v-if="hasCarousel && activeItem">
        <img v-if="activeItem.mediaType === 'image'"
          :key="'img-' + activeItem._id"
          :src="activeItem.url"
          referrerpolicy="no-referrer"
          fetchpriority="high"
          class="absolute inset-0 w-full h-full object-cover rounded-none" />
        <video v-else
          ref="videoRef"
          :key="'vid-' + activeItem._id"
          :src="activeItem.url"
          autoplay muted playsinline webkit-playsinline preload="auto"
          :loop="carouselItems.length <= 1"
          @loadedmetadata="(e) => (e.target as HTMLVideoElement).play().catch(() => {})"
          @canplay="(e) => (e.target as HTMLVideoElement).play().catch(() => {})"
          @ended="onVideoEnded"
          class="absolute inset-0 w-full h-full object-cover" />
      </template>
    </Transition>

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

    <!-- Sisältö -->
    <div class="relative z-10 px-4 sm:px-8 lg:px-12 pt-20 pb-16 text-center flex-1 flex flex-col items-center justify-center">
      <div class="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full
                  bg-dgreen-900/60 border border-dgreen-800/60 text-dgreen-400 text-xs font-medium backdrop-blur-sm">
        <span class="w-1.5 h-1.5 rounded-full bg-dgreen-400 animate-pulse"></span>
        Vuodesta 2003
      </div>

      <h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-3 tracking-tight leading-tight
                 drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)]">
        Kanniaalio<span class="text-dpurple-400">+</span>
      </h1>

      <!-- Lyhyt teksti mobiilissa, pidempi isommilla näytöillä -->
      <p class="sm:hidden text-gray-400 text-sm mb-5 max-w-[280px] leading-relaxed drop-shadow">
        BatMUD-pelaajien yhteisö vuodesta 2003.
      </p>
      <div class="hidden sm:block rounded-2xl border border-dpurple-800/40 bg-black/30 backdrop-blur-sm
                  px-6 py-4 max-w-xl mx-auto shadow-lg mb-2">
        <p class="text-gray-300 text-lg sm:text-xl leading-relaxed drop-shadow">
          BatMUD-pelaajien yhteisö, joka on toiminut jo vuodesta 2003. Päivän polttavat keskustelut käydään BatMUD:in puolella, mutta täällä voit tutustua jäseniin, selailla kuvia ja tarinoita sekä hakea mukaan!
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

      <!-- Countdown ring -->
      <div v-if="activeItem?.mediaType !== 'video'"
        class="absolute bottom-3 right-4 z-20 opacity-60 pointer-events-none">
        <svg width="28" height="28" viewBox="0 0 28 28" style="transform: rotate(-90deg)">
          <circle cx="14" cy="14" r="9" fill="none"
            stroke="rgba(255,255,255,0.15)" stroke-width="2" />
          <circle cx="14" cy="14" r="9" fill="none"
            stroke="white" stroke-width="2" stroke-linecap="round"
            :stroke-dasharray="CIRC"
            :stroke-dashoffset="CIRC * (1 - timerProgress / 100)"
            style="transition: stroke-dashoffset 0.05s linear" />
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
        class="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm
               transition-colors duration-150"
        :class="nav.indexOf(item) % 2 === 0
          ? 'border-dgreen-900/60 text-dgreen-300/80 hover:text-dgreen-200 hover:border-dgreen-700/60 hover:bg-dgreen-950/40'
          : 'border-dpurple-900/60 text-dpurple-300/80 hover:text-dpurple-200 hover:border-dpurple-700/60 hover:bg-dpurple-950/40'"
      >
        <component :is="item.icon" class="w-4 h-4 shrink-0 stroke-[1.5]" />
        {{ item.label }}
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.carousel-fade-enter-active {
  transition: opacity 0.7s ease;
}
.carousel-fade-leave-active {
  transition: opacity 0.7s ease;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.carousel-fade-enter-from,
.carousel-fade-leave-to {
  opacity: 0;
}

.caption-fade-enter-active,
.caption-fade-leave-active {
  transition: opacity 0.3s ease;
}
.caption-fade-enter-from,
.caption-fade-leave-to {
  opacity: 0;
}
</style>

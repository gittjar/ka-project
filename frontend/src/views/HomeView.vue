<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Users, Camera, BookOpen, ScrollText, GlassWater, ClipboardList, Play } from 'lucide-vue-next';
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

const activeItem = computed(() => carouselItems.value[activeIdx.value] ?? null);
const hasCarousel = computed(() => carouselItems.value.length > 0);

async function loadCarousel() {
  try {
    const { data } = await api.get('/images/carousel');
    carouselItems.value = data;
  } catch { /* näytetään normaali hero ilman carousel-kuvia */ }
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
  // Videos advance via @ended; only set interval for images
  if (activeItem.value?.mediaType !== 'video')
    autoTimer = setInterval(next, 6000);
}
function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}
function onVideoEnded() {
  if (carouselItems.value.length > 1) next();
}

// Restart timer whenever active slide changes (image vs video may differ)
watch(activeIdx, startAuto);

onMounted(async () => {
  await loadCarousel();
  startAuto();
});
onUnmounted(stopAuto);
</script>

<template>
  <!-- ── Hero – carousel tai staattinen taustahehku ── -->
  <section class="relative overflow-hidden min-h-[70vh] flex flex-col rounded-2xl mx-3 sm:mx-4">

    <!-- Carousel-taustakuva -->
    <Transition name="carousel-fade" mode="out-in">
      <template v-if="hasCarousel && activeItem">
        <img v-if="activeItem.mediaType === 'image'"
          :key="'img-' + activeItem._id"
          :src="activeItem.url"
          referrerpolicy="no-referrer"
          class="absolute inset-0 w-full h-full object-cover rounded-none" />
        <video v-else
          :key="'vid-' + activeItem._id"
          :src="activeItem.url"
          autoplay muted playsinline
          :loop="carouselItems.length <= 1"
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
    <div class="relative z-10 px-4 sm:px-8 lg:px-12 pt-24 pb-16 text-center flex-1 flex flex-col items-center justify-center">
      <div class="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full
                  bg-dgreen-900/60 border border-dgreen-800/60 text-dgreen-400 text-xs font-medium backdrop-blur-sm">
        <span class="w-1.5 h-1.5 rounded-full bg-dgreen-400 animate-pulse"></span>
        Vuodesta 2003
      </div>

      <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-4 tracking-tight leading-tight
                 drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)]">
        Kanniaalio<span class="text-dpurple-400">+</span>
      </h1>
      <div class="rounded-2xl border border-dpurple-800/40 bg-black/30 backdrop-blur-sm px-6 py-4 max-w-xl mx-auto shadow-lg">
        <p class="text-gray-300 text-lg sm:text-xl leading-relaxed drop-shadow">
          BatMUD-pelaajien yhteisö, joka on toiminut jo vuodesta 2003. Päivän polttavat keskustelut käydään BatMUD:in puolella, mutta täällä voit tutustua jäseniin, selailla kuvia ja tarinoita sekä hakea mukaan!
        </p>
      </div>

      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <RouterLink to="/jasenet"
          class="w-full sm:w-auto px-6 py-3 rounded-xl bg-dgreen-800 hover:bg-dgreen-600
                 text-white font-semibold transition-all duration-200 shadow-lg shadow-dgreen-900/40
                 hover:shadow-dgreen-800/40 hover:-translate-y-0.5">
          Tutustu jäseniin
        </RouterLink>
        <RouterLink to="/hakemus"
          class="w-full sm:w-auto px-6 py-3 rounded-xl border border-white/20
                 hover:border-dpurple-600 hover:bg-dpurple-900/40 backdrop-blur-sm
                 text-gray-300 hover:text-white font-semibold transition-all duration-200">
          Hae jäseneksi
        </RouterLink>
      </div>
    </div>

    <!-- Carousel navigaatio (vain jos useampi kuva) -->
    <template v-if="hasCarousel && carouselItems.length > 1">
      <!-- Nuolinapit -->
      <button @click="prev(); stopAuto(); startAuto()"
        class="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full
               bg-black/30 hover:bg-black/60 text-white border border-white/10
               backdrop-blur-sm transition-all">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="next(); stopAuto(); startAuto()"
        class="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full
               bg-black/30 hover:bg-black/60 text-white border border-white/10
               backdrop-blur-sm transition-all">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Dots -->
      <div class="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        <button v-for="(_, i) in carouselItems" :key="i"
          @click="goTo(i); stopAuto(); startAuto()"
          class="rounded-full transition-all duration-300 border-0"
          :class="i === activeIdx
            ? 'w-6 h-2.5 bg-white'
            : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'" />
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

  <!-- Navigaatiokortit -->
  <section class="px-4 sm:px-8 lg:px-12 pb-16 pt-10">
    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 text-center">
      Mitä löydät
    </h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="group flex flex-col gap-2 p-4 sm:p-5 rounded-2xl
               bg-black/60 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        :class="nav.indexOf(item) % 2 === 0
          ? 'border-dgreen-900/50 hover:bg-dgreen-950/60 hover:border-dgreen-800/70 hover:shadow-dgreen-900/20'
          : 'border-dpurple-900/50 hover:bg-dpurple-950/60 hover:border-dpurple-800/70 hover:shadow-dpurple-900/20'"
      >
        <component :is="item.icon" class="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.5]"
          :class="nav.indexOf(item) % 2 === 0 ? 'text-dgreen-400' : 'text-dpurple-400'" />
        <div>
          <p class="text-sm font-semibold text-gray-200 group-hover:text-white">{{ item.label }}</p>
          <p class="text-xs text-gray-400 mt-0.5 leading-snug">{{ item.desc }}</p>
        </div>
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

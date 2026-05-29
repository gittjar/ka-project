<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { MapPin, CalendarDays, Clock, X, Info } from 'lucide-vue-next';
import api from '../api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const MEDIA_BASE = (import.meta.env.VITE_MEDIA_URL ?? '') + '/kuvat';

const loading = ref(true);
const notFound = ref(false);
const blobName = ref('');
const folderId = ref<string | null>(null);
const caption = ref<string | null>(null);
const dateTaken = ref<string | null>(null);
const locationName = ref<string | null>(null);

const isVideo = computed(() => /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i.test(blobName.value));

const token = route.params.token as string;
const mediaUrl = computed(() => blobName.value ? `${MEDIA_BASE}/s/${token}` : '');

const formattedDate = computed(() => {
  if (!dateTaken.value) return null;
  const d = new Date(dateTaken.value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' });
});

const formattedTime = computed(() => {
  if (!dateTaken.value) return null;
  const d = new Date(dateTaken.value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
});

const hasOverlay = computed(() => !!(locationName.value || formattedDate.value || formattedTime.value));
const overlayVisible = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get(`/images/share/${token}`);
    blobName.value = data.blobName;
    folderId.value = data.folderId ?? null;
    caption.value = data.caption || null;
    dateTaken.value = data.dateTaken || null;
    locationName.value = data.locationName || null;

    // Jos locationName puuttuu mutta GPS-koordinaatit löytyy, reverse geocode
    if (!locationName.value && data.latitude != null && data.longitude != null) {
      try {
        const geo = await api.get('/images/geocode', { params: { lat: data.latitude, lng: data.longitude } });
        locationName.value = geo.data?.placeName || null;
      } catch { /* ei blokata */ }
    }
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});

function openInGallery() {
  const query: Record<string, string> = { img: blobName.value };
  if (folderId.value) query.folder = folderId.value;
  router.push({ path: '/galleria', query });
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-12">
    <div v-if="loading" class="flex items-center justify-center py-24 text-gray-500 text-sm">
      Ladataan...
    </div>

    <div v-else-if="notFound" class="flex flex-col items-center justify-center py-24 text-center gap-3">
      <p class="text-gray-400 text-sm">Jakolinkki on vanhentunut tai virheellinen.</p>
      <RouterLink to="/galleria" class="text-dpurple-400 text-sm hover:underline">Avaa galleria</RouterLink>
    </div>

    <div v-else class="flex flex-col items-center gap-6">
      <!-- Kuva tai video + overlay-pillerit -->
      <div class="relative max-w-full">
        <video v-if="isVideo" :src="mediaUrl" controls crossorigin="anonymous"
          class="max-h-[75vh] max-w-full rounded-xl shadow-xl" />
        <img v-else :src="mediaUrl" crossorigin="anonymous"
          class="max-h-[75vh] max-w-full rounded-xl shadow-xl object-contain block" />

        <!-- Overlay: meta-pill vasemmassa alakulmassa -->
        <div v-if="hasOverlay" class="absolute bottom-3 left-3">

          <!-- Laajennettu pill -->
          <div v-if="overlayVisible"
            class="inline-flex items-center rounded-full text-xs
                   text-white/90 bg-black/55 backdrop-blur-sm border border-dpurple-700/60">
            <span v-if="locationName" class="inline-flex items-center gap-1.5 px-2.5 py-1">
              <MapPin class="w-3 h-3 shrink-0 text-dpurple-400/80" />{{ locationName }}
            </span>
            <span v-if="locationName && (formattedDate || formattedTime)"
              class="w-px self-stretch bg-dpurple-700/50" />
            <span v-if="formattedDate" class="inline-flex items-center gap-1.5 px-2.5 py-1">
              <CalendarDays class="w-3 h-3 shrink-0 text-dpurple-400/80" />{{ formattedDate }}
            </span>
            <span v-if="formattedDate && formattedTime"
              class="w-px self-stretch bg-dpurple-700/50" />
            <span v-if="formattedTime" class="inline-flex items-center gap-1.5 px-2.5 py-1">
              <Clock class="w-3 h-3 shrink-0 text-dpurple-400/80" />{{ formattedTime }}
            </span>
            <!-- Jakaja + sulje-nappi -->
            <span class="w-px self-stretch bg-dpurple-700/50" />
            <button @click="overlayVisible = false"
              class="flex items-center justify-center w-6 h-6 mr-0.5 rounded-full
                     text-white/40 hover:text-white/80 transition-colors bg-transparent border-0">
              <X class="w-3 h-3" />
            </button>
          </div>

          <!-- Pienennetty tila: pieni pyöreä Info-nappi -->
          <button v-else @click="overlayVisible = true"
            class="flex items-center justify-center w-6 h-6 rounded-full
                   bg-black/50 backdrop-blur-sm border border-dpurple-700/50
                   text-dpurple-400/70 hover:text-dpurple-300 transition-colors border-0">
            <Info class="w-3 h-3" />
          </button>

        </div>

        <!-- Watermark alakulmassa -->
        <div class="absolute bottom-3 right-3 pointer-events-none select-none
                    px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm
                    text-white/50 text-xs font-light tracking-[0.18em]">
          Kanniaalio+
        </div>
      </div>

      <!-- Kuvateksti kuvan alla (ei overlayna, saa olla pidempi) -->
      <p v-if="caption" class="text-sm italic text-gray-400 text-center max-w-lg">
        "{{ caption }}"
      </p>

      <!-- Toimintopainikkeet -->
      <div class="flex flex-col sm:flex-row items-center gap-3">
        <button v-if="auth.isLoggedIn" @click="openInGallery"
          class="px-5 py-2.5 rounded-xl bg-dpurple-700 hover:bg-dpurple-600
                 text-white text-sm font-medium transition-colors">
          Avaa galleriassa
        </button>
        <RouterLink v-else to="/login"
          class="px-5 py-2.5 rounded-xl bg-dpurple-700 hover:bg-dpurple-600
                 text-white text-sm font-medium transition-colors">
          Kirjaudu nähdäksesi gallerian
        </RouterLink>
        <RouterLink to="/"
          class="px-5 py-2.5 rounded-xl border border-gray-700 hover:border-gray-500
                 text-gray-300 text-sm font-medium transition-colors">
          Etusivu
        </RouterLink>
      </div>
    </div>
  </div>
</template>

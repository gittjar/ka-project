<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Upload, Trash2, X, ImageOff, AlertTriangle, MapPin, Camera, Clock } from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

interface ExifData {
  dateTaken?: string;
  make?: string;
  model?: string;
  lens?: string;
  fNumber?: number;
  exposureTime?: string;
  iso?: number;
  focalLength?: number;
  focalLength35?: number;
  flash?: string;
  width?: number;
  height?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
}
interface GalleryImage {
  _id?: string;
  blobName: string;
  url: string;
  createdAt: string;
  uploadedBy?: string;
  exif?: ExifData;
}

const auth = useAuthStore();
const images = ref<GalleryImage[]>([]);
const loading = ref(true);
const loadError = ref('');

// Lightbox
const lightboxUrl = ref<string | null>(null);
const lightboxIdx = ref(0);

function openLightbox(idx: number) {
  lightboxIdx.value = idx;
  lightboxUrl.value = images.value[idx]!.url;
}
function lightboxPrev() {
  lightboxIdx.value = (lightboxIdx.value - 1 + images.value.length) % images.value.length;
  lightboxUrl.value = images.value[lightboxIdx.value]!.url;
}
function lightboxNext() {
  lightboxIdx.value = (lightboxIdx.value + 1) % images.value.length;
  lightboxUrl.value = images.value[lightboxIdx.value]!.url;
}
function onKeydown(e: KeyboardEvent) {
  if (!lightboxUrl.value) return;
  if (e.key === 'ArrowLeft') lightboxPrev();
  if (e.key === 'ArrowRight') lightboxNext();
  if (e.key === 'Escape') lightboxUrl.value = null;
}

// Upload
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref('');
const dragOver = ref(false);

async function uploadFiles(files: FileList | File[]) {
  uploadError.value = '';
  const imageExts = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|heic|heif|avif|ico)$/i;
  const list = Array.from(files).filter(f =>
    f.type.startsWith('image/') || imageExts.test(f.name)
  );
  console.log('[gallery] uploadFiles called, files:', list.length, 'isAdmin:', auth.isAdmin, 'token:', !!localStorage.getItem('kk_token'));
  if (!list.length) { uploadError.value = 'Ei kuvatiedostoja valittu'; return; }
  uploading.value = true;
  try {
    for (const file of list) {
      console.log('[gallery] uploading:', file.name, file.type, file.size);
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/images/upload?container=gallery', fd);
      console.log('[gallery] upload ok:', data);
      images.value.unshift(data);
    }
  } catch (e: any) {
    console.error('[gallery] upload error:', e.response?.status, e.response?.data, e.message);
    uploadError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Lataus epäonnistui';
  } finally {
    uploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files) uploadFiles(files);
}
function onDrop(e: DragEvent) {
  dragOver.value = false;
  if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files);
}

// Delete
const deleteTarget = ref<GalleryImage | null>(null);
const deleting = ref(false);

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api.delete(`/images/gallery/${deleteTarget.value.blobName}`);
    images.value = images.value.filter(i => i.blobName !== deleteTarget.value!.blobName);
    if (lightboxUrl.value === deleteTarget.value.url) lightboxUrl.value = null;
    deleteTarget.value = null;
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Poisto epäonnistui';
    deleteTarget.value = null;
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/images?container=gallery');
    images.value = data;
  } catch {
    loadError.value = 'Kuvien lataus epäonnistui';
  } finally {
    loading.value = false;
  }
  window.addEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-10">

    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Kuvia</h1>
        <p class="text-xs text-gray-600 mt-0.5">{{ images.length }} kuvaa</p>
      </div>
      <div v-if="auth.isAdmin" class="flex items-center gap-2">
        <input ref="fileInputRef" type="file" accept="image/*,.heic,.heif,.avif,.tiff,.tif,.bmp" multiple class="hidden" @change="onFileChange" />
        <button @click="fileInputRef?.click()" :disabled="uploading"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                 bg-dpurple-900/50 hover:bg-dpurple-800/50 border border-dpurple-800/50
                 text-dpurple-300 disabled:opacity-50 transition-all">
          <Upload class="w-4 h-4" />{{ uploading ? 'Ladataan...' : 'Lisää kuvia' }}
        </button>
      </div>
    </div>

    <!-- Upload error -->
    <div v-if="uploadError"
      class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-950/50 border border-red-900/40
             text-red-400 text-sm mb-4">
      <AlertTriangle class="w-4 h-4 shrink-0" />{{ uploadError }}
      <button @click="uploadError = ''" class="ml-auto text-red-600 hover:text-red-400 border-0 bg-transparent">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Drag & drop zone (admin only) -->
    <div v-if="auth.isAdmin && !loading"
      class="mb-6 border-2 border-dashed rounded-2xl px-6 py-8 text-center transition-all cursor-pointer"
      :class="dragOver
        ? 'border-dpurple-600 bg-dpurple-950/30'
        : 'border-gray-800 hover:border-gray-700 bg-transparent'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInputRef?.click()">
      <Upload class="w-6 h-6 mx-auto mb-2 text-gray-700" :class="dragOver ? 'text-dpurple-500' : ''" />
      <p class="text-sm text-gray-700" :class="dragOver ? 'text-dpurple-400' : ''">
        Raahaa kuvat tähän tai klikkaa lisätäksesi
      </p>
      <p class="text-xs text-gray-800 mt-1">JPG, PNG, WebP · max 10 MB / kuva</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-gray-600 text-sm py-20 text-center">Ladataan...</div>
    <div v-else-if="loadError" class="text-red-500 text-sm py-20 text-center">{{ loadError }}</div>

    <!-- Empty state -->
    <div v-else-if="images.length === 0 && !auth.isAdmin"
      class="text-center py-20 text-gray-700">
      <ImageOff class="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p class="text-sm">Ei kuvia vielä.</p>
    </div>

    <!-- Grid -->
    <div v-else-if="images.length > 0"
      class="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
      <div
        v-for="(img, idx) in images" :key="img.blobName"
        class="group relative break-inside-avoid rounded-2xl overflow-hidden
               bg-gray-950 border border-gray-800/50 cursor-pointer"
        @click="openLightbox(idx)"
      >
        <img :src="img.url" :alt="img.blobName"
          referrerpolicy="no-referrer"
          class="w-full block object-cover transition-transform duration-300
                 group-hover:scale-[1.02]" />
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
        <!-- Delete button (admin) -->
        <button v-if="auth.isAdmin"
          @click.stop="deleteTarget = img"
          class="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 border-0
                 text-gray-400 hover:text-red-400 hover:bg-black/90
                 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- ── LIGHTBOX ── -->
  <Teleport to="body">
    <div v-if="lightboxUrl"
      class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      @click="lightboxUrl = null">

      <button class="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20
                     text-white border-0 transition-all z-10" @click="lightboxUrl = null">
        <X class="w-5 h-5" />
      </button>

      <!-- Prev -->
      <button v-if="images.length > 1"
        class="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-10"
        @click.stop="lightboxPrev">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <img :src="lightboxUrl" @click.stop
        class="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain" />

      <!-- Next -->
      <button v-if="images.length > 1"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-10"
        @click.stop="lightboxNext">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- EXIF-paneeli -->
      <div v-if="images[lightboxIdx]?.exif && Object.keys(images[lightboxIdx]!.exif!).length"
        class="absolute bottom-10 left-1/2 -translate-x-1/2 w-max max-w-[90vw]
               bg-black/75 backdrop-blur-md rounded-2xl px-4 py-3 text-xs text-gray-300
               flex flex-wrap gap-x-4 gap-y-1"
        @click.stop>
        <!-- Kamera -->
        <span v-if="images[lightboxIdx]!.exif!.model" class="flex items-center gap-1">
          <Camera class="w-3 h-3 text-gray-500" />
          {{ images[lightboxIdx]!.exif!.make && !images[lightboxIdx]!.exif!.model?.startsWith(images[lightboxIdx]!.exif!.make!)
            ? images[lightboxIdx]!.exif!.make + ' ' : '' }}{{ images[lightboxIdx]!.exif!.model }}
        </span>
        <!-- Valotusaika -->
        <span v-if="images[lightboxIdx]!.exif!.exposureTime" class="text-gray-400">
          {{ images[lightboxIdx]!.exif!.exposureTime }}
        </span>
        <!-- Aukko -->
        <span v-if="images[lightboxIdx]!.exif!.fNumber" class="text-gray-400">
          f/{{ images[lightboxIdx]!.exif!.fNumber }}
        </span>
        <!-- ISO -->
        <span v-if="images[lightboxIdx]!.exif!.iso" class="text-gray-400">
          ISO {{ images[lightboxIdx]!.exif!.iso }}
        </span>
        <!-- Polttopiste -->
        <span v-if="images[lightboxIdx]!.exif!.focalLength" class="text-gray-400">
          {{ images[lightboxIdx]!.exif!.focalLength }}mm
          <span v-if="images[lightboxIdx]!.exif!.focalLength35">({{ images[lightboxIdx]!.exif!.focalLength35 }}mm)</span>
        </span>
        <!-- Päivämäärä -->
        <span v-if="images[lightboxIdx]!.exif!.dateTaken" class="flex items-center gap-1">
          <Clock class="w-3 h-3 text-gray-500" />
          {{ new Date(images[lightboxIdx]!.exif!.dateTaken!).toLocaleString('fi-FI', { dateStyle:'short', timeStyle:'short' }) }}
        </span>
        <!-- Sijainti -->
        <a v-if="images[lightboxIdx]!.exif!.latitude"
          :href="`https://maps.google.com/?q=${images[lightboxIdx]!.exif!.latitude},${images[lightboxIdx]!.exif!.longitude}`"
          target="_blank" rel="noopener"
          class="flex items-center gap-1 text-dpurple-400 hover:text-dpurple-300"
          @click.stop>
          <MapPin class="w-3 h-3" />
          {{ images[lightboxIdx]!.exif!.latitude!.toFixed(4) }}, {{ images[lightboxIdx]!.exif!.longitude!.toFixed(4) }}
        </a>
      </div>

      <!-- Counter -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-gray-500">
        {{ lightboxIdx + 1 }} / {{ images.length }}
      </div>
    </div>
  </Teleport>

  <!-- ── POISTOVAHVISTUS ── -->
  <Teleport to="body">
    <div v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="deleteTarget = null" />
      <div class="relative w-full sm:max-w-sm bg-gray-950 border border-red-900/40
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div class="h-1 w-full bg-gradient-to-r from-red-900/60 via-red-700/60 to-red-900/60" />
        <div class="px-6 pt-6 pb-5">
          <div class="flex items-start gap-4 mb-5">
            <div class="w-10 h-10 rounded-2xl bg-red-950/60 border border-red-900/40
                        flex items-center justify-center flex-shrink-0">
              <AlertTriangle class="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-white mb-1">Poistetaanko kuva?</h3>
              <p class="text-xs text-gray-500">Tätä ei voi peruuttaa.</p>
            </div>
          </div>
          <div v-if="deleteTarget"
            class="mb-4 rounded-xl overflow-hidden border border-gray-800 max-h-32">
            <img :src="deleteTarget.url" class="w-full object-cover max-h-32" />
          </div>
          <div class="flex gap-2">
            <button @click="deleteTarget = null"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white transition-all bg-transparent">
              Peruuta
            </button>
            <button @click="doDelete" :disabled="deleting"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-sm font-medium border-0 bg-red-900/50 hover:bg-red-800/60
                     text-red-300 disabled:opacity-50 transition-all">
              <Trash2 class="w-3.5 h-3.5" />{{ deleting ? 'Poistetaan...' : 'Poista' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

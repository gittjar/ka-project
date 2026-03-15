<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Upload, Trash2, X, ImageOff, AlertTriangle,
  MapPin, Camera, Clock, FolderOpen, Plus, Play,
  ChevronRight, HardDrive,
} from 'lucide-vue-next';
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
interface FolderItem {
  _id: string;
  name: string;
  parent: string | null;
  createdBy: string;
  createdAt: string;
}
interface MediaItem {
  _id: string;
  blobName: string;
  url: string;
  createdAt: string;
  uploadedBy?: string;
  mediaType: 'image' | 'video';
  fileSize?: number;
  exif?: ExifData;
}

const auth = useAuthStore();

// Navigation
const currentFolderId = ref<string | null>(null);
const breadcrumb = ref<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Kuvat' }]);
const folders = ref<FolderItem[]>([]);
const mediaItems = ref<MediaItem[]>([]);
const loading = ref(true);
const loadError = ref('');

// Storage (admin)
const storageUsed = ref(0);
const storageMax = ref(100 * 1024 * 1024 * 1024);
const storagePercent = computed(() => Math.min(100, (storageUsed.value / storageMax.value) * 100));

// Upload
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref('');
const dragOver = ref(false);

// Lightbox
const lightboxItem = ref<MediaItem | null>(null);
const lightboxIdx = ref(0);

// Delete media
const deleteTarget = ref<MediaItem | null>(null);
const deleting = ref(false);

// New folder
const showNewFolder = ref(false);
const newFolderName = ref('');
const creatingFolder = ref(false);

// Delete folder
const deleteFolderTarget = ref<FolderItem | null>(null);
const deletingFolder = ref(false);

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB';
  return b + ' B';
}

function canDelete(item: MediaItem): boolean {
  return auth.isAdmin || item.uploadedBy === auth.username;
}

// ── Navigation ────────────────────────────────────────────────────────────────

async function loadFolder(folderId: string | null) {
  loading.value = true;
  loadError.value = '';
  try {
    const [fRes, mRes] = await Promise.all([
      api.get(`/images/folders?parent=${folderId ?? 'null'}`),
      api.get(`/images?folder=${folderId ?? 'null'}`),
    ]);
    folders.value = fRes.data;
    mediaItems.value = mRes.data;
  } catch {
    loadError.value = 'Sisällön lataus epäonnistui';
  } finally {
    loading.value = false;
  }
}

async function navigateInto(folder: FolderItem) {
  currentFolderId.value = folder._id;
  breadcrumb.value.push({ id: folder._id, name: folder.name });
  await loadFolder(folder._id);
}

async function navigateTo(idx: number) {
  const crumb = breadcrumb.value[idx]!;
  breadcrumb.value = breadcrumb.value.slice(0, idx + 1);
  currentFolderId.value = crumb.id;
  await loadFolder(crumb.id);
}

// ── Upload ────────────────────────────────────────────────────────────────────

async function uploadFiles(files: FileList | File[]) {
  uploadError.value = '';
  const ACCEPTED = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|heic|heif|avif|mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
  const list = Array.from(files).filter(
    f => f.type.startsWith('image/') || f.type.startsWith('video/') || ACCEPTED.test(f.name)
  );
  if (!list.length) { uploadError.value = 'Ei tuettuja tiedostoja'; return; }
  uploading.value = true;
  try {
    for (const file of list) {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/images/upload?folder=${currentFolderId.value ?? 'null'}`, fd);
      mediaItems.value.unshift(data);
    }
    if (auth.isAdmin) await loadStorage();
  } catch (e: any) {
    uploadError.value = e.response?.data?.error || e.response?.data?.message || 'Lataus epäonnistui';
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

// ── Lightbox ──────────────────────────────────────────────────────────────────

function openLightbox(idx: number) {
  lightboxIdx.value = idx;
  lightboxItem.value = mediaItems.value[idx]!;
}
function lightboxPrev() {
  lightboxIdx.value = (lightboxIdx.value - 1 + mediaItems.value.length) % mediaItems.value.length;
  lightboxItem.value = mediaItems.value[lightboxIdx.value]!;
}
function lightboxNext() {
  lightboxIdx.value = (lightboxIdx.value + 1) % mediaItems.value.length;
  lightboxItem.value = mediaItems.value[lightboxIdx.value]!;
}
function closeLightbox() { lightboxItem.value = null; }

function onKeydown(e: KeyboardEvent) {
  if (!lightboxItem.value) return;
  if (e.key === 'ArrowLeft') lightboxPrev();
  if (e.key === 'ArrowRight') lightboxNext();
  if (e.key === 'Escape') closeLightbox();
}

// ── Delete media ──────────────────────────────────────────────────────────────

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api.delete(`/images/media/${deleteTarget.value._id}`);
    mediaItems.value = mediaItems.value.filter(i => i._id !== deleteTarget.value!._id);
    if (lightboxItem.value?._id === deleteTarget.value._id) closeLightbox();
    deleteTarget.value = null;
    if (auth.isAdmin) await loadStorage();
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Poisto epäonnistui';
    deleteTarget.value = null;
  } finally {
    deleting.value = false;
  }
}

// ── Folder management ─────────────────────────────────────────────────────────

async function createFolder() {
  if (!newFolderName.value.trim()) return;
  creatingFolder.value = true;
  try {
    const { data } = await api.post('/images/folders', {
      name: newFolderName.value.trim(),
      parent: currentFolderId.value,
    });
    folders.value.push(data);
    folders.value.sort((a, b) => a.name.localeCompare(b.name));
    newFolderName.value = '';
    showNewFolder.value = false;
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Kansion luonti epäonnistui';
  } finally {
    creatingFolder.value = false;
  }
}

async function doDeleteFolder() {
  if (!deleteFolderTarget.value) return;
  deletingFolder.value = true;
  try {
    await api.delete(`/images/folders/${deleteFolderTarget.value._id}`);
    folders.value = folders.value.filter(f => f._id !== deleteFolderTarget.value!._id);
    deleteFolderTarget.value = null;
    if (auth.isAdmin) await loadStorage();
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Kansion poisto epäonnistui';
    deleteFolderTarget.value = null;
  } finally {
    deletingFolder.value = false;
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function loadStorage() {
  try {
    const { data } = await api.get('/images/storage');
    storageUsed.value = data.used;
    storageMax.value = data.max;
  } catch { /* ohitetaan */ }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  await loadFolder(null);
  if (auth.isAdmin) await loadStorage();
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-10">

    <!-- ── Tallennustila (admin) ── -->
    <div v-if="auth.isAdmin" class="mb-5 p-3 rounded-2xl bg-gray-950 border border-gray-800/50">
      <div class="flex items-center justify-between mb-1.5 text-xs">
        <span class="flex items-center gap-1.5 text-gray-500">
          <HardDrive class="w-3.5 h-3.5" />Tallennustila
        </span>
        <span class="text-gray-400">{{ fmtBytes(storageUsed) }} / {{ fmtBytes(storageMax) }}</span>
      </div>
      <div class="h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-dpurple-700 to-dgreen-600 transition-all duration-500"
             :style="{ width: storagePercent + '%' }" />
      </div>
    </div>

    <!-- ── Otsikko, leivänmuru ja toiminnot ── -->
    <div class="flex items-center justify-between gap-4 flex-wrap mb-6">
      <!-- Leivänmuru -->
      <nav class="flex items-center gap-1 flex-wrap">
        <button
          v-for="(crumb, i) in breadcrumb" :key="i"
          @click="i < breadcrumb.length - 1 && navigateTo(i)"
          class="flex items-center gap-1 text-sm border-0 bg-transparent p-0"
          :class="i === breadcrumb.length - 1
            ? 'text-white font-semibold cursor-default'
            : 'text-gray-500 hover:text-gray-300 cursor-pointer'">
          <ChevronRight v-if="i > 0" class="w-3.5 h-3.5 text-gray-700" />
          {{ crumb.name }}
        </button>
      </nav>
      <p class="text-xs text-gray-700 -mt-4 w-full">{{ mediaItems.length }} tiedostoa</p>

      <!-- Toiminnot -->
      <div class="flex items-center gap-2">
        <input
          ref="fileInputRef" type="file"
          accept="image/*,video/*,.heic,.heif,.avif,.tiff,.tif,.bmp,.mov,.m4v,.mkv,.avi,.3gp"
          multiple class="hidden" @change="onFileChange" />
        <button v-if="auth.isAdmin" @click="showNewFolder = true"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600
                 bg-transparent transition-all">
          <Plus class="w-4 h-4" />Uusi kansio
        </button>
        <button v-if="auth.isLoggedIn" @click="fileInputRef?.click()" :disabled="uploading"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                 bg-dpurple-900/50 hover:bg-dpurple-800/50 border border-dpurple-800/50
                 text-dpurple-300 disabled:opacity-50 transition-all">
          <Upload class="w-4 h-4" />{{ uploading ? 'Ladataan...' : 'Lisää' }}
        </button>
      </div>
    </div>

    <!-- ── Virhe ── -->
    <div v-if="uploadError"
      class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-950/50 border border-red-900/40
             text-red-400 text-sm mb-4">
      <AlertTriangle class="w-4 h-4 shrink-0" />{{ uploadError }}
      <button @click="uploadError = ''" class="ml-auto text-red-600 hover:text-red-400 border-0 bg-transparent">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- ── Raahaa & pudota (kirjautunut) ── -->
    <div v-if="auth.isLoggedIn && !loading"
      class="mb-6 border-2 border-dashed rounded-2xl px-6 py-8 text-center transition-all cursor-pointer"
      :class="dragOver
        ? 'border-dpurple-600 bg-dpurple-950/30'
        : 'border-gray-800 hover:border-gray-700 bg-transparent'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInputRef?.click()">
      <Upload class="w-6 h-6 mx-auto mb-2" :class="dragOver ? 'text-dpurple-500' : 'text-gray-700'" />
      <p class="text-sm" :class="dragOver ? 'text-dpurple-400' : 'text-gray-700'">
        Raahaa kuvia tai videoita tähän tai klikkaa lisätäksesi
      </p>
      <p class="text-xs text-gray-800 mt-1">JPG, PNG, WebP, HEIC, MP4, MOV · max 500 MB / tiedosto</p>
    </div>

    <!-- ── Lataus ── -->
    <div v-if="loading" class="text-gray-600 text-sm py-20 text-center">Ladataan...</div>
    <div v-else-if="loadError" class="text-red-500 text-sm py-20 text-center">{{ loadError }}</div>

    <template v-else>
      <!-- ── Kansioruudukko ── -->
      <div v-if="folders.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <div
          v-for="folder in folders" :key="folder._id"
          class="group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer
                 bg-gray-950 border border-gray-800/50 hover:border-gray-700 transition-all"
          @click="navigateInto(folder)">
          <FolderOpen class="w-7 h-7 text-dpurple-500/70 shrink-0" />
          <span class="text-sm font-medium text-white truncate">{{ folder.name }}</span>
          <button v-if="auth.isAdmin"
            @click.stop="deleteFolderTarget = folder"
            class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg
                   bg-black/70 text-gray-500 hover:text-red-400 border-0 transition-all">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- ── Tyhjä tila ── -->
      <div v-if="!folders.length && !mediaItems.length"
        class="text-center py-20 text-gray-700">
        <ImageOff class="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p class="text-sm">Ei sisältöä vielä.</p>
        <p v-if="auth.isAdmin" class="text-xs mt-1 text-gray-800">Luo kansio tai lataa tiedostoja.</p>
      </div>

      <!-- ── Mediaruudukko ── -->
      <div v-if="mediaItems.length"
        class="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
        <div
          v-for="(item, idx) in mediaItems" :key="item._id"
          class="group relative break-inside-avoid rounded-2xl overflow-hidden
                 bg-gray-950 border border-gray-800/50 cursor-pointer"
          @click="openLightbox(idx)">

          <!-- Kuva -->
          <img v-if="item.mediaType === 'image'" :src="item.url" :alt="item.blobName"
            referrerpolicy="no-referrer"
            class="w-full block object-cover transition-transform duration-300 group-hover:scale-[1.02]" />

          <!-- Video -->
          <template v-else>
            <video :src="item.url" preload="metadata" muted
              class="w-full block object-cover" />
            <div class="absolute inset-0 flex items-center justify-center bg-black/40">
              <div class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play class="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
          </template>

          <!-- Hover overlay -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200
                      pointer-events-none" />

          <!-- Poistopainike -->
          <button v-if="canDelete(item)"
            @click.stop="deleteTarget = item"
            class="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 border-0
                   text-gray-400 hover:text-red-400 hover:bg-black/90
                   opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </template>
  </div>

  <!-- ── LIGHTBOX ── -->
  <Teleport to="body">
    <div v-if="lightboxItem"
      class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      @click="closeLightbox">

      <!-- Sulje -->
      <button class="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20
                     text-white border-0 transition-all z-10" @click="closeLightbox">
        <X class="w-5 h-5" />
      </button>

      <!-- Edellinen -->
      <button v-if="mediaItems.length > 1"
        class="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-10"
        @click.stop="lightboxPrev">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- Kuva -->
      <img v-if="lightboxItem.mediaType === 'image'" :src="lightboxItem.url" @click.stop
        class="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain" />

      <!-- Video -->
      <video v-else :src="lightboxItem.url" controls autoplay @click.stop
        class="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl" />

      <!-- Seuraava -->
      <button v-if="mediaItems.length > 1"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-10"
        @click.stop="lightboxNext">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- EXIF-paneeli (vain kuvat) -->
      <div
        v-if="lightboxItem.mediaType === 'image' && lightboxItem.exif && Object.keys(lightboxItem.exif).length"
        class="absolute bottom-10 left-1/2 -translate-x-1/2 w-max max-w-[90vw]
               bg-black/75 backdrop-blur-md rounded-2xl px-4 py-3 text-xs text-gray-300
               flex flex-wrap gap-x-4 gap-y-1"
        @click.stop>
        <span v-if="lightboxItem.exif.model" class="flex items-center gap-1">
          <Camera class="w-3 h-3 text-gray-500" />
          {{ lightboxItem.exif.make && !lightboxItem.exif.model?.startsWith(lightboxItem.exif.make)
            ? lightboxItem.exif.make + ' ' : '' }}{{ lightboxItem.exif.model }}
        </span>
        <span v-if="lightboxItem.exif.exposureTime" class="text-gray-400">{{ lightboxItem.exif.exposureTime }}</span>
        <span v-if="lightboxItem.exif.fNumber" class="text-gray-400">f/{{ lightboxItem.exif.fNumber }}</span>
        <span v-if="lightboxItem.exif.iso" class="text-gray-400">ISO {{ lightboxItem.exif.iso }}</span>
        <span v-if="lightboxItem.exif.focalLength" class="text-gray-400">
          {{ lightboxItem.exif.focalLength }}mm
          <span v-if="lightboxItem.exif.focalLength35">({{ lightboxItem.exif.focalLength35 }}mm)</span>
        </span>
        <span v-if="lightboxItem.exif.dateTaken" class="flex items-center gap-1">
          <Clock class="w-3 h-3 text-gray-500" />
          {{ new Date(lightboxItem.exif.dateTaken!).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' }) }}
        </span>
        <a v-if="lightboxItem.exif.latitude"
          :href="`https://maps.google.com/?q=${lightboxItem.exif.latitude},${lightboxItem.exif.longitude}`"
          target="_blank" rel="noopener"
          class="flex items-center gap-1 text-dpurple-400 hover:text-dpurple-300"
          @click.stop>
          <MapPin class="w-3 h-3" />
          {{ lightboxItem.exif.latitude!.toFixed(4) }}, {{ lightboxItem.exif.longitude!.toFixed(4) }}
        </a>
      </div>

      <!-- Laskuri -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-gray-500">
        {{ lightboxIdx + 1 }} / {{ mediaItems.length }}
      </div>
    </div>
  </Teleport>

  <!-- ── POISTA MEDIA ── -->
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
              <h3 class="text-sm font-bold text-white mb-1">Poistetaanko tiedosto?</h3>
              <p class="text-xs text-gray-500">Tätä ei voi peruuttaa.</p>
            </div>
          </div>
          <div v-if="deleteTarget?.mediaType === 'image'"
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

  <!-- ── POISTA KANSIO ── -->
  <Teleport to="body">
    <div v-if="deleteFolderTarget"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="deleteFolderTarget = null" />
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
              <h3 class="text-sm font-bold text-white mb-1">Poistetaanko kansio "{{ deleteFolderTarget?.name }}"?</h3>
              <p class="text-xs text-gray-500">Kaikki kansion sisältö poistetaan pysyvästi.</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="deleteFolderTarget = null"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white transition-all bg-transparent">
              Peruuta
            </button>
            <button @click="doDeleteFolder" :disabled="deletingFolder"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-sm font-medium border-0 bg-red-900/50 hover:bg-red-800/60
                     text-red-300 disabled:opacity-50 transition-all">
              <Trash2 class="w-3.5 h-3.5" />{{ deletingFolder ? 'Poistetaan...' : 'Poista' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── UUSI KANSIO ── -->
  <Teleport to="body">
    <div v-if="showNewFolder"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="showNewFolder = false" />
      <div class="relative w-full sm:max-w-sm bg-gray-950 border border-gray-800/60
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div class="h-1 w-full bg-gradient-to-r from-dpurple-900/60 via-dpurple-700/60 to-dpurple-900/60" />
        <div class="px-6 pt-6 pb-5">
          <h3 class="text-sm font-bold text-white mb-4">Uusi kansio</h3>
          <input
            v-model="newFolderName"
            type="text" placeholder="Kansion nimi"
            class="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-900 border border-gray-800
                   text-white placeholder-gray-700 focus:outline-none focus:border-dpurple-700
                   transition-all mb-4"
            @keyup.enter="createFolder"
            autofocus />
          <div class="flex gap-2">
            <button @click="showNewFolder = false; newFolderName = ''"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white transition-all bg-transparent">
              Peruuta
            </button>
            <button @click="createFolder" :disabled="creatingFolder || !newFolderName.trim()"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-sm font-medium border-0 bg-dpurple-900/60 hover:bg-dpurple-800/60
                     text-dpurple-300 disabled:opacity-50 transition-all">
              <Plus class="w-3.5 h-3.5" />{{ creatingFolder ? 'Luodaan...' : 'Luo kansio' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

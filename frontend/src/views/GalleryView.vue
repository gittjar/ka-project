<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import {
  Upload, Trash2, X, ImageOff, AlertTriangle,
  MapPin, Camera, Clock, FolderOpen, Plus, Play,
  ChevronRight, HardDrive, Pencil, Check, GripVertical,
  CheckSquare, Square, ArrowUpDown, ImagePlus, Star,
} from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  caption?: string;
  sortOrder?: number;
  carouselOrder?: number | null;
  exif?: ExifData;
}
interface UploadTask {
  name: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

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
const dragOver = ref(false);
const uploadTasks = ref<UploadTask[]>([]);
const showUploadDone = ref(false);
const uploadDoneTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const isUploading = computed(() => uploadTasks.value.some(t => t.status === 'uploading' || t.status === 'pending'));

// Lightbox
const lightboxItem = ref<MediaItem | null>(null);
const lightboxIdx = ref(0);
const lightboxInfoOpen = ref(true);

// Caption editing (in lightbox)
const editingCaption = ref(false);
const captionDraft = ref('');
const captionSaving = ref(false);
const captionInputRef = ref<HTMLTextAreaElement | null>(null);

// Delete single media
const deleteTarget = ref<MediaItem | null>(null);
const deleting = ref(false);

// Multi-select (admin)
const selectedIds = ref<Set<string>>(new Set());
const multiDeleteConfirm = ref(false);
const multiDeleting = ref(false);

// Drag-sort (admin)
const dragSortActive = ref(false);
const dragSrcIdx = ref<number | null>(null);
const dragOverIdx = ref<number | null>(null);
const dragOverFolder = ref<string | null>(null); // folder._id being hovered
const dropInsertIdx = ref<number | null>(null);  // insert-before index while dragging

// New folder
const showNewFolder = ref(false);
const newFolderName = ref('');
const creatingFolder = ref(false);

// Delete folder
const deleteFolderTarget = ref<FolderItem | null>(null);
const deletingFolder = ref(false);

// Sort (admin)
const sortMenuOpen = ref(false);
type SortMode = 'date-desc' | 'date-asc' | 'alpha';

// Carousel (admin)
const CAROUSEL_VIRTUAL_ID = '__carousel__';
const carouselIds = ref<Set<string>>(new Set());   // _id:t valituista
const inCarouselView = ref(false);                 // ollaanko virtuaalisessa carousel-kansiossa
const carouselSaving = ref(false);

// Upload error (non-task)
const uploadError = ref('');

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB';
  return b + ' B';
}
function canDelete(item: MediaItem): boolean {
  return auth.isAdmin || item.uploadedBy === auth.username;
}
function canEdit(item: MediaItem): boolean {
  return auth.isLoggedIn && (auth.isAdmin || item.uploadedBy === auth.username);
}

// ── Navigation ────────────────────────────────────────────────────────────────

async function loadFolder(folderId: string | null) {
  loading.value = true;
  loadError.value = '';
  selectedIds.value = new Set();
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
  // Click on root crumb while in carousel view → close carousel
  if (inCarouselView.value && idx === 0) {
    await closeCarouselView();
    return;
  }
  const crumb = breadcrumb.value[idx]!;
  breadcrumb.value = breadcrumb.value.slice(0, idx + 1);
  currentFolderId.value = crumb.id;
  await loadFolder(crumb.id);
}

// ── Upload with progress ──────────────────────────────────────────────────────

async function uploadFiles(files: FileList | File[]) {
  uploadError.value = '';
  const ACCEPTED = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|heic|heif|avif|mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
  const list = Array.from(files).filter(
    f => f.type.startsWith('image/') || f.type.startsWith('video/') || ACCEPTED.test(f.name)
  );
  if (!list.length) { uploadError.value = 'Ei tuettuja tiedostoja valittu'; return; }

  const tasks: UploadTask[] = list.map(f => ({ name: f.name, progress: 0, status: 'pending' }));
  uploadTasks.value = tasks;
  showUploadDone.value = false;

  for (let i = 0; i < list.length; i++) {
    const file = list[i]!;
    const task = tasks[i]!;
    task.status = 'uploading';
    task.progress = 0;
    uploadTasks.value = [...tasks];
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(
        `/images/upload?folder=${currentFolderId.value ?? 'null'}`,
        fd,
        {
          onUploadProgress: (e) => {
            task.progress = e.total ? Math.round((e.loaded / e.total) * 100) : 50;
            uploadTasks.value = [...tasks];
          },
        }
      );
      task.progress = 100;
      task.status = 'done';
      uploadTasks.value = [...tasks];
      mediaItems.value.unshift(data);
    } catch (e: any) {
      task.status = 'error';
      task.error = e.response?.data?.message || 'Lataus epäonnistui';
      uploadTasks.value = [...tasks];
    }
  }

  if (auth.isAdmin) await loadStorage();
  if (fileInputRef.value) fileInputRef.value.value = '';

  // Show done banner, then hide after 4s
  showUploadDone.value = true;
  if (uploadDoneTimer.value) clearTimeout(uploadDoneTimer.value);
  uploadDoneTimer.value = setTimeout(() => {
    showUploadDone.value = false;
    uploadTasks.value = [];
  }, 4000);
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
  editingCaption.value = false;
}
function lightboxPrev() {
  lightboxIdx.value = (lightboxIdx.value - 1 + mediaItems.value.length) % mediaItems.value.length;
  lightboxItem.value = mediaItems.value[lightboxIdx.value]!;
  editingCaption.value = false;
}
function lightboxNext() {
  lightboxIdx.value = (lightboxIdx.value + 1) % mediaItems.value.length;
  lightboxItem.value = mediaItems.value[lightboxIdx.value]!;
  editingCaption.value = false;
}
function closeLightbox() {
  lightboxItem.value = null;
  editingCaption.value = false;
}

function startEditCaption() {
  if (!lightboxItem.value) return;
  captionDraft.value = lightboxItem.value.caption ?? '';
  editingCaption.value = true;
  nextTick(() => captionInputRef.value?.focus());
}

async function saveCaption() {
  if (!lightboxItem.value) return;
  captionSaving.value = true;
  try {
    const { data } = await api.patch(`/images/media/${lightboxItem.value._id}`, {
      caption: captionDraft.value,
    });
    lightboxItem.value.caption = data.caption;
    const idx = mediaItems.value.findIndex(m => m._id === data._id);
    if (idx !== -1) mediaItems.value[idx]!.caption = data.caption;
    editingCaption.value = false;
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    captionSaving.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (editingCaption.value) {
    if (e.key === 'Escape') editingCaption.value = false;
    return;
  }
  if (lightboxItem.value) {
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
    if (e.key === 'Escape') closeLightbox();
  }
}

// ── Delete single ─────────────────────────────────────────────────────────────

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api.delete(`/images/media/${deleteTarget.value._id}`);
    mediaItems.value = mediaItems.value.filter(i => i._id !== deleteTarget.value!._id);
    selectedIds.value.delete(deleteTarget.value._id);
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

// ── Multi-delete (admin) ──────────────────────────────────────────────────────

function toggleSelect(id: string) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedIds.value = s;
}
function selectAll() {
  selectedIds.value = new Set(mediaItems.value.map(m => m._id));
}
function clearSelection() {
  selectedIds.value = new Set();
}

async function doMultiDelete() {
  multiDeleting.value = true;
  const ids = [...selectedIds.value];
  try {
    await Promise.all(ids.map(id => api.delete(`/images/media/${id}`)));
    mediaItems.value = mediaItems.value.filter(m => !ids.includes(m._id));
    selectedIds.value = new Set();
    multiDeleteConfirm.value = false;
    if (auth.isAdmin) await loadStorage();
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Monistpoisto epäonnistui';
  } finally {
    multiDeleting.value = false;
  }
}

// ── Drag-sort (admin) ─────────────────────────────────────────────────────────

type GridSlot = { type: 'item'; item: MediaItem; origIdx: number } | { type: 'drop' };
const gridSlots = computed<GridSlot[]>(() => {
  const slots: GridSlot[] = mediaItems.value.map((item, origIdx) => ({ type: 'item', item, origIdx }));
  const src = dragSrcIdx.value;
  const ins = dropInsertIdx.value;
  if (src === null || ins === null || ins === src || ins === src + 1) return slots;
  slots.splice(ins, 0, { type: 'drop' });
  return slots;
});

function onDragStart(e: DragEvent, idx: number) {
  if (!auth.isAdmin) return;
  dragSrcIdx.value = idx;
  e.dataTransfer!.effectAllowed = 'move';
}
function onDragOverItem(e: DragEvent, idx: number) {
  e.preventDefault();
  dragOverFolder.value = null;
  if (dragSrcIdx.value === null) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  dropInsertIdx.value = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
}
function onDragOverFolder(e: DragEvent, folderId: string) {
  e.preventDefault();
  dragOverFolder.value = folderId;
  dragOverIdx.value = null;
}
function onDragLeaveFolder() { dragOverFolder.value = null; }
function onDragEnd() {
  dragSrcIdx.value = null;
  dragOverIdx.value = null;
  dragOverFolder.value = null;
  dropInsertIdx.value = null;
}

async function onDropItem(e: DragEvent, _targetIdx: number) {
  e.preventDefault();
  const src = dragSrcIdx.value;
  const ins = dropInsertIdx.value;
  if (src === null || ins === null || ins === src || ins === src + 1) {
    onDragEnd(); return;
  }
  const items = [...mediaItems.value];
  const [moved] = items.splice(src, 1);
  const adjustedIns = ins > src ? ins - 1 : ins;
  items.splice(adjustedIns, 0, moved!);
  mediaItems.value = items;
  onDragEnd();
  await api.patch('/images/reorder', items.map((m, i) => ({ id: m._id, sortOrder: i })));
  items.forEach((m, i) => { m.sortOrder = i; });
}

async function onDropFolder(e: DragEvent, targetFolderId: string) {
  e.preventDefault();
  if (dragSrcIdx.value === null) { onDragEnd(); return; }
  const item = mediaItems.value[dragSrcIdx.value]!;
  mediaItems.value = mediaItems.value.filter((_, i) => i !== dragSrcIdx.value);
  onDragEnd();
  await api.patch(`/images/media/${item._id}`, { folderId: targetFolderId });
}

// ── Sort & persist (admin) ──────────────────────────────────────────────────

async function applySort(mode: SortMode) {
  sortMenuOpen.value = false;
  const items = [...mediaItems.value];
  if (mode === 'date-desc') {
    items.sort((a, b) => {
      const da = a.exif?.dateTaken ? new Date(a.exif.dateTaken).getTime() : new Date(a.createdAt).getTime();
      const db = b.exif?.dateTaken ? new Date(b.exif.dateTaken).getTime() : new Date(b.createdAt).getTime();
      return db - da;
    });
  } else if (mode === 'date-asc') {
    items.sort((a, b) => {
      const da = a.exif?.dateTaken ? new Date(a.exif.dateTaken).getTime() : new Date(a.createdAt).getTime();
      const db = b.exif?.dateTaken ? new Date(b.exif.dateTaken).getTime() : new Date(b.createdAt).getTime();
      return da - db;
    });
  } else {
    items.sort((a, b) =>
      (a.caption || a.blobName).toLowerCase().localeCompare(
        (b.caption || b.blobName).toLowerCase(), 'fi'
      )
    );
  }
  mediaItems.value = items;
  await api.patch('/images/reorder', items.map((m, i) => ({ id: m._id, sortOrder: i })));
  items.forEach((m, i) => { m.sortOrder = i; });
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

// ── Carousel (admin) ──────────────────────────────────────────────────────────

async function loadCarouselIds() {
  if (!auth.isAdmin) return;
  const { data } = await api.get('/images/carousel');
  carouselIds.value = new Set((data as MediaItem[]).map((m: MediaItem) => m._id));
}

function openCarouselView() {
  inCarouselView.value = true;
  breadcrumb.value = [{ id: null, name: 'Kuvat' }, { id: CAROUSEL_VIRTUAL_ID, name: 'Carousel' }];
  loadAllMediaForCarousel();
}

async function loadAllMediaForCarousel() {
  loading.value = true;
  try {
    // Hae kaikki mediat (root-tasolta; kaikki kansioista tulisi erikseen, mutta root on paras preview)
    const { data } = await api.get('/images?folder=null');
    mediaItems.value = data;
  } finally {
    loading.value = false;
  }
}

async function closeCarouselView() {
  inCarouselView.value = false;
  breadcrumb.value = [{ id: null, name: 'Kuvat' }];
  currentFolderId.value = null;
  await loadFolder(null);
}

async function toggleCarousel(item: MediaItem) {
  const newIds = [...carouselIds.value];
  const idx = newIds.indexOf(item._id);
  if (idx >= 0) {
    newIds.splice(idx, 1);
  } else {
    if (newIds.length >= 5) return;
    newIds.push(item._id);
  }
  carouselSaving.value = true;
  try {
    await api.put('/images/carousel', newIds);
    carouselIds.value = new Set(newIds);
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Carousel-tallennus epäonnistui';
  } finally {
    carouselSaving.value = false;
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
  if (auth.isAdmin) {
    await loadStorage();
    await loadCarouselIds();
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (uploadDoneTimer.value) clearTimeout(uploadDoneTimer.value);
});
</script>


<template>
  <div class="max-w-6xl mx-auto px-4 py-10">

    <!-- ── Upload progress panel ── -->
    <Transition name="slide-up">
      <div v-if="uploadTasks.length"
        class="fixed bottom-6 right-6 z-40 w-80 bg-gray-950 border border-gray-800/60
               rounded-2xl shadow-2xl overflow-hidden">
        <div class="px-4 pt-3 pb-1 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-300">
            {{ isUploading ? 'Ladataan...' : (showUploadDone ? 'Kaikki ladattu!' : 'Lataus') }}
          </span>
          <button @click="uploadTasks = []; showUploadDone = false"
            class="border-0 bg-transparent p-0.5 text-gray-600 hover:text-gray-400">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="px-4 pb-3 space-y-2 max-h-56 overflow-y-auto">
          <div v-for="task in uploadTasks" :key="task.name" class="text-xs">
            <div class="flex items-center justify-between mb-0.5 gap-1">
              <span class="truncate text-gray-400 max-w-[60%]">{{ task.name }}</span>
              <span v-if="task.status === 'done'" class="text-dgreen-400 font-medium shrink-0">✓ Valmis</span>
              <span v-else-if="task.status === 'error'" class="text-red-400 shrink-0">✗ Virhe</span>
              <span v-else class="text-gray-600 shrink-0">{{ task.progress }}%</span>
            </div>
            <div class="h-1 rounded-full bg-gray-800 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-200"
                :class="{
                  'bg-dgreen-600': task.status === 'done',
                  'bg-red-700': task.status === 'error',
                  'bg-dpurple-600': task.status === 'uploading',
                  'bg-gray-700': task.status === 'pending',
                }"
                :style="{ width: task.progress + '%' }" />
            </div>
            <p v-if="task.error" class="text-red-500 mt-0.5 text-[10px]">{{ task.error }}</p>
          </div>
        </div>
      </div>
    </Transition>

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
    <div class="flex items-center justify-between gap-3 flex-wrap mb-1">
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
      <div class="flex items-center gap-2">
        <input ref="fileInputRef" type="file"
          accept="image/*,video/*,.heic,.heif,.avif,.tiff,.tif,.bmp,.mov,.m4v,.mkv,.avi,.3gp"
          multiple class="hidden" @change="onFileChange" />
        <button v-if="auth.isAdmin" @click="showNewFolder = true"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600
                 bg-transparent transition-all">
          <Plus class="w-4 h-4" />Uusi kansio
        </button>
        <!-- Sort dropdown (admin, when there are media items) -->
        <div v-if="auth.isAdmin && mediaItems.length > 0" class="relative">
          <button @click.stop="sortMenuOpen = !sortMenuOpen"
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                   border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600
                   bg-transparent transition-all"
            :class="sortMenuOpen ? 'border-dpurple-700 text-dpurple-300' : ''">
            <ArrowUpDown class="w-4 h-4" />Järjestä
          </button>
          <!-- Backdrop -->
          <div v-if="sortMenuOpen" class="fixed inset-0 z-20" @click="sortMenuOpen = false" />
          <!-- Menu -->
          <div v-if="sortMenuOpen"
            class="absolute right-0 top-full mt-1.5 z-30 bg-gray-900 border border-gray-700/60
                   rounded-xl shadow-2xl overflow-hidden w-56 py-1">
            <button @click="applySort('date-desc')"
              class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800
                     hover:text-white border-0 bg-transparent flex items-center gap-2.5 transition-colors">
              <Clock class="w-3.5 h-3.5 text-gray-500" />
              Uusin ensin
              <span class="text-xs text-gray-600 ml-auto">oton päivä</span>
            </button>
            <button @click="applySort('date-asc')"
              class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800
                     hover:text-white border-0 bg-transparent flex items-center gap-2.5 transition-colors">
              <Clock class="w-3.5 h-3.5 text-gray-500" />
              Vanhin ensin
              <span class="text-xs text-gray-600 ml-auto">oton päivä</span>
            </button>
            <div class="my-1 border-t border-gray-800" />
            <button @click="applySort('alpha')"
              class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800
                     hover:text-white border-0 bg-transparent flex items-center gap-2.5 transition-colors">
              <span class="text-xs font-mono text-gray-500 w-3.5 text-center">A</span>
              Aakkosjärjestys
            </button>
          </div>
        </div>
        <!-- Multi-delete trigger (admin, selection mode) -->
        <template v-if="auth.isAdmin && selectedIds.size > 0">
          <button @click="selectAll"
            class="px-3 py-2 rounded-xl text-xs border border-gray-700 text-gray-400
                   hover:text-white bg-transparent transition-all">
            Valitse kaikki
          </button>
          <button @click="clearSelection"
            class="px-3 py-2 rounded-xl text-xs border border-gray-700 text-gray-400
                   hover:text-white bg-transparent transition-all">
            Poista valinta
          </button>
          <button @click="multiDeleteConfirm = true"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border-0
                   bg-red-900/50 hover:bg-red-800/60 text-red-300 transition-all">
            <Trash2 class="w-3.5 h-3.5" />Poista {{ selectedIds.size }}
          </button>
        </template>
        <button v-if="auth.isLoggedIn" @click="fileInputRef?.click()" :disabled="isUploading"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                 bg-dpurple-900/50 hover:bg-dpurple-800/50 border border-dpurple-800/50
                 text-dpurple-300 disabled:opacity-50 transition-all">
          <Upload class="w-4 h-4" />{{ isUploading ? 'Ladataan...' : 'Lisää' }}
        </button>
      </div>
    </div>
    <p class="text-xs text-gray-700 mb-4">{{ mediaItems.length }} tiedostoa</p>

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
      class="mb-6 border-2 border-dashed rounded-2xl px-6 py-6 text-center transition-all cursor-pointer"
      :class="dragOver
        ? 'border-dpurple-600 bg-dpurple-950/30'
        : 'border-gray-800 hover:border-gray-700 bg-transparent'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInputRef?.click()">
      <Upload class="w-5 h-5 mx-auto mb-1.5" :class="dragOver ? 'text-dpurple-400' : 'text-gray-700'" />
      <p class="text-xs" :class="dragOver ? 'text-dpurple-400' : 'text-gray-700'">
        Raahaa kuvia tai videoita tähän · JPG, PNG, WebP, HEIC, MP4, MOV · max 500 MB
      </p>
    </div>

    <!-- ── Lataus ── -->
    <div v-if="loading" class="text-gray-600 text-sm py-20 text-center">Ladataan...</div>
    <div v-else-if="loadError" class="text-red-500 text-sm py-20 text-center">{{ loadError }}</div>

    <template v-else>
      <!-- ── Kansioruudukko ── -->
      <div v-if="folders.length || (auth.isAdmin && !inCarouselView && currentFolderId === null)"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <!-- Virtuaalinen Carousel-kansio (admin, juuri root-tasolla) -->
        <div v-if="auth.isAdmin && !inCarouselView && currentFolderId === null"
          class="group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer
                 bg-gray-950 border transition-all"
          :class="carouselIds.size > 0
            ? 'border-yellow-700/60 hover:border-yellow-600'
            : 'border-gray-700/40 hover:border-gray-600'"
          @click="openCarouselView">
          <div class="relative shrink-0">
            <Star class="w-7 h-7" :class="carouselIds.size > 0 ? 'text-yellow-500' : 'text-gray-600'" />
            <span v-if="carouselIds.size > 0"
              class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-yellow-600 text-white
                     text-[9px] font-bold flex items-center justify-center">
              {{ carouselIds.size }}
            </span>
          </div>
          <div>
            <span class="text-sm font-medium text-white">Carousel</span>
            <p class="text-xs text-gray-600 mt-0.5">
              {{ carouselIds.size > 0 ? `${carouselIds.size}/5 kuvaa valittu` : 'Ei kuvia valittu' }}
            </p>
          </div>
        </div>
        <div
          v-for="folder in folders" :key="folder._id"
          class="group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer
                 bg-gray-950 border transition-all"
          :class="dragOverFolder === folder._id
            ? 'border-dpurple-600 bg-dpurple-950/30 scale-[1.02]'
            : 'border-gray-800/50 hover:border-gray-700'"
          @click="navigateInto(folder)"
          @dragover.prevent="auth.isAdmin && onDragOverFolder($event, folder._id)"
          @dragleave="onDragLeaveFolder"
          @drop.prevent="auth.isAdmin && onDropFolder($event, folder._id)">
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

      <!-- ── Carousel-näkymä (admin virtual folder) ── -->
      <template v-if="inCarouselView">
        <div class="mb-4 flex items-center gap-2">
          <p class="text-xs text-gray-600">
            Valitse max 5 kuvaa tai videota etusivun carouseliin.
            {{ carouselIds.size }}/5 valittu.
          </p>
          <span v-if="carouselSaving" class="text-xs text-yellow-500 ml-2">Tallennetaan...</span>
        </div>
        <!-- Carousel-ruudukko: kaikki mediat kautta gallerian (haettu root-tasolta = kaikki) -->
        <div v-if="!mediaItems.length" class="text-center py-16 text-gray-700">
          <Star class="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p class="text-sm">Ei kuvia galleriassa. Lataa ensin kuvia kansioihin.</p>
        </div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <div v-for="item in mediaItems" :key="item._id"
            class="group relative rounded-2xl overflow-hidden bg-gray-950 border transition-all cursor-pointer"
            :class="carouselIds.has(item._id)
              ? 'border-yellow-600 ring-2 ring-yellow-700/50'
              : 'border-gray-800/50 hover:border-gray-700'"
            @click="toggleCarousel(item)">
            <img v-if="item.mediaType === 'image'" :src="item.url"
              referrerpolicy="no-referrer"
              class="w-full block object-cover aspect-square transition-transform duration-300 group-hover:scale-[1.02]" />
            <template v-else>
              <video :src="item.url" preload="metadata" muted
                class="w-full block object-cover aspect-square" />
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                  <Play class="w-4 h-4 text-white ml-0.5" />
                </div>
              </div>
            </template>
            <!-- Valittu-badge -->
            <div v-if="carouselIds.has(item._id)"
              class="absolute top-2 right-2 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center
                     shadow-lg shadow-yellow-900/50">
              <Star class="w-4 h-4 text-black fill-black" />
            </div>
            <!-- Paikkanumero -->
            <div v-if="carouselIds.has(item._id)"
              class="absolute top-2 left-2 w-5 h-5 rounded-full bg-yellow-600 text-black text-[10px]
                     font-bold flex items-center justify-center">
              {{ [...carouselIds].indexOf(item._id) + 1 }}
            </div>
            <!-- Max-ilmoitus hover -->
            <div v-if="!carouselIds.has(item._id) && carouselIds.size >= 5"
              class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100
                     transition-opacity">
              <span class="text-xs text-gray-300 px-3 text-center">Max 5 kuvaa</span>
            </div>
            <!-- Caption -->
            <div v-if="item.caption"
              class="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-black/45 backdrop-blur-[2px]">
              <p class="text-[11px] text-white/90 truncate leading-tight">{{ item.caption }}</p>
            </div>
          </div>
        </div>
      </template>

      <!-- ── Tyhä tila ── -->
      <div v-if="!inCarouselView && !folders.length && !mediaItems.length"
        class="text-center py-20 text-gray-700">
        <ImageOff class="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p class="text-sm">Ei sisältöä vielä.</p>
        <p v-if="auth.isAdmin" class="text-xs mt-1 text-gray-800">Luo kansio tai lataa tiedostoja.</p>
      </div>

      <!-- ── Mediaruudukko ── -->
      <div v-if="!inCarouselView && mediaItems.length"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
        @dragover.prevent
        @drop.prevent="onDropItem($event, -1)">
        <template v-for="slot in gridSlots" :key="slot.type === 'drop' ? '__drop__' : slot.item._id">

          <!-- Drop-zone indicator -->
          <div v-if="slot.type === 'drop'"
            class="aspect-square rounded-2xl border-2 border-dashed border-green-500 bg-green-950/30
                   flex flex-col items-center justify-center gap-2"
            @dragover.prevent
            @drop.prevent="onDropItem($event, -1)">
            <ImagePlus class="w-10 h-10 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span class="text-xs text-green-400 font-semibold text-center leading-snug px-3">
              Pudota kuva tähän
            </span>
          </div>

          <!-- Normal item card -->
          <div v-else
            class="group relative rounded-2xl overflow-hidden bg-gray-950 border transition-all cursor-pointer"
            :class="[
              selectedIds.has(slot.item._id) ? 'border-dpurple-600 ring-1 ring-dpurple-700' : 'border-gray-800/50',
              dragSrcIdx === slot.origIdx ? 'opacity-40 scale-95' : '',
            ]"
            :draggable="auth.isAdmin"
            @dragstart="onDragStart($event, slot.origIdx)"
            @dragover.prevent="onDragOverItem($event, slot.origIdx)"
            @dragend="onDragEnd"
            @click="auth.isAdmin && selectedIds.size > 0 ? toggleSelect(slot.item._id) : openLightbox(slot.origIdx)">

          <!-- Kuva -->
          <img v-if="slot.item.mediaType === 'image'" :src="slot.item.url" :alt="slot.item.caption || slot.item.blobName"
            referrerpolicy="no-referrer"
            class="w-full block object-cover aspect-square transition-transform duration-300 group-hover:scale-[1.02]" />

          <!-- Video thumbnail -->
          <template v-else>
            <video :src="slot.item.url" preload="metadata" muted loop playsinline
              class="w-full block object-cover aspect-square"
              @mouseenter="($event.target as HTMLVideoElement).play()"
              @mouseleave="(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }" />
            <!-- Play icon: visible at rest, fades out while hovering so the video is unobstructed -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none
                        transition-opacity duration-200 group-hover:opacity-0">
              <div class="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <Play class="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
          </template>

          <!-- Admin drag handle hint -->
          <div v-if="auth.isAdmin"
            class="absolute top-2 left-2 opacity-0 group-hover:opacity-60 text-white pointer-events-none">
            <GripVertical class="w-4 h-4 drop-shadow" />
          </div>

          <!-- Checkbox (admin, multi-select) -->
          <div v-if="auth.isAdmin"
            class="absolute top-2 left-2 transition-all"
            :class="selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'">
            <div @click.stop="toggleSelect(slot.item._id)"
              class="w-5 h-5 rounded text-white cursor-pointer">
              <CheckSquare v-if="selectedIds.has(slot.item._id)" class="w-5 h-5 text-dpurple-400 drop-shadow" />
              <Square v-else class="w-5 h-5 text-white/70 drop-shadow" />
            </div>
          </div>

          <!-- Carousel star badge (admin) -->
          <div v-if="auth.isAdmin && carouselIds.has(slot.item._id)"
            class="absolute bottom-8 right-1.5 pointer-events-none">
            <Star class="w-4 h-4 text-yellow-400 fill-yellow-400 drop-shadow" />
          </div>

          <!-- Bottom caption bar -->
          <div v-if="slot.item.caption"
            class="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-black/45 backdrop-blur-[2px]">
            <p class="text-[11px] text-white/90 truncate leading-tight">{{ slot.item.caption }}</p>
          </div>

          <!-- Hover actions (delete / edit) -->
          <div class="absolute top-2 right-2 flex flex-col gap-1
                      opacity-0 group-hover:opacity-100 transition-all">
            <button v-if="canEdit(slot.item)"
              @click.stop="openLightbox(slot.origIdx); nextTick(startEditCaption)"
              class="p-1.5 rounded-lg bg-black/70 border-0 text-gray-400 hover:text-white hover:bg-black/90">
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button v-if="canDelete(slot.item)"
              @click.stop="deleteTarget = slot.item"
              class="p-1.5 rounded-lg bg-black/70 border-0 text-gray-400 hover:text-red-400 hover:bg-black/90">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          </div><!-- /item card -->
        </template>
      </div>
    </template>
  </div>

  <!-- ── LIGHTBOX ── -->
  <Teleport to="body">
    <div v-if="lightboxItem"
      class="fixed inset-0 z-50 bg-black/95 flex"
      @click="closeLightbox">

      <!-- Sulje -->
      <button class="absolute top-4 right-[308px] p-2 rounded-xl bg-white/10 hover:bg-white/20
                     text-white border-0 transition-all z-30" @click.stop="closeLightbox">
        <X class="w-5 h-5" />
      </button>

      <!-- Edellinen -->
      <button v-if="mediaItems.length > 1"
        class="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-20"
        @click.stop="lightboxPrev">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- Media area (flex-grow) -->
      <div class="flex-1 flex items-center justify-center p-4 min-w-0" @click.stop>
        <img v-if="lightboxItem.mediaType === 'image'" :src="lightboxItem.url"
          class="max-h-[92vh] max-w-full rounded-xl shadow-2xl object-contain" />
        <video v-else :src="lightboxItem.url" controls autoplay
          class="max-h-[92vh] max-w-full rounded-xl shadow-2xl" />
      </div>

      <!-- Seuraava -->
      <button v-if="mediaItems.length > 1"
        class="absolute right-[320px] top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-20"
        @click.stop="lightboxNext">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- ── Info panel (right sidebar) ── -->
      <div class="w-72 shrink-0 bg-gray-950/95 border-l border-gray-800/60 flex flex-col overflow-y-auto z-20"
        @click.stop>

        <!-- Caption section -->
        <div class="px-5 pt-5 pb-4 border-b border-gray-800/50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kuvateksti</span>
            <button v-if="canEdit(lightboxItem) && !editingCaption"
              @click="startEditCaption"
              class="p-1 rounded-lg border-0 bg-transparent text-gray-600 hover:text-gray-300 transition-all">
              <Pencil class="w-3.5 h-3.5" />
            </button>
          </div>
          <!-- View mode -->
          <p v-if="!editingCaption"
            class="text-sm text-gray-300 leading-relaxed min-h-[2.5rem]"
            :class="!lightboxItem.caption ? 'text-gray-700 italic' : ''">
            {{ lightboxItem.caption || 'Ei kuvatekstiä' }}
          </p>
          <!-- Edit mode -->
          <div v-else class="space-y-2">
            <textarea
              ref="captionInputRef"
              v-model="captionDraft"
              rows="3"
              maxlength="500"
              placeholder="Lisää kuvateksti..."
              class="w-full px-3 py-2 rounded-xl text-sm bg-gray-900 border border-gray-700
                     text-white placeholder-gray-700 focus:outline-none focus:border-dpurple-700
                     resize-none transition-all"
              @keydown.ctrl.enter="saveCaption"
              @keydown.escape="editingCaption = false" />
            <div class="flex gap-2">
              <button @click="editingCaption = false"
                class="flex-1 px-3 py-1.5 rounded-lg text-xs border border-gray-700
                       text-gray-400 hover:text-white bg-transparent transition-all">
                Peruuta
              </button>
              <button @click="saveCaption" :disabled="captionSaving"
                class="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg
                       text-xs border-0 bg-dpurple-900/60 hover:bg-dpurple-800/60
                       text-dpurple-300 disabled:opacity-50 transition-all">
                <Check class="w-3 h-3" />{{ captionSaving ? '...' : 'Tallenna' }}
              </button>
            </div>
            <p class="text-[10px] text-gray-700 text-right">Ctrl+Enter tallentaa</p>
          </div>
        </div>

        <!-- EXIF section (images only) -->
        <div v-if="lightboxItem.mediaType === 'image' && lightboxItem.exif"
          class="px-5 py-4 border-b border-gray-800/50 space-y-3">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Kameratiedot</span>

          <div v-if="lightboxItem.exif.model" class="flex items-start gap-2">
            <Camera class="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" />
            <span class="text-xs text-gray-300 leading-snug">
              {{ lightboxItem.exif.make && !lightboxItem.exif.model?.startsWith(lightboxItem.exif.make)
                ? lightboxItem.exif.make + ' ' : '' }}{{ lightboxItem.exif.model }}
            </span>
          </div>
          <div v-if="lightboxItem.exif.lens" class="text-xs text-gray-500 pl-5">{{ lightboxItem.exif.lens }}</div>

          <!-- Settings row -->
          <div class="flex flex-wrap gap-x-3 gap-y-1 pl-0">
            <span v-if="lightboxItem.exif.fNumber" class="text-xs text-gray-400">
              <span class="text-gray-600">f/</span>{{ lightboxItem.exif.fNumber }}
            </span>
            <span v-if="lightboxItem.exif.exposureTime" class="text-xs text-gray-400">
              {{ lightboxItem.exif.exposureTime }}
            </span>
            <span v-if="lightboxItem.exif.iso" class="text-xs text-gray-400">
              <span class="text-gray-600">ISO </span>{{ lightboxItem.exif.iso }}
            </span>
            <span v-if="lightboxItem.exif.focalLength" class="text-xs text-gray-400">
              {{ lightboxItem.exif.focalLength }}mm
              <span v-if="lightboxItem.exif.focalLength35" class="text-gray-600">
                ({{ lightboxItem.exif.focalLength35 }}mm eq.)
              </span>
            </span>
          </div>

          <!-- Dimensions -->
          <div v-if="lightboxItem.exif.width && lightboxItem.exif.height"
            class="text-xs text-gray-600">
            {{ lightboxItem.exif.width }} × {{ lightboxItem.exif.height }} px
          </div>

          <!-- Date -->
          <div v-if="lightboxItem.exif.dateTaken" class="flex items-center gap-2">
            <Clock class="w-3.5 h-3.5 text-gray-600 shrink-0" />
            <span class="text-xs text-gray-400">
              {{ new Date(lightboxItem.exif.dateTaken!).toLocaleString('fi-FI', { dateStyle:'medium', timeStyle:'short' }) }}
            </span>
          </div>

          <!-- GPS -->
          <div v-if="lightboxItem.exif.latitude" class="flex items-center gap-2">
            <MapPin class="w-3.5 h-3.5 text-gray-600 shrink-0" />
            <a :href="`https://maps.google.com/?q=${lightboxItem.exif.latitude},${lightboxItem.exif.longitude}`"
              target="_blank" rel="noopener"
              class="text-xs text-dpurple-400 hover:text-dpurple-300">
              {{ lightboxItem.exif.latitude!.toFixed(5) }}, {{ lightboxItem.exif.longitude!.toFixed(5) }}
            </a>
          </div>
        </div>

        <!-- Meta section -->
        <div class="px-5 py-4 space-y-2 text-xs text-gray-600">
          <div v-if="lightboxItem.uploadedBy">
            Ladannut <span class="text-gray-400">{{ lightboxItem.uploadedBy }}</span>
          </div>
          <div>{{ new Date(lightboxItem.createdAt).toLocaleString('fi-FI', { dateStyle:'medium', timeStyle:'short' }) }}</div>
          <div v-if="lightboxItem.fileSize">{{ fmtBytes(lightboxItem.fileSize) }}</div>
        </div>

        <!-- Actions -->
        <div class="mt-auto px-5 pb-5 pt-3 border-t border-gray-800/50 flex gap-2">
          <button v-if="canDelete(lightboxItem)"
            @click="deleteTarget = lightboxItem; closeLightbox()"
            class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                   text-xs border-0 bg-red-950/60 hover:bg-red-900/60 text-red-400 transition-all">
            <Trash2 class="w-3.5 h-3.5" />Poista
          </button>
        </div>

        <!-- Counter -->
        <div class="px-5 pb-4 text-xs text-gray-700 text-center">
          {{ lightboxIdx + 1 }} / {{ mediaItems.length }}
        </div>
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
          <p v-if="deleteTarget?.caption" class="text-xs text-gray-500 mb-4 italic">
            "{{ deleteTarget.caption }}"
          </p>
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

  <!-- ── POISTA USEITA (admin) ── -->
  <Teleport to="body">
    <div v-if="multiDeleteConfirm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="multiDeleteConfirm = false" />
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
              <h3 class="text-sm font-bold text-white mb-1">
                Poistetaanko {{ selectedIds.size }} tiedostoa?
              </h3>
              <p class="text-xs text-gray-500">Tätä ei voi peruuttaa.</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="multiDeleteConfirm = false"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white transition-all bg-transparent">
              Peruuta
            </button>
            <button @click="doMultiDelete" :disabled="multiDeleting"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-sm font-medium border-0 bg-red-900/50 hover:bg-red-800/60
                     text-red-300 disabled:opacity-50 transition-all">
              <Trash2 class="w-3.5 h-3.5" />{{ multiDeleting ? 'Poistetaan...' : 'Poista kaikki' }}
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
              <h3 class="text-sm font-bold text-white mb-1">
                Poistetaanko kansio "{{ deleteFolderTarget?.name }}"?
              </h3>
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
          <input v-model="newFolderName" type="text" placeholder="Kansion nimi"
            class="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-900 border border-gray-800
                   text-white placeholder-gray-700 focus:outline-none focus:border-dpurple-700
                   transition-all mb-4"
            @keyup.enter="createFolder" autofocus />
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

<style scoped>
.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(1.5rem);
}
</style>


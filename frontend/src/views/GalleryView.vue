<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Upload, Trash2, X, ImageOff, AlertTriangle,
  MapPin, Image, Clock, FolderOpen, Plus, Play,
  ChevronRight, HardDrive, Pencil, Check, GripVertical,
  CheckSquare, Square, ArrowUpDown, ImagePlus, Star, FileText, Download,
  Film, Eye, LayoutGrid, LayoutList, Link,
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
  description?: string;
  imageCount?: number;
  videoCount?: number;
  totalViews?: number;
  previewBlobName?: string | null;
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
  viewCount?: number;
  openedAt?: string[];
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

// Image fade-in tracking
const loadedImages = ref(new Set<string>());
function onImageLoaded(id: string) {
  loadedImages.value = new Set([...loadedImages.value, id]);
}
// 0–1: kuinka suuri osuus kuvista on ladattu selaimeen
const folderLoadProgress = computed(() => {
  const images = mediaItems.value.filter(m => m.mediaType === 'image');
  if (!images.length) return 1;
  return Math.min(1, loadedImages.value.size / images.length);
});
// Lasi näkyy kunnes kaikki ladattu tai API vielä lataa
const showFolderGlass = computed(() =>
  (loading.value && currentFolderId.value) ||
  (!loading.value && folderLoadProgress.value < 1 && mediaItems.value.length > 0)
);

// Lightbox
const lightboxItem = ref<MediaItem | null>(null);
const lightboxIdx = ref(0);
const mediaLoading = ref(false);
const mediaLoadMs = ref<number | null>(null);
const loadingElapsed = ref(0);
const videoBufferPct = ref<number | null>(null);
let _mediaLoadStart = 0;
let _loadingTimer: ReturnType<typeof setInterval> | null = null;

const THIRSTY_MSGS_3 = [
  'You are THIRSTY! You better go drink something.',
  'Kantojallu on vielä kaukana…',
  'Ladataan, wait a second ... \uD83C\uDF7A',
];
const THIRSTY_MSGS_6 = [
  'Mitä Neipoja teillä on hanassa?',
  'You are DEHYDRATED!',
  'Kuvien lataus on kuin viskin tislauksen odottamista – kärsivällisyys palkitaan.',
  '\uD83C\uDF7A Viinaa viinaa tsat tsat saa…',
];
const thirstyMsg3 = ref('');
const thirstyMsg6 = ref('');

function startMediaLoad() {
  mediaLoading.value = true;
  mediaLoadMs.value = null;
  loadingElapsed.value = 0;
  videoBufferPct.value = null;
  thirstyMsg3.value = '';
  thirstyMsg6.value = '';
  _mediaLoadStart = performance.now();
  if (_loadingTimer) clearInterval(_loadingTimer);
  _loadingTimer = setInterval(() => {
    loadingElapsed.value = Math.floor((performance.now() - _mediaLoadStart) / 1000);
    if (loadingElapsed.value === 3 && !thirstyMsg3.value)
      thirstyMsg3.value = THIRSTY_MSGS_3[Math.floor(Math.random() * THIRSTY_MSGS_3.length)]!;
    if (loadingElapsed.value === 6 && !thirstyMsg6.value)
      thirstyMsg6.value = THIRSTY_MSGS_6[Math.floor(Math.random() * THIRSTY_MSGS_6.length)]!;
  }, 500);
}
function onMediaLoaded() {
  mediaLoadMs.value = Math.round(performance.now() - _mediaLoadStart);
  mediaLoading.value = false;
  videoBufferPct.value = null;
  if (_loadingTimer) { clearInterval(_loadingTimer); _loadingTimer = null; }
}

function onVideoProgress(e: Event) {
  const v = e.target as HTMLVideoElement;
  if (v.buffered.length > 0 && v.duration > 0) {
    videoBufferPct.value = Math.round((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
  }
}

// Swipe (mobile lightbox)
let _swipeStartX = 0;
let _swipeStartY = 0;
function onSwipeStart(e: TouchEvent) {
  _swipeStartX = e.touches[0]!.clientX;
  _swipeStartY = e.touches[0]!.clientY;
}
function onSwipeEnd(e: TouchEvent) {
  const dx = e.changedTouches[0]!.clientX - _swipeStartX;
  const dy = e.changedTouches[0]!.clientY - _swipeStartY;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx < 0) lightboxNext();
  else lightboxPrev();
}

// Caption editing (in lightbox)
const editingCaption = ref(false);

// ── Minimap (Google Maps Embed) ───────────────────────────────────────────────
const mapsKey = ref<string | null>(null);
const showMap = ref(false);

// Reverse geocoding
const placeName = ref<string | null>(null);
const _placeCache = new Map<string, string>();

async function fetchPlaceName(lat: number, lng: number) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (_placeCache.has(key)) { placeName.value = _placeCache.get(key)!; return; }
  try {
    const { data } = await api.get<{ placeName: string | null }>(`/images/geocode?lat=${lat}&lng=${lng}`);
    if (data.placeName) {
      _placeCache.set(key, data.placeName);
      placeName.value = data.placeName;
    }
  } catch { /* ignore */ }
}
const mapDivRef = ref<HTMLElement | null>(null);
let _gmap: any = null;
let _gmapMarker: any = null;

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#444' }] },
];

function loadGoogleMapsScript(key: string): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

async function initGoogleMap(el: HTMLElement, lat: number, lng: number) {
  if (!mapsKey.value) return;
  await loadGoogleMapsScript(mapsKey.value);
  const G = (window as any).google.maps;
  if (_gmap) {
    _gmap.setCenter({ lat, lng });
    _gmapMarker?.setPosition({ lat, lng });
    return;
  }
  _gmap = new G.Map(el, {
    center: { lat, lng },
    zoom: 12,
    styles: DARK_MAP_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: G.ControlPosition.RIGHT_BOTTOM },
  });
  _gmapMarker = new G.Marker({
    position: { lat, lng },
    map: _gmap,
    icon: {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
      fillColor: '#22c55e',
      fillOpacity: 1,
      strokeColor: '#14532d',
      strokeWeight: 1.5,
      scale: 1.8,
      anchor: new G.Point(12, 22),
    },
  });
}

// Pääasiallinen trigger: kun div mountataan DOM:iin, alusta kartta
watch(mapDivRef, async (el) => {
  if (!el) return;
  const lat = lightboxItem.value?.exif?.latitude;
  const lng = lightboxItem.value?.exif?.longitude;
  if (lat && lng) await initGoogleMap(el, lat, lng);
});

function toggleMap() {
  showMap.value = !showMap.value;
  if (!showMap.value) {
    _gmap = null;
    _gmapMarker = null;
  }
}

// Päivitä kartta kun kuva vaihtuu
watch(lightboxItem, (item) => {
  placeName.value = null;
  if (!item || !item.exif?.latitude) { showMap.value = false; _gmap = null; _gmapMarker = null; return; }
  if (showMap.value && _gmap) {
    _gmap.setCenter({ lat: item.exif.latitude, lng: item.exif.longitude });
    _gmapMarker?.setPosition({ lat: item.exif.latitude, lng: item.exif.longitude });
  }
  fetchPlaceName(item.exif.latitude, item.exif.longitude!);
});
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
const dragSrcIdx = ref<number | null>(null);
const dragOverIdx = ref<number | null>(null);
const dragOverFolder = ref<string | null>(null); // folder._id being hovered
const dropInsertIdx = ref<number | null>(null);  // insert-before index while dragging

// New folder
const showNewFolder = ref(false);
const newFolderName = ref('');
const creatingFolder = ref(false);

// Folder description / story (admin)
const storyModalOpen = ref(false);
const storyFolderTarget = ref<FolderItem | null>(null);
const storyDraft = ref('');
const storySaving = ref(false);

// Current folder (for showing description inside folder view)
const currentFolder = ref<FolderItem | null>(null);

// Folder view mode (card / list)
const folderViewMode = ref<'card' | 'list'>(
  (localStorage.getItem('gallery_folder_view') as 'card' | 'list') || 'card'
);
function setFolderViewMode(mode: 'card' | 'list') {
  folderViewMode.value = mode;
  localStorage.setItem('gallery_folder_view', mode);
}

// Delete folder
const deleteFolderTarget = ref<FolderItem | null>(null);
const deletingFolder = ref(false);

// Rename folder
const renameFolderTarget = ref<FolderItem | null>(null);
const renameDraft = ref('');
const renaming = ref(false);
const renameInputRef = ref<HTMLInputElement | null>(null);

// Sort (admin — persists to server)
type SortMode = 'date-desc' | 'date-asc' | 'alpha';

// Sort (user — local only)
const userSortMenuOpen = ref(false);
type UserSortMode = 'default' | 'date-desc' | 'date-asc' | 'views-desc' | 'views-asc';
const userSortMode = ref<UserSortMode>('default');

// Carousel (admin)
const CAROUSEL_VIRTUAL_ID = '__carousel__';
const inCarouselView = ref(false);
const carouselIds = ref<Set<string>>(new Set());   // _id:t valituista
const carouselSaving = ref(false);
const carouselFullMsg = ref(false);

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
// Muodostaa proxy-URLin joka piilottaa Azure-domainin: /kuvat/{kansio}/{blobName}?t=<jwt>
// Tuotannossa VITE_MEDIA_URL=https://ka-project-backend.onrender.com
const MEDIA_BASE = (import.meta.env.VITE_MEDIA_URL ?? '') + '/kuvat';
function imgUrl(item: { blobName: string }): string {
  const folder = currentFolder.value?.name;
  const t = auth.token ? `?t=${auth.token}` : '';
  return folder
    ? `${MEDIA_BASE}/${encodeURIComponent(folder)}/${item.blobName}${t}`
    : `${MEDIA_BASE}/${item.blobName}${t}`;
}
function folderPreviewUrl(folder: FolderItem): string {
  if (!folder.previewBlobName) return '';
  const t = auth.token ? `?t=${auth.token}` : '';
  return `${MEDIA_BASE}/${encodeURIComponent(folder.name)}/${folder.previewBlobName}${t}`;
}

// download-attribuutti ei toimi cross-origin URL:ille → fetch + blob URL
async function downloadItem(item: MediaItem) {
  try {
    const url = imgUrl(item);
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = item.blobName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(imgUrl(item), '_blank');
  }
}

const copyLinkDone = ref(false);
const copyLinkError = ref(false);
async function copyLink(item: MediaItem) {
  try {
    const { data } = await api.post('/images/share', {
      blobName: item.blobName,
      folderId: currentFolderId.value || null,
    });
    const url = `${window.location.origin}/jaa/${data.token}`;
    await navigator.clipboard.writeText(url);
    copyLinkDone.value = true;
    setTimeout(() => { copyLinkDone.value = false; }, 2000);
  } catch {
    copyLinkError.value = true;
    setTimeout(() => { copyLinkError.value = false; }, 2000);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

async function loadFolder(folderId: string | null) {
  loading.value = true;
  loadedImages.value = new Set();
  loadError.value = '';
  selectedIds.value = new Set();
  userSortMode.value = 'default';
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
  currentFolder.value = folder;
  breadcrumb.value.push({ id: folder._id, name: folder.name });
  await loadFolder(folder._id);
}

async function navigateTo(idx: number) {
  const crumb = breadcrumb.value[idx]!;
  breadcrumb.value = breadcrumb.value.slice(0, idx + 1);
  inCarouselView.value = false;
  const folderId = crumb.id === CAROUSEL_VIRTUAL_ID ? null : crumb.id;
  currentFolderId.value = folderId;
  currentFolder.value = null;
  await loadFolder(folderId);
}

async function openCarouselView() {
  loading.value = true;
  loadedImages.value = new Set();
  loadError.value = '';
  selectedIds.value = new Set();
  try {
    const { data } = await api.get('/images/carousel');
    carouselIds.value = new Set((data as MediaItem[]).map((m: MediaItem) => m._id));
    mediaItems.value = data;
    folders.value = [];
  } catch {
    loadError.value = 'Carousel-kuvien lataus epäonnistui';
  } finally {
    loading.value = false;
  }
  inCarouselView.value = true;
  breadcrumb.value.push({ id: CAROUSEL_VIRTUAL_ID, name: 'Carousel kuvat' });
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

async function trackView(item: MediaItem) {
  if (!auth.isLoggedIn) return;
  try {
    const { data } = await api.post(`/images/media/${item._id}/view`);
    item.viewCount = data.viewCount;
    item.openedAt  = data.openedAt;
  } catch { /* ignore */ }
}

function openLightbox(idx: number) {
  lightboxIdx.value = idx;
  lightboxItem.value = mediaItems.value[idx]!;
  editingCaption.value = false;
  startMediaLoad();
  trackView(lightboxItem.value);
}
function lightboxPrev() {
  lightboxIdx.value = (lightboxIdx.value - 1 + mediaItems.value.length) % mediaItems.value.length;
  lightboxItem.value = mediaItems.value[lightboxIdx.value]!;
  editingCaption.value = false;
  startMediaLoad();
  trackView(lightboxItem.value);
}
function lightboxNext() {
  lightboxIdx.value = (lightboxIdx.value + 1) % mediaItems.value.length;
  lightboxItem.value = mediaItems.value[lightboxIdx.value]!;
  editingCaption.value = false;
  startMediaLoad();
  trackView(lightboxItem.value);
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

// ── User sort (local, non-persisting) ──────────────────────────────────────

const displayedMedia = computed<MediaItem[]>(() => {
  const items = [...mediaItems.value];
  if (userSortMode.value === 'date-desc') {
    return items.sort((a, b) => {
      const da = a.exif?.dateTaken ? new Date(a.exif.dateTaken).getTime() : new Date(a.createdAt).getTime();
      const db = b.exif?.dateTaken ? new Date(b.exif.dateTaken).getTime() : new Date(b.createdAt).getTime();
      return db - da;
    });
  }
  if (userSortMode.value === 'date-asc') {
    return items.sort((a, b) => {
      const da = a.exif?.dateTaken ? new Date(a.exif.dateTaken).getTime() : new Date(a.createdAt).getTime();
      const db = b.exif?.dateTaken ? new Date(b.exif.dateTaken).getTime() : new Date(b.createdAt).getTime();
      return da - db;
    });
  }
  if (userSortMode.value === 'views-desc') {
    return items.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
  }
  if (userSortMode.value === 'views-asc') {
    return items.sort((a, b) => (a.viewCount ?? 0) - (b.viewCount ?? 0));
  }
  return items;
});

// ── Drag-sort (admin) ─────────────────────────────────────────────────────────

type GridSlot = { type: 'item'; item: MediaItem; origIdx: number } | { type: 'drop' };
const gridSlots = computed<GridSlot[]>(() => {
  const slots: GridSlot[] = displayedMedia.value.map((item) => {
    const origIdx = mediaItems.value.indexOf(item);
    return { type: 'item', item, origIdx };
  });
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
  if (inCarouselView.value) {
    // Carousel: tallenna carouselOrder-kenttään
    const ids = items.map(m => m._id);
    const { data } = await api.put('/images/carousel', ids);
    carouselIds.value = new Set((data as MediaItem[]).map((m: MediaItem) => m._id));
    mediaItems.value = data;
  } else {
    await api.patch('/images/reorder', items.map((m, i) => ({ id: m._id, sortOrder: i })));
    items.forEach((m, i) => { m.sortOrder = i; });
  }
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

async function doRenameFolder() {
  if (!renameFolderTarget.value || !renameDraft.value.trim()) return;
  renaming.value = true;
  try {
    const { data } = await api.patch(`/images/folders/${renameFolderTarget.value._id}`, { name: renameDraft.value.trim() });
    const idx = folders.value.findIndex(f => f._id === renameFolderTarget.value!._id);
    if (idx !== -1) folders.value[idx]!.name = data.name;
    renameFolderTarget.value = null;
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Uudelleennimeäminen epäonnistui';
  } finally {
    renaming.value = false;
  }
}

async function saveDescription() {
  if (!storyFolderTarget.value) return;
  storySaving.value = true;
  try {
    const { data } = await api.patch(`/images/folders/${storyFolderTarget.value._id}`, {
      description: storyDraft.value,
    });
    const idx = folders.value.findIndex(f => f._id === storyFolderTarget.value!._id);
    if (idx !== -1) folders.value[idx]!.description = data.description;
    if (currentFolder.value?._id === storyFolderTarget.value._id) {
      currentFolder.value.description = data.description;
    }
    storyModalOpen.value = false;
    storyFolderTarget.value = null;
  } catch (e: any) {
    uploadError.value = e.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    storySaving.value = false;
  }
}

// ── Carousel (admin) ──────────────────────────────────────────────────────────

async function loadCarouselIds() {
  if (!auth.isAdmin) return;
  const { data } = await api.get('/images/carousel');
  carouselIds.value = new Set((data as MediaItem[]).map((m: MediaItem) => m._id));
}

async function toggleCarousel(item: MediaItem) {
  const newIds = [...carouselIds.value];
  const idx = newIds.indexOf(item._id);
  if (idx >= 0) {
    newIds.splice(idx, 1);
  } else {
    if (newIds.length >= 5) {
      carouselFullMsg.value = true;
      setTimeout(() => { carouselFullMsg.value = false; }, 3000);
      return;
    }
    newIds.push(item._id);
  }
  carouselSaving.value = true;
  try {
    const { data } = await api.put('/images/carousel', newIds);
    carouselIds.value = new Set((data as MediaItem[]).map((m: MediaItem) => m._id));
    if (inCarouselView.value) {
      mediaItems.value = data;
      if (lightboxItem.value && !carouselIds.value.has(lightboxItem.value._id)) {
        closeLightbox();
      }
    }
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
  // Hae Google Maps -avain backendiltä
  api.get('/config').then(r => { mapsKey.value = r.data.googleMapsKey || null; }).catch(() => {});

  window.addEventListener('keydown', onKeydown);

  // Syvälinkki: /jaa/:token navigoi tähän ?folder=&img= jälkeen (SharedView)
  const route = useRoute();
  const router = useRouter();
  const deepFolder = route.query.folder as string | undefined;
  const deepImg = route.query.img as string | undefined;

  // Ei kirjautunut + syvälinkki → login (Vue Router enkoodaa redirect-arvon oikein)
  if ((deepFolder || deepImg) && !auth.isLoggedIn) {
    router.replace({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }

  if (deepFolder) {
    try {
      const { data: folderData } = await api.get(`/images/folders/${deepFolder}`);
      currentFolderId.value = folderData._id;
      currentFolder.value = folderData;
      breadcrumb.value = [{ id: null, name: 'Kuvat' }, { id: folderData._id, name: folderData.name }];
      await loadFolder(deepFolder);
    } catch {
      await loadFolder(null);
    }
  } else {
    await loadFolder(null);
  }

  if (deepImg) {
    await nextTick();
    const idx = mediaItems.value.findIndex(m => m.blobName === deepImg);
    if (idx !== -1) openLightbox(idx);
  }

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

    <!-- ── Kirjautumisportti ── -->
    <div v-if="!auth.isLoggedIn" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 rounded-2xl bg-dpurple-900/40 border border-dpurple-800/40
                  flex items-center justify-center mb-6">
        <ImageOff class="w-8 h-8 text-dpurple-500/60" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">Kuvakokoelma — vain jäsenille</h2>
      <p class="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
        Kuvakokoelmat ovat nähtävissä vain kirjautuneille jäsenille.
        Mikäli haluat käyttöoikeudet, ole yhteydessä killan mestareihin
        <span class="text-dpurple-400 font-medium">BatMUD-pelissä</span>
        tai täytä hakemuslomake alla.
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <RouterLink to="/login"
          class="px-5 py-2.5 rounded-xl bg-dpurple-700 hover:bg-dpurple-600
                 text-white text-sm font-medium transition-colors">
          Kirjaudu sisään
        </RouterLink>
        <RouterLink to="/hakemus"
          class="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800
                 border border-gray-700 text-gray-300 text-sm font-medium transition-colors">
          Täytä hakemuslomake
        </RouterLink>
      </div>
    </div>

    <template v-else>

    <!-- ── Sticky breadcrumb ribbon (shown only when inside a folder) ── -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2">
      <div v-if="breadcrumb.length > 1"
        class="sticky top-14 z-30 pt-2 pb-1 pointer-events-none">
        <nav class="inline-flex items-center gap-0.5 px-3 py-1 rounded-full
                    bg-gray-900/90 backdrop-blur-sm border border-gray-800/60
                    pointer-events-auto">
          <button
            v-for="(crumb, i) in breadcrumb" :key="i"
            @click="i < breadcrumb.length - 1 && navigateTo(i)"
            class="flex items-center gap-0.5 text-xs border-0 bg-transparent p-0 shrink-0 transition-colors"
            :class="i === breadcrumb.length - 1
              ? 'text-white font-semibold cursor-default'
              : 'text-gray-500 hover:text-gray-300 cursor-pointer'">
            <ChevronRight v-if="i > 0" class="w-3 h-3 text-gray-700 shrink-0" />
            {{ crumb.name }}
          </button>
        </nav>
      </div>
    </Transition>

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

    <!-- ── Otsikko ja toiminnot ── -->
    <div class="flex items-center justify-between gap-3 flex-wrap mb-1">
      <div class="flex items-center gap-2 flex-wrap">
        <input ref="fileInputRef" type="file"
          accept="image/*,video/*,.heic,.heif,.avif,.tiff,.tif,.bmp,.mov,.m4v,.mkv,.avi,.3gp"
          multiple class="hidden" @change="onFileChange" />
        <button v-if="auth.isAdmin" @click="showNewFolder = true"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600
                 bg-transparent transition-all">
          <Plus class="w-4 h-4" />Uusi kansio
        </button>
        <!-- Sort dropdown — user: local only; admin: local + persist to server -->
        <div v-if="auth.isLoggedIn && currentFolderId && mediaItems.length > 0" class="relative">
          <button @click.stop="userSortMenuOpen = !userSortMenuOpen"
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                   border transition-all bg-transparent"
            :class="userSortMode !== 'default'
              ? 'border-dgreen-700 text-dgreen-300 hover:border-dgreen-600'
              : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'">
            <ArrowUpDown class="w-4 h-4" />
            <span>{{ userSortMode === 'date-desc' ? 'Uusin' : userSortMode === 'date-asc' ? 'Vanhin' : userSortMode === 'views-desc' ? 'Katsotuin' : userSortMode === 'views-asc' ? 'Vähiten' : 'Järjestys' }}</span>
          </button>
          <div v-if="userSortMenuOpen" class="fixed inset-0 z-20" @click="userSortMenuOpen = false" />
          <div v-if="userSortMenuOpen"
            class="absolute right-0 top-full mt-1.5 z-30 bg-gray-900 border border-gray-700/60
                   rounded-xl shadow-2xl overflow-hidden w-56 py-1">
            <button @click="userSortMode = 'default'; userSortMenuOpen = false"
              class="w-full text-left px-4 py-2.5 text-sm border-0 bg-transparent flex items-center gap-2.5 transition-colors"
              :class="userSortMode === 'default' ? 'text-dgreen-300' : 'text-gray-300 hover:bg-gray-800 hover:text-white'">
              <ArrowUpDown class="w-3.5 h-3.5 text-gray-500" />
              Oletusjärjestys
            </button>
            <div class="my-1 border-t border-gray-800" />
            <button @click="userSortMode = 'date-desc'; userSortMenuOpen = false"
              class="w-full text-left px-4 py-2.5 text-sm border-0 bg-transparent flex items-center gap-2.5 transition-colors"
              :class="userSortMode === 'date-desc' ? 'text-dgreen-300' : 'text-gray-300 hover:bg-gray-800 hover:text-white'">
              <Clock class="w-3.5 h-3.5 text-gray-500" />
              Uusin ensin
            </button>
            <button @click="userSortMode = 'date-asc'; userSortMenuOpen = false"
              class="w-full text-left px-4 py-2.5 text-sm border-0 bg-transparent flex items-center gap-2.5 transition-colors"
              :class="userSortMode === 'date-asc' ? 'text-dgreen-300' : 'text-gray-300 hover:bg-gray-800 hover:text-white'">
              <Clock class="w-3.5 h-3.5 text-gray-500" />
              Vanhin ensin
            </button>
            <div class="my-1 border-t border-gray-800" />
            <button @click="userSortMode = 'views-desc'; userSortMenuOpen = false"
              class="w-full text-left px-4 py-2.5 text-sm border-0 bg-transparent flex items-center gap-2.5 transition-colors"
              :class="userSortMode === 'views-desc' ? 'text-dgreen-300' : 'text-gray-300 hover:bg-gray-800 hover:text-white'">
              <Eye class="w-3.5 h-3.5 text-gray-500" />
              Eniten katsottu
            </button>
            <button @click="userSortMode = 'views-asc'; userSortMenuOpen = false"
              class="w-full text-left px-4 py-2.5 text-sm border-0 bg-transparent flex items-center gap-2.5 transition-colors"
              :class="userSortMode === 'views-asc' ? 'text-dgreen-300' : 'text-gray-300 hover:bg-gray-800 hover:text-white'">
              <Eye class="w-3.5 h-3.5 text-gray-500" />
              Vähiten katsottu
            </button>
            <!-- Admin-osio: tallenna järjestys palvelimelle -->
            <template v-if="auth.isAdmin">
              <div class="my-1 border-t border-gray-800" />
              <p class="px-4 pt-1.5 pb-0.5 text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Tallenna järjestys</p>
              <button @click="applySort('date-desc'); userSortMenuOpen = false"
                class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800
                       hover:text-white border-0 bg-transparent flex items-center gap-2.5 transition-colors">
                <Clock class="w-3.5 h-3.5 text-gray-500" />
                Uusin ensin
                <span class="text-xs text-gray-600 ml-auto">tallentuu</span>
              </button>
              <button @click="applySort('date-asc'); userSortMenuOpen = false"
                class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800
                       hover:text-white border-0 bg-transparent flex items-center gap-2.5 transition-colors">
                <Clock class="w-3.5 h-3.5 text-gray-500" />
                Vanhin ensin
                <span class="text-xs text-gray-600 ml-auto">tallentuu</span>
              </button>
              <button @click="applySort('alpha'); userSortMenuOpen = false"
                class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800
                       hover:text-white border-0 bg-transparent flex items-center gap-2.5 transition-colors">
                <span class="text-xs font-mono text-gray-500 w-3.5 text-center">A</span>
                Aakkosjärjestys
                <span class="text-xs text-gray-600 ml-auto">tallentuu</span>
              </button>
            </template>
          </div>
        </div>
        <!-- Multi-delete trigger (admin, selection mode, not in carousel view) -->
        <template v-if="auth.isAdmin && selectedIds.size > 0 && !inCarouselView">
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
      <Upload class="w-5 h-5 mx-auto mb-1.5" :class="dragOver ? 'text-dpurple-400' : 'text-gray-600'" />
      <p class="text-xs" :class="dragOver ? 'text-dpurple-400' : 'text-gray-500'">
        Raahaa kuvia tai videoita tähän · JPG, PNG, WebP, HEIC, MP4, MOV · max 500 MB
      </p>
    </div>

    <!-- ── Disclaimer (kansion sisällä, kirjautunut) ── -->
    <div v-if="currentFolderId && auth.isLoggedIn && !loading"
      class="mb-5 flex items-start gap-2 text-[11px] text-gray-600 leading-relaxed px-1">
      <AlertTriangle class="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-700" />
      <span>
        Lataamasi kuvat ja videot tallennetaan tähän kansioon ja ovat nähtävissä kaikille
        kirjautuneille jäsenille. Lataa vain tähän tapahtumaan liittyvää materiaalia.
        Ylläpidolla on oikeus poistaa sinne kuulumaton tai sopimaton sisältö.
      </span>
    </div>

    <!-- ── Kuvaukset kansiolle ── -->
    <div v-if="currentFolder?.description && !loading"
      class="mb-6 p-4 rounded-2xl bg-gray-950 border border-gray-800/50 flex items-start gap-3">
      <FileText class="w-4 h-4 text-dpurple-500/60 shrink-0 mt-0.5" />
      <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{{ currentFolder.description }}</p>
      <button v-if="auth.isAdmin"
        @click="storyFolderTarget = currentFolder; storyDraft = currentFolder.description ?? ''; storyModalOpen = true"
        class="ml-auto shrink-0 p-1 rounded-lg border-0 bg-transparent text-gray-700 hover:text-dpurple-400 transition-colors">
        <Pencil class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- ── Lataus ── -->
    <div v-if="loading" class="text-gray-600 text-sm py-20 text-center">Ladataan...</div>
    <div v-else-if="loadError" class="text-red-500 text-sm py-20 text-center">{{ loadError }}</div>

    <template v-else>
      <!-- ── Kansioruudukko (+ Carousel-virtuaalikansio admin-juuressa) ── -->
      <div v-if="folders.length || (auth.isAdmin && !currentFolderId && !inCarouselView)" class="mb-6">

        <!-- Otsikkorivi: kansioiden määrä + näkymävalitsin -->
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-gray-600">{{ folders.length }} kansiota</span>
          <div class="flex items-center gap-0.5 bg-gray-900 rounded-lg p-0.5 border border-gray-800/60">
            <button @click="setFolderViewMode('card')"
              class="p-1.5 rounded-md transition-all border-0"
              :class="folderViewMode === 'card' ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-400'">
              <LayoutGrid class="w-3.5 h-3.5" />
            </button>
            <button @click="setFolderViewMode('list')"
              class="p-1.5 rounded-md transition-all border-0"
              :class="folderViewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-400'">
              <LayoutList class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- ── KORTTINÄKYMÄ ── -->
        <div v-if="folderViewMode === 'card'"
          class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">

          <!-- Carousel virtual folder card -->
          <div v-if="auth.isAdmin && !currentFolderId && !inCarouselView"
            class="group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer
                   bg-gray-950 border border-gray-800/50 hover:border-gray-700 transition-all"
            @click="openCarouselView">
            <Star class="w-7 h-7 text-yellow-500/70 shrink-0 fill-yellow-500/20" />
            <div class="min-w-0">
              <span class="text-sm font-medium text-white truncate block">Carousel kuvat</span>
              <span class="text-xs text-gray-600">{{ carouselIds.size }} / 5</span>
            </div>
          </div>

          <!-- Kansiokortit -->
          <div
            v-for="folder in folders" :key="folder._id"
            class="group relative rounded-2xl overflow-hidden border transition-all flex flex-col"
            :class="dragOverFolder === folder._id
              ? 'border-dpurple-600 scale-[1.02]'
              : 'border-gray-800/50 hover:border-gray-700'"
            @dragover.prevent="auth.isAdmin && onDragOverFolder($event, folder._id)"
            @dragleave="onDragLeaveFolder"
            @drop.prevent="auth.isAdmin && onDropFolder($event, folder._id)">

            <!-- Esikatselu + nimi -->
            <div class="aspect-video relative cursor-pointer shrink-0" @click="navigateInto(folder)">
              <img v-if="folder.previewBlobName" :src="folderPreviewUrl(folder)"
                crossorigin="anonymous" class="absolute inset-0 w-full h-full object-cover" />
              <div v-else class="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <FolderOpen class="w-10 h-10 text-gray-700" />
              </div>
              <!-- Gradient overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <!-- Nimi + tilastot -->
              <div class="absolute bottom-0 left-0 right-0 px-3 py-2.5 flex flex-col gap-1.5">
                <p class="inline-block max-w-full truncate text-[15px] font-semibold text-gray-200
                           bg-black/65 backdrop-blur-sm px-3 py-1 rounded-full leading-tight self-start">{{ folder.name }}</p>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span v-if="folder.imageCount" class="flex items-center gap-1 text-[10px] text-gray-300
                               bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    <Image class="w-2.5 h-2.5" />{{ folder.imageCount }}
                  </span>
                  <span v-if="folder.videoCount" class="flex items-center gap-1 text-[10px] text-gray-300
                               bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    <Film class="w-2.5 h-2.5" />{{ folder.videoCount }}
                  </span>
                  <span v-if="folder.totalViews" class="flex items-center gap-1 text-[10px] text-gray-300
                               bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    <Eye class="w-2.5 h-2.5" />{{ folder.totalViews }}
                  </span>
                  <span v-if="!folder.imageCount && !folder.videoCount"
                    class="text-[10px] text-gray-500 bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full">Tyhjä</span>
                </div>
              </div>
            </div>

            <!-- Kuvaus / tarina — näkyy kaikille, venyttää kortin tasaiseksi -->
            <div
              class="flex-1 px-3 py-2.5 bg-gray-950/90 border-t border-gray-800/40 cursor-pointer"
              @click="navigateInto(folder)">
              <p v-if="folder.description"
                class="text-xs text-gray-400 leading-relaxed line-clamp-3">{{ folder.description }}</p>
              <p v-else class="text-xs text-gray-700 italic">Ei tarinaa</p>
            </div>

            <!-- Admin-toiminnot -->
            <div v-if="auth.isAdmin" class="flex gap-3 px-3 py-2 bg-gray-950 border-t border-gray-800/40">
              <button
                @click.stop="renameFolderTarget = folder; renameDraft = folder.name; nextTick(() => renameInputRef?.focus())"
                class="text-xs text-gray-600 hover:text-gray-300 border-0 bg-transparent transition-colors p-0 leading-none">
                muokkaa
              </button>
              <button
                @click.stop="storyFolderTarget = folder; storyDraft = folder.description ?? ''; storyModalOpen = true"
                class="flex items-center gap-1 text-xs border-0 bg-transparent transition-colors p-0 leading-none"
                :class="folder.description ? 'text-dpurple-500 hover:text-dpurple-300' : 'text-gray-600 hover:text-gray-300'">
                <FileText class="w-3 h-3" />tarina
              </button>
              <button
                @click.stop="deleteFolderTarget = folder"
                class="text-xs text-gray-600 hover:text-red-400 border-0 bg-transparent transition-colors p-0 leading-none">
                poista
              </button>
            </div>
          </div>
        </div>

        <!-- ── LISTANÄKYMÄ ── -->
        <div v-else class="flex flex-col gap-1.5">

          <!-- Carousel rivi -->
          <div v-if="auth.isAdmin && !currentFolderId && !inCarouselView"
            class="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800/50
                   hover:border-gray-700 cursor-pointer transition-all"
            @click="openCarouselView">
            <Star class="w-5 h-5 text-yellow-500/70 shrink-0 fill-yellow-500/20" />
            <span class="text-sm font-medium text-white flex-1">Carousel kuvat</span>
            <span class="text-xs text-gray-600">{{ carouselIds.size }} / 5</span>
          </div>

          <!-- Kansiorivit -->
          <div
            v-for="folder in folders" :key="folder._id"
            class="flex items-center gap-0 rounded-xl border transition-all overflow-hidden"
            :class="dragOverFolder === folder._id
              ? 'border-dpurple-600 bg-dpurple-950/20'
              : 'border-gray-800/50 hover:border-gray-700 bg-gray-950'"
            @dragover.prevent="auth.isAdmin && onDragOverFolder($event, folder._id)"
            @dragleave="onDragLeaveFolder"
            @drop.prevent="auth.isAdmin && onDropFolder($event, folder._id)">

            <!-- Pikkukuva -->
            <div class="w-16 h-14 shrink-0 relative overflow-hidden cursor-pointer"
              @click="navigateInto(folder)">
              <img v-if="folder.previewBlobName" :src="folderPreviewUrl(folder)"
                crossorigin="anonymous" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full bg-gray-900 flex items-center justify-center">
                <FolderOpen class="w-6 h-6 text-gray-700" />
              </div>
            </div>

            <!-- Tiedot -->
            <div class="flex-1 min-w-0 px-3 py-2 cursor-pointer" @click="navigateInto(folder)">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white truncate">{{ folder.name }}</span>
                <FileText v-if="folder.description" class="w-3 h-3 text-dpurple-500 shrink-0" />
              </div>
              <p v-if="folder.description" class="text-[11px] text-gray-600 truncate mt-0.5 leading-tight">
                {{ folder.description }}
              </p>
              <div class="flex items-center gap-3 mt-0.5">
                <span class="text-[10px] text-gray-600 flex items-center gap-1">
                  <Image class="w-2.5 h-2.5" />{{ folder.imageCount ?? 0 }} kuvaa
                </span>
                <span v-if="folder.videoCount" class="text-[10px] text-gray-600 flex items-center gap-1">
                  <Film class="w-2.5 h-2.5" />{{ folder.videoCount }} videota
                </span>
                <span v-if="folder.totalViews" class="text-[10px] text-gray-600 flex items-center gap-1">
                  <Eye class="w-2.5 h-2.5" />{{ folder.totalViews }} avausta
                </span>
              </div>
            </div>

            <!-- Admin-toiminnot -->
            <div v-if="auth.isAdmin" class="flex gap-3 pr-3 pl-1 shrink-0">
              <button
                @click.stop="renameFolderTarget = folder; renameDraft = folder.name; nextTick(() => renameInputRef?.focus())"
                class="text-xs text-gray-600 hover:text-gray-300 border-0 bg-transparent transition-colors p-0 leading-none">
                muokkaa
              </button>
              <button
                @click.stop="storyFolderTarget = folder; storyDraft = folder.description ?? ''; storyModalOpen = true"
                class="flex items-center gap-1 text-xs border-0 bg-transparent transition-colors p-0 leading-none"
                :class="folder.description ? 'text-dpurple-500 hover:text-dpurple-300' : 'text-gray-600 hover:text-gray-300'">
                <FileText class="w-3 h-3" />tarina
              </button>
              <button
                @click.stop="deleteFolderTarget = folder"
                class="text-xs text-gray-600 hover:text-red-400 border-0 bg-transparent transition-colors p-0 leading-none">
                poista
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Skeleton grid (latautuu) ── -->
      <div v-if="loading && currentFolderId" class="relative">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div v-for="n in 12" :key="n"
            class="aspect-square rounded-2xl bg-gray-900/70 border border-gray-800/20"
            style="background: linear-gradient(110deg, #111 25%, #1a1a1a 50%, #111 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.4s infinite linear;" />
        </div>
      </div>

      <!-- ── Folder loading glass ── -->
      <Transition name="fade">
        <div v-if="showFolderGlass"
          class="fixed inset-0 z-30 flex flex-col items-center justify-center pointer-events-none gap-3">
          <!-- Kahdeksankulmio + lasi -->
          <div class="relative flex items-center justify-center w-36 h-36">
            <!-- Pyörivä oktagonitausta -->
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none"
              style="animation: octagon-spin 2s linear infinite;">
              <polygon
                points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30"
                fill="rgba(0,0,0,0.32)"
                stroke="rgba(134,168,140,0.2)"
                stroke-width="1"
                stroke-linejoin="round" />
            </svg>
            <!-- Lasi -->
            <svg width="52" height="72" viewBox="0 0 44 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="relative z-10">
              <defs>
                <clipPath id="folder-glass-clip">
                  <polygon points="6,4 38,4 34,56 10,56" />
                </clipPath>
              </defs>
              <g clip-path="url(#folder-glass-clip)">
                <rect x="0" y="0" width="44" height="60" fill="#14532d" opacity="0.2" />
                <rect
                  x="0" width="44" fill="#16a34a" opacity="0.7"
                  :y="4 + (1 - folderLoadProgress) * 52"
                  :height="folderLoadProgress * 52" />
                <circle cx="16" cy="40" r="1.8" fill="#4ade80" opacity="0.5">
                  <animate attributeName="cy" values="54;10" dur="2.1s" repeatCount="indefinite" begin="0.3s" />
                  <animate attributeName="opacity" values="0.5;0" dur="2.1s" repeatCount="indefinite" begin="0.3s" />
                </circle>
                <circle cx="26" cy="45" r="1.2" fill="#4ade80" opacity="0.4">
                  <animate attributeName="cy" values="54;15" dur="1.7s" repeatCount="indefinite" begin="0.9s" />
                  <animate attributeName="opacity" values="0.4;0" dur="1.7s" repeatCount="indefinite" begin="0.9s" />
                </circle>
              </g>
              <polygon points="6,4 38,4 34,56 10,56" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linejoin="round" />
              <line x1="6" y1="4" x2="38" y2="4" stroke="rgba(255,255,255,0.28)" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </div>
          <p class="text-[11px] text-white/30 tracking-wide">
            {{ loading ? 'Ladataan…' : `${loadedImages.size} / ${mediaItems.filter(m => m.mediaType === 'image').length}` }}
          </p>
        </div>
      </Transition>

      <!-- ── Tyhjä tila ── -->
      <div v-if="!loading && !folders.length && !mediaItems.length"
        class="text-center py-20 text-gray-700">
        <ImageOff class="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p class="text-sm">Ei sisältöä vielä.</p>
        <p v-if="auth.isAdmin" class="text-xs mt-1 text-gray-800">Luo kansio tai lataa tiedostoja.</p>
      </div>

      <!-- ── Mediaruudukko ── -->
      <div v-if="mediaItems.length"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
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
            @click="auth.isAdmin && !inCarouselView && selectedIds.size > 0 ? toggleSelect(slot.item._id) : openLightbox(slot.origIdx)">

          <!-- Kuva -->
          <!-- Shimmer placeholder kunnes kuva on ladattu -->
          <div v-if="slot.item.mediaType === 'image' && !loadedImages.has(slot.item._id)"
            class="absolute inset-0 z-[1] rounded-2xl"
            style="background: linear-gradient(110deg, #0f0f0f 25%, #1c1c1c 50%, #0f0f0f 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.4s infinite linear;" />
          <img v-if="slot.item.mediaType === 'image'" :src="imgUrl(slot.item)" :alt="slot.item.caption || slot.item.blobName"
            crossorigin="anonymous"
            class="w-full block object-cover aspect-square transition-all duration-500 group-hover:scale-[1.02]"
            :class="loadedImages.has(slot.item._id) ? 'opacity-100' : 'opacity-0'"
            @load="onImageLoaded(slot.item._id)" />

          <!-- Video thumbnail -->
          <template v-else>
            <video :src="imgUrl(slot.item)" preload="metadata" muted loop playsinline crossorigin="anonymous"
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

          <!-- Checkbox (admin, multi-select, not in carousel view) -->
          <div v-if="auth.isAdmin && !inCarouselView"
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
            class="absolute bottom-1.5 right-1.5 pointer-events-none"
            :class="slot.item.caption ? 'bottom-7' : 'bottom-1.5'">
            <Star class="w-4 h-4 text-yellow-400 fill-yellow-400 drop-shadow" />
          </div>

          <!-- Caption overlay — only when caption exists -->
          <div v-if="slot.item.caption"
            class="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-black/50 backdrop-blur-[2px]">
            <p class="text-[11px] text-white/80 truncate leading-tight">{{ slot.item.caption }}</p>
          </div>

          <!-- View count badge — bottom-left, pill, above caption ribbon -->
          <div class="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-full
                      bg-black/70 text-white/70 text-[10px] pointer-events-none leading-none z-10
                      backdrop-blur-sm"
            :class="slot.item.caption ? 'bottom-7 left-1.5' : 'bottom-1.5 left-1.5'">
            <Eye class="w-3 h-3 shrink-0" />
            <span>{{ slot.item.viewCount ?? 0 }}</span>
          </div>

          <!-- Actions (edit / delete) — always visible on mobile, hover-only on desktop -->
          <div class="absolute top-2 right-2 flex flex-col gap-1 transition-all
                      sm:opacity-0 sm:group-hover:opacity-100">
            <button v-if="canEdit(slot.item)"
              @click.stop="openLightbox(slot.origIdx); nextTick(startEditCaption)"
              class="p-1.5 rounded-lg bg-black/70 border-0 text-gray-400 hover:text-white hover:bg-black/90">
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button v-if="canDelete(slot.item) && !inCarouselView"
              @click.stop="deleteTarget = slot.item"
              class="p-1.5 rounded-lg bg-black/70 border-0 text-gray-400 hover:text-red-400 hover:bg-black/90">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          </div><!-- /item card -->
        </template>
      </div>
    </template><!-- /v-else loading/error -->
    </template><!-- /v-else kirjautunut -->
  </div>

  <!-- ── LIGHTBOX ── -->
  <Teleport to="body">
    <div v-if="lightboxItem"
      class="fixed inset-0 z-50 bg-black/95 flex flex-col sm:flex-row"
      @click="closeLightbox">

      <!-- Sulje -->
      <button class="absolute top-3 right-3 sm:top-4 sm:right-[308px] p-2 rounded-xl bg-black/60 hover:bg-black/80
                     text-white border-0 transition-all z-30" @click.stop="closeLightbox">
        <X class="w-5 h-5" />
      </button>

      <!-- Edellinen (desktop) -->
      <button v-if="mediaItems.length > 1"
        class="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-20 items-center justify-center"
        @click.stop="lightboxPrev">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- Media area -->
      <div class="relative flex items-center justify-center sm:flex-1 sm:p-4 min-w-0 shrink-0 sm:shrink"
        @click.stop @touchstart.passive="onSwipeStart" @touchend.passive="onSwipeEnd">
        <!-- Loading spinner: drinking glass -->
        <Transition name="fade">
          <div v-if="mediaLoading"
            class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none gap-4">
            <!-- Glass SVG -->
            <svg width="44" height="60" viewBox="0 0 44 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Glass outline: trapezoid, narrower at bottom -->
              <defs>
                <clipPath id="glass-clip">
                  <polygon points="6,4 38,4 34,56 10,56" />
                </clipPath>
                <!-- Animated fill: oscillating wave-like top edge -->
              </defs>
              <!-- Liquid fill, clipped to glass shape, fills from bottom -->
              <g clip-path="url(#glass-clip)">
                <rect x="0" y="0" width="44" height="60" fill="#14532d" opacity="0.25" />
                <!-- Animated fill rect that grows from bottom -->
                <rect x="0" class="glass-liquid" width="44" fill="#16a34a" opacity="0.75">
                  <animate attributeName="y" values="56;4;56" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />
                  <animate attributeName="height" values="0;52;0" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />
                </rect>
                <!-- Bubble 1 -->
                <circle cx="16" cy="40" r="1.8" fill="#4ade80" opacity="0.5">
                  <animate attributeName="cy" values="54;10" dur="2.1s" repeatCount="indefinite" begin="0.3s" />
                  <animate attributeName="opacity" values="0.5;0" dur="2.1s" repeatCount="indefinite" begin="0.3s" />
                </circle>
                <!-- Bubble 2 -->
                <circle cx="26" cy="45" r="1.2" fill="#4ade80" opacity="0.4">
                  <animate attributeName="cy" values="54;15" dur="1.7s" repeatCount="indefinite" begin="0.9s" />
                  <animate attributeName="opacity" values="0.4;0" dur="1.7s" repeatCount="indefinite" begin="0.9s" />
                </circle>
              </g>
              <!-- Glass outline on top -->
              <polygon points="6,4 38,4 34,56 10,56" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linejoin="round" />
              <!-- Rim highlight -->
              <line x1="6" y1="4" x2="38" y2="4" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <!-- Messages -->
            <Transition name="fade">
              <p v-if="thirstyMsg3" class="text-center text-xs text-white/60 max-w-[200px] leading-relaxed">{{ thirstyMsg3 }}</p>
            </Transition>
            <Transition name="fade">
              <p v-if="thirstyMsg6" class="text-center text-[11px] text-dgreen-400/70 max-w-[200px] leading-relaxed italic">{{ thirstyMsg6 }}</p>
            </Transition>
            <!-- Video latauspalkki: ilmestyy 10s jälkeen -->
            <Transition name="fade">
              <div v-if="loadingElapsed >= 10 && lightboxItem.mediaType === 'video'"
                class="flex flex-col items-center gap-1.5 w-48">
                <div class="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full rounded-full bg-dgreen-500 transition-all duration-500"
                    :style="{ width: videoBufferPct !== null ? videoBufferPct + '%' : '0%',
                              animation: videoBufferPct === null ? 'skeleton-shimmer 1.4s infinite linear' : 'none',
                              background: videoBufferPct === null ? 'linear-gradient(90deg,#14532d,#16a34a,#14532d)' : '' }" />
                </div>
                <span class="text-[10px] text-white/30 tabular-nums">
                  {{ videoBufferPct !== null ? videoBufferPct + ' %' : 'Puskuroidaan…' }}
                </span>
              </div>
            </Transition>
          </div>
        </Transition>
        <!-- Place name pill — appears at top of image when GPS available -->
        <Transition name="fade">
          <div v-if="placeName"
            class="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none
                   flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap
                   bg-black/55 backdrop-blur-sm border border-white/10 text-white/75 text-xs">
            <MapPin class="w-3 h-3 text-dgreen-400 shrink-0" />
            {{ placeName }}
          </div>
        </Transition>

        <img v-if="lightboxItem.mediaType === 'image'" :src="imgUrl(lightboxItem)"
          crossorigin="anonymous"
          @load="onMediaLoaded"
          class="w-full sm:max-h-[92vh] sm:max-w-full sm:rounded-xl shadow-2xl object-contain
                 max-h-[55vh] rounded-none transition-opacity duration-300"
          :class="mediaLoading ? 'opacity-0' : 'opacity-100'" />
        <video v-else :src="imgUrl(lightboxItem)" controls autoplay crossorigin="anonymous"
          @canplay.once="onMediaLoaded"
          @progress="onVideoProgress"
          class="w-full sm:max-h-[92vh] sm:max-w-full rounded-xl shadow-2xl max-h-[55vh] transition-opacity duration-300"
          :class="mediaLoading ? 'opacity-0' : 'opacity-100'" />
      </div>

      <!-- Mobile nav bar (prev/next + counter) -->
      <div v-if="mediaItems.length > 1"
        class="sm:hidden flex items-center justify-between px-4 py-2 shrink-0 border-t border-gray-800/60"
        @click.stop>
        <button @click.stop="lightboxPrev"
          class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span class="text-xs text-gray-600">{{ lightboxIdx + 1 }} / {{ mediaItems.length }}</span>
        <button @click.stop="lightboxNext"
          class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <!-- Seuraava (desktop) -->
      <button v-if="mediaItems.length > 1"
        class="hidden sm:flex absolute right-[320px] top-1/2 -translate-y-1/2 p-3 rounded-full
               bg-white/10 hover:bg-white/20 text-white border-0 transition-all z-20 items-center justify-center"
        @click.stop="lightboxNext">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- ── Info panel — right sidebar on desktop, scrollable bottom sheet on mobile ── -->
      <div class="sm:w-72 shrink-0 bg-gray-950/95 sm:border-l border-t border-gray-800/60
                  flex flex-col overflow-y-auto z-20 flex-1 sm:flex-none"
        @click.stop>

        <!-- ── MOBILE: compact strip ── -->
        <div class="sm:hidden px-4 py-3 flex items-center gap-3 border-b border-gray-800/40">
          <!-- caption / meta -->
          <div class="flex-1 min-w-0">
            <p v-if="lightboxItem.caption" class="text-xs text-gray-300 truncate">{{ lightboxItem.caption }}</p>
            <p class="text-[11px] text-gray-600 truncate mt-0.5">
              <span v-if="lightboxItem.uploadedBy">{{ lightboxItem.uploadedBy }} · </span>
              {{ new Date(lightboxItem.createdAt).toLocaleDateString('fi-FI') }}
              <span v-if="lightboxItem.fileSize"> · {{ fmtBytes(lightboxItem.fileSize) }}</span>
            </p>
            <p v-if="lightboxItem.exif?.dateTaken" class="text-[11px] text-gray-500 truncate mt-0.5">
              📷 {{ new Date(lightboxItem.exif.dateTaken!).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' }) }}
            </p>
            <p v-if="mediaLoadMs !== null" class="text-[10px] text-gray-700 mt-0.5">⚡ {{ mediaLoadMs }} ms</p>
          </div>
          <!-- katselukerrat -->
          <span v-if="lightboxItem.viewCount"
            class="shrink-0 flex items-center gap-1 text-[10px] text-gray-500
                   bg-gray-900 border border-gray-800/60 px-2 py-0.5 rounded-full self-start mt-0.5">
            <Eye class="w-3 h-3" />{{ lightboxItem.viewCount }}
          </span>
          <!-- action icons (spans, no button style) -->
          <div class="flex items-center gap-4 shrink-0">
            <!-- edit caption -->
            <span v-if="canEdit(lightboxItem) && !editingCaption"
              @click="startEditCaption"
              class="cursor-pointer text-gray-600 active:text-gray-300">
              <Pencil class="w-4 h-4" />
            </span>
            <!-- carousel star (admin) -->
            <span v-if="auth.isAdmin"
              @click="!carouselSaving && toggleCarousel(lightboxItem!)"
              class="cursor-pointer transition-colors"
              :class="carouselIds.has(lightboxItem!._id) ? 'text-yellow-400' : 'text-gray-600 active:text-yellow-400'">
              <Star class="w-4 h-4" :class="carouselIds.has(lightboxItem!._id) ? 'fill-yellow-400' : ''" />
            </span>
            <!-- carousel full hint (mobile) -->
            <!-- delete -->
            <span @click.stop="downloadItem(lightboxItem!)"
              class="cursor-pointer text-gray-600 active:text-gray-300">
              <Download class="w-4 h-4" />
            </span>
            <!-- copy link -->
            <span @click="copyLink(lightboxItem!)"
              class="cursor-pointer transition-colors"
              :class="copyLinkDone ? 'text-dgreen-400' : copyLinkError ? 'text-red-400' : 'text-gray-600 active:text-gray-300'">
              <Check v-if="copyLinkDone" class="w-4 h-4" />
              <X v-else-if="copyLinkError" class="w-4 h-4" />
              <Link v-else class="w-4 h-4" />
            </span>
            <!-- delete -->
            <span v-if="canDelete(lightboxItem!) && !inCarouselView"
              @click="deleteTarget = lightboxItem; closeLightbox()"
              class="cursor-pointer text-gray-600 active:text-red-400">
              <Trash2 class="w-4 h-4" />
            </span>
          </div>
        </div>

        <!-- mobile: carousel full hint -->
        <Transition name="fade">
          <div v-if="carouselFullMsg && auth.isAdmin && !carouselIds.has(lightboxItem!._id)"
            class="sm:hidden px-4 py-2 border-b border-yellow-900/30 bg-yellow-950/30">
            <p class="text-[11px] text-yellow-300/80 text-center">
              Karuselli täynnä (max 5) — poista ensin jokin kuva karusellista.
            </p>
          </div>
        </Transition>

        <!-- mobile caption edit (shown below strip when active) -->
        <div v-if="editingCaption" class="sm:hidden px-4 py-3 border-b border-gray-800/40 space-y-2">
          <textarea
            ref="captionInputRef"
            v-model="captionDraft"
            rows="2"
            maxlength="500"
            placeholder="Kuvateksti..."
            class="w-full px-3 py-2 rounded-xl text-sm bg-gray-900 border border-gray-700
                   text-white placeholder-gray-700 focus:outline-none focus:border-dpurple-700
                   resize-none transition-all"
            @keydown.ctrl.enter="saveCaption"
            @keydown.escape="editingCaption = false" />
          <div class="flex gap-2">
            <button @click="editingCaption = false"
              class="flex-1 px-3 py-1.5 rounded-lg text-xs border border-gray-700
                     text-gray-400 bg-transparent transition-all">Peruuta</button>
            <button @click="saveCaption" :disabled="captionSaving"
              class="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg
                     text-xs border-0 bg-dpurple-900/60 text-dpurple-300 disabled:opacity-50 transition-all">
              <Check class="w-3 h-3" />{{ captionSaving ? '...' : 'Tallenna' }}
            </button>
          </div>
        </div>

        <!-- ── DESKTOP: full panel ── -->
        <!-- Caption section -->
        <div class="hidden sm:block px-5 pt-5 pb-4 border-b border-gray-800/50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kuvateksti</span>
            <button v-if="canEdit(lightboxItem) && !editingCaption"
              @click="startEditCaption"
              class="p-1 rounded-lg border-0 bg-transparent text-gray-600 hover:text-gray-300 transition-all">
              <Pencil class="w-3.5 h-3.5" />
            </button>
          </div>
          <p v-if="!editingCaption"
            class="text-sm text-gray-300 leading-relaxed min-h-[2.5rem]"
            :class="!lightboxItem.caption ? 'text-gray-700 italic' : ''">
            {{ lightboxItem.caption || 'Ei kuvatekstiä' }}
          </p>
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
                       text-gray-400 hover:text-white bg-transparent transition-all">Peruuta</button>
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

        <!-- EXIF section (desktop only) -->
        <div v-if="lightboxItem.mediaType === 'image' && lightboxItem.exif"
          class="hidden sm:block px-5 py-4 border-b border-gray-800/50 space-y-3">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Kameratiedot</span>
          <div v-if="lightboxItem.exif.model" class="flex items-start gap-2">
            <Image class="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" />
            <span class="text-xs text-gray-300 leading-snug">
              {{ lightboxItem.exif.make && !lightboxItem.exif.model?.startsWith(lightboxItem.exif.make)
                ? lightboxItem.exif.make + ' ' : '' }}{{ lightboxItem.exif.model }}
            </span>
          </div>
          <div v-if="lightboxItem.exif.lens" class="text-xs text-gray-500 pl-5">{{ lightboxItem.exif.lens }}</div>
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <span v-if="lightboxItem.exif.fNumber" class="text-xs text-gray-400"><span class="text-gray-600">f/</span>{{ lightboxItem.exif.fNumber }}</span>
            <span v-if="lightboxItem.exif.exposureTime" class="text-xs text-gray-400">{{ lightboxItem.exif.exposureTime }}</span>
            <span v-if="lightboxItem.exif.iso" class="text-xs text-gray-400"><span class="text-gray-600">ISO </span>{{ lightboxItem.exif.iso }}</span>
            <span v-if="lightboxItem.exif.focalLength" class="text-xs text-gray-400">
              {{ lightboxItem.exif.focalLength }}mm
              <span v-if="lightboxItem.exif.focalLength35" class="text-gray-600">({{ lightboxItem.exif.focalLength35 }}mm eq.)</span>
            </span>
          </div>
          <div v-if="lightboxItem.exif.width && lightboxItem.exif.height" class="text-xs text-gray-600">
            {{ lightboxItem.exif.width }} × {{ lightboxItem.exif.height }} px
          </div>
          <div v-if="lightboxItem.exif.dateTaken" class="flex items-center gap-2">
            <Clock class="w-3.5 h-3.5 text-gray-600 shrink-0" />
            <span class="text-xs text-gray-400">{{ new Date(lightboxItem.exif.dateTaken!).toLocaleString('fi-FI', { dateStyle:'medium', timeStyle:'short' }) }}</span>
          </div>
          <div v-if="lightboxItem.exif.latitude" class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <MapPin class="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <a :href="`https://maps.google.com/?q=${lightboxItem.exif.latitude},${lightboxItem.exif.longitude}`"
                target="_blank" rel="noopener" class="text-xs text-dpurple-400 hover:text-dpurple-300 flex-1">
                {{ lightboxItem.exif.latitude!.toFixed(5) }}, {{ lightboxItem.exif.longitude!.toFixed(5) }}
              </a>
              <button @click="toggleMap"
                class="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
                :class="showMap
                  ? 'border-dgreen-700 text-dgreen-400 bg-dgreen-950/60'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'">
                {{ showMap ? 'Sulje' : 'Kartta' }}
              </button>
            </div>
            <div v-if="placeName" class="flex items-center gap-2 pl-5">
              <span class="text-xs text-dgreen-400/80">{{ placeName }}</span>
            </div>
            <!-- Minimap -->
            <Transition name="slide-up">
              <div v-if="showMap && mapsKey"
                class="w-full rounded-xl overflow-hidden border border-gray-800/60"
                style="height: 200px;">
                <div ref="mapDivRef" style="width:100%;height:100%;" />
              </div>
              <div v-else-if="showMap && !mapsKey"
                class="w-full rounded-xl border border-gray-800/60 flex items-center justify-center"
                style="height: 80px;">
                <span class="text-xs text-gray-600">Kartta ei saatavilla</span>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Meta (desktop only) -->
        <div class="hidden sm:block px-5 py-4 space-y-2 text-xs text-gray-600">
          <div v-if="lightboxItem.uploadedBy">Ladannut <span class="text-gray-400">{{ lightboxItem.uploadedBy }}</span></div>
          <div>{{ new Date(lightboxItem.createdAt).toLocaleString('fi-FI', { dateStyle:'medium', timeStyle:'short' }) }}</div>
          <div v-if="lightboxItem.fileSize">{{ fmtBytes(lightboxItem.fileSize) }}</div>
          <div v-if="mediaLoadMs !== null" class="text-gray-700">⚡ {{ mediaLoadMs }} ms</div>
          <div v-if="lightboxItem.viewCount" class="pt-1 border-t border-gray-800/60">
            <div class="flex items-center gap-1.5 text-gray-500">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <span>{{ lightboxItem.viewCount }} avausta</span>
            </div>
          </div>
        </div>

        <!-- Actions (desktop only) -->
        <div class="hidden sm:flex mt-auto px-5 pb-5 pt-3 border-t border-gray-800/50 flex-col gap-2">
          <button v-if="auth.isAdmin"
            @click="toggleCarousel(lightboxItem!)"
            :disabled="carouselSaving"
            class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs
                   border transition-all disabled:opacity-40"
            :class="carouselIds.has(lightboxItem!._id)
              ? 'bg-yellow-950/60 hover:bg-yellow-900/60 border-yellow-800/60 text-yellow-400'
              : (!carouselIds.has(lightboxItem!._id) && carouselIds.size >= 5)
                ? 'bg-orange-950/40 border-orange-800/50 text-orange-300 hover:bg-orange-900/50'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-700 text-gray-400 hover:text-white'">
            <span class="flex items-center gap-2">
              <Star class="w-3.5 h-3.5" :class="carouselIds.has(lightboxItem!._id) ? 'fill-yellow-400' : ''" />
              <span v-if="!carouselIds.has(lightboxItem!._id) && carouselIds.size >= 5">
                Karuselli täynnä — poista ensin kuva
              </span>
              <span v-else>
                {{ carouselIds.has(lightboxItem!._id) ? 'Poista carouselista' : 'Lisää carouseliin' }}
              </span>
            </span>
            <span class="font-mono tabular-nums"
              :class="carouselIds.size >= 5 && !carouselIds.has(lightboxItem!._id) ? 'text-orange-400' : 'text-gray-600'">
              {{ carouselIds.size }}/5
            </span>
          </button>
          <Transition name="fade">
            <p v-if="carouselFullMsg && !carouselIds.has(lightboxItem!._id)"
              class="text-[11px] text-yellow-300/80 text-center px-1 -mt-1">
              Karuselli täynnä (max 5) — poista ensin jokin kuva.
            </p>
          </Transition>
          <button v-if="auth.isAdmin && !carouselIds.has(lightboxItem!._id) && carouselIds.size >= 5"
            @click="closeLightbox(); openCarouselView()"
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs
                   border border-orange-900/50 bg-orange-950/30 hover:bg-orange-900/40
                   text-orange-400 hover:text-orange-200 transition-all">
            <Star class="w-3.5 h-3.5" />Hallitse karusellikuvia
          </button>
          <button @click="downloadItem(lightboxItem!)"
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                   text-xs border border-gray-700 bg-gray-900 hover:bg-gray-800
                   text-gray-400 hover:text-white transition-all">
            <Download class="w-3.5 h-3.5" />Lataa
          </button>
          <button @click="copyLink(lightboxItem!)"
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                   text-xs border transition-all"
            :class="copyLinkDone
              ? 'border-dgreen-700/60 bg-dgreen-950/40 text-dgreen-300'
              : copyLinkError
                ? 'border-red-800/60 bg-red-950/40 text-red-400'
                : 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white'">
            <Check v-if="copyLinkDone" class="w-3.5 h-3.5" />
            <X v-else-if="copyLinkError" class="w-3.5 h-3.5" />
            <Link v-else class="w-3.5 h-3.5" />
            {{ copyLinkDone ? 'Linkki kopioitu!' : copyLinkError ? 'Kopiointi epäonnistui' : 'Kopioi linkki' }}
          </button>
          <button v-if="canDelete(lightboxItem!) && !inCarouselView"
            @click="deleteTarget = lightboxItem; closeLightbox()"
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                   text-xs border-0 bg-red-950/60 hover:bg-red-900/60 text-red-400 transition-all">
            <Trash2 class="w-3.5 h-3.5" />Poista
          </button>
        </div>

        <!-- Counter (desktop only) -->
        <div class="hidden sm:block px-5 pb-4 text-xs text-gray-700 text-center">
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
            <img :src="imgUrl(deleteTarget)" crossorigin="anonymous" class="w-full object-cover max-h-32" />
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

  <!-- ── UUDELLEENNIMEÄ KANSIO ── -->
  <Teleport to="body">
    <div v-if="renameFolderTarget"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="renameFolderTarget = null" />
      <div class="relative w-full sm:max-w-sm bg-gray-950 border border-gray-800/60
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div class="h-1 w-full bg-gradient-to-r from-dpurple-900/60 via-dpurple-700/60 to-dpurple-900/60" />
        <div class="px-6 pt-6 pb-5">
          <h3 class="text-sm font-bold text-white mb-4">Nimeä kansio uudelleen</h3>
          <input
            ref="renameInputRef"
            v-model="renameDraft"
            type="text"
            placeholder="Kansion uusi nimi"
            class="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-900 border border-gray-800
                   text-white placeholder-gray-700 focus:outline-none focus:border-dpurple-700
                   transition-all mb-4"
            @keyup.enter="doRenameFolder"
            @keyup.escape="renameFolderTarget = null" />
          <div class="flex gap-2">
            <button @click="renameFolderTarget = null"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white transition-all bg-transparent">
              Peruuta
            </button>
            <button @click="doRenameFolder" :disabled="renaming || !renameDraft.trim()"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-sm font-medium border-0 bg-dpurple-900/60 hover:bg-dpurple-800/60
                     text-dpurple-300 disabled:opacity-50 transition-all">
              <Check class="w-3.5 h-3.5" />{{ renaming ? 'Tallennetaan...' : 'Tallenna' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── KANSION TARINA ── -->
  <Teleport to="body">
    <div v-if="storyModalOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="storyModalOpen = false" />
      <div class="relative w-full sm:max-w-md bg-gray-950 border border-gray-800/60
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div class="h-1 w-full bg-gradient-to-r from-dpurple-900/60 via-dpurple-700/60 to-dpurple-900/60" />
        <div class="px-6 pt-5 pb-2 flex items-center gap-2 border-b border-gray-800/50">
          <FileText class="w-4 h-4 text-dpurple-400" />
          <h3 class="text-sm font-bold text-white">Kansion tarina</h3>
          <span class="text-xs text-gray-600 ml-1">{{ storyFolderTarget?.name }}</span>
          <button @click="storyModalOpen = false"
            class="ml-auto p-1 rounded-lg border-0 bg-transparent text-gray-600 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="px-6 py-4">
          <textarea v-model="storyDraft" rows="5" maxlength="2000"
            placeholder="Kirjoita kansion tarina tai kuvaus..."
            class="w-full px-4 py-3 rounded-xl text-sm bg-gray-900 border border-gray-800
                   text-white placeholder-gray-700 focus:outline-none focus:border-dpurple-700
                   transition-all resize-none leading-relaxed mb-1"
            autofocus />
          <p class="text-right text-xs text-gray-700 mb-4">{{ storyDraft.length }} / 2000</p>
          <div class="flex gap-2">
            <button @click="storyModalOpen = false"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white transition-all bg-transparent">
              Peruuta
            </button>
            <button v-if="storyDraft"
              @click="storyDraft = ''; saveDescription()"
              class="px-4 py-2.5 rounded-xl text-sm font-medium border-0
                     bg-red-900/40 hover:bg-red-800/40 text-red-400 transition-all">
              Poista
            </button>
            <button @click="saveDescription" :disabled="storySaving"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-sm font-medium border-0 bg-dpurple-900/60 hover:bg-dpurple-800/60
                     text-dpurple-300 disabled:opacity-50 transition-all">
              <Check class="w-3.5 h-3.5" />{{ storySaving ? 'Tallennetaan...' : 'Tallenna' }}
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

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes octagon-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Leaflet + Tailwind preflight fix — poistettu, ei enää tarvita */
</style>


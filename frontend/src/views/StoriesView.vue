<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  BookOpen, Heart, MessageSquare, Plus, Pencil, Trash2, X,
  Upload, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Send, Film, Lock, ImageOff,
} from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

interface StoryMedia  { _id: string; url: string; blobName: string; mediaType: 'image' | 'video' }
interface StoryLike   { userId: string; username: string }
interface StoryComment { _id: string; authorId: string; username: string; content: string; createdAt: string }
interface Story {
  _id: string; title: string; content: string;
  author: string; authorId: string;
  media: StoryMedia[]; likes: StoryLike[]; comments: StoryComment[];
  createdAt: string; updatedAt: string;
}

// ── State ──
const stories    = ref<Story[]>([]);
const loading    = ref(true);
const expandedId = ref<string | null>(null);
const commentsLoadedIds = ref<Set<string>>(new Set());
const commentsLoading   = ref<string | null>(null);

// Toast
interface Toast { id: number; message: string; type: 'success' | 'error' }
const toasts = ref<Toast[]>([]);
let _tid = 0;
function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const id = ++_tid;
  toasts.value.push({ id, msg, type } as any);
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3500);
}

// ── Modal add/edit ──
const modalOpen    = ref(false);
const editingStory = ref<Story | null>(null);
const mTitle       = ref('');
const mContent     = ref('');
const mFiles       = ref<File[]>([]);
const mDragOver    = ref(false);
const mSaving      = ref(false);
const mUploading   = ref(false);
const mProgress    = ref<Record<number, number>>({});
const mError       = ref('');

// ── Delete ──
const deleteTarget       = ref<Story | null>(null);
const mediaDeleting      = ref<string | null>(null);
const mediaDeleteConfirm = ref<{ story: Story; mediaId: string } | null>(null);

// ── Carousel ──
const carouselIdx = ref<Record<string, number>>({});
const brokenMedia = ref<Set<string>>(new Set());
const touchStartX = ref(0);

const STORY_AUTO_MS = 6000;
const STORY_TICK_MS = 50;
const STORY_CIRC = 2 * Math.PI * 9;
const carouselProgress = ref<Record<string, number>>({});
const carouselTimers: Record<string, ReturnType<typeof setInterval>> = {};
const carouselTicks:  Record<string, ReturnType<typeof setInterval>> = {};

function stopSlideTimer(id: string) {
  if (carouselTimers[id]) { clearInterval(carouselTimers[id]); delete carouselTimers[id]; }
  if (carouselTicks[id])  { clearInterval(carouselTicks[id]);  delete carouselTicks[id]; }
}
function startSlideTimer(s: Story) {
  stopSlideTimer(s._id);
  if (s.media.length <= 1) return;
  carouselProgress.value[s._id] = 100;
  carouselTicks[s._id] = setInterval(() => {
    carouselProgress.value[s._id] = Math.max(0, (carouselProgress.value[s._id] ?? 100) - (100 * STORY_TICK_MS / STORY_AUTO_MS));
  }, STORY_TICK_MS);
  carouselTimers[s._id] = setInterval(() => {
    nextSlide(s._id, s.media.length);
    carouselProgress.value[s._id] = 100;
  }, STORY_AUTO_MS);
}
function resetSlideTimer(s: Story) { startSlideTimer(s); }

function getIdx(id: string)                   { return carouselIdx.value[id] ?? 0; }
function nextSlide(id: string, total: number) { carouselIdx.value[id] = (getIdx(id) + 1) % total; }
function prevSlide(id: string, total: number) { carouselIdx.value[id] = (getIdx(id) - 1 + total) % total; }
function setSlide(id: string, i: number)      { carouselIdx.value[id] = i; }
function currentMedia(s: Story)               { return s.media[getIdx(s._id)]; }
function onImgError(mediaId: string)          { brokenMedia.value = new Set([...brokenMedia.value, mediaId]); }
function onTouchStart(e: TouchEvent)          { touchStartX.value = e.touches[0].clientX; }
function onTouchEnd(e: TouchEvent, s: Story)  {
  const dx = e.changedTouches[0].clientX - touchStartX.value;
  if (Math.abs(dx) > 40) dx < 0 ? nextSlide(s._id, s.media.length) : prevSlide(s._id, s.media.length);
}

// ── Comments ──
const commentTexts  = ref<Record<string, string>>({});
const commentSaving = ref<string | null>(null);

onMounted(async () => {
  if (!auth.isLoggedIn) { loading.value = false; return; }
  try {
    const { data } = await api.get('/stories');
    stories.value = data;
  } finally {
    loading.value = false;
  }
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isMyStory(s: Story) {
  return s.author === auth.username || auth.isAdmin;
}

function isMyComment(c: StoryComment) {
  return c.username === auth.username || auth.isAdmin;
}

function hasLiked(s: Story) {
  return s.likes.some(l => l.username === auth.username);
}

// ── Expand / comments ──
async function toggleExpand(story: Story) {
  if (expandedId.value === story._id) {
    expandedId.value = null;
    return;
  }
  expandedId.value = story._id;
  if (!commentsLoadedIds.value.has(story._id)) {
    commentsLoading.value = story._id;
    try {
      const { data } = await api.get(`/stories/${story._id}`);
      const idx = stories.value.findIndex(s => s._id === story._id);
      if (idx !== -1) stories.value[idx] = data;
      commentsLoadedIds.value.add(story._id);
    } finally {
      commentsLoading.value = null;
    }
  }
}

// ── Like ──
async function toggleLike(story: Story) {
  try {
    const { data } = await api.post(`/stories/${story._id}/like`);
    story.likes = data.likes;
  } catch { /* silent */ }
}

// ── Comment ──
async function submitComment(story: Story) {
  const text = (commentTexts.value[story._id] || '').trim();
  if (!text) return;
  commentSaving.value = story._id;
  try {
    const { data } = await api.post(`/stories/${story._id}/comments`, { content: text });
    story.comments = data.comments;
    commentTexts.value[story._id] = '';
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Kommentointi epäonnistui', 'error');
  } finally {
    commentSaving.value = null;
  }
}

async function deleteComment(story: Story, cid: string) {
  try {
    const { data } = await api.delete(`/stories/${story._id}/comments/${cid}`);
    story.comments = data.comments;
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Poisto epäonnistui', 'error');
  }
}

// ── Modal ──
function openAddModal() {
  editingStory.value = null;
  mTitle.value = ''; mContent.value = ''; mFiles.value = [];
  mError.value = ''; mProgress.value = {};
  modalOpen.value = true;
}

function openEditModal(story: Story) {
  editingStory.value = story;
  mTitle.value = story.title; mContent.value = story.content;
  mFiles.value = []; mError.value = ''; mProgress.value = {};
  modalOpen.value = true;
}

function closeModal() {
  if (mSaving.value || mUploading.value) return;
  modalOpen.value = false; editingStory.value = null;
}

function onModalDrop(e: DragEvent) {
  mDragOver.value = false;
  if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files));
}

function addFiles(files: File[]) {
  const existingMedia = editingStory.value?.media.length ?? 0;
  const remaining = 5 - existingMedia - mFiles.value.length;
  const valid = files.filter(f =>
    f.type.startsWith('image/') || f.type.startsWith('video/') ||
    /\.(jpe?g|png|gif|webp|heic|heif|mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name)
  );
  mFiles.value = [...mFiles.value, ...valid].slice(0, Math.max(0, remaining));
}

function removeQueuedFile(i: number) {
  mFiles.value = mFiles.value.filter((_, idx) => idx !== i);
}

async function saveModal() {
  if (!mTitle.value.trim()) { mError.value = 'Otsikko vaaditaan'; return; }
  if (!mContent.value.trim()) { mError.value = 'Sisältö vaaditaan'; return; }
  mSaving.value = true; mError.value = '';
  try {
    let story: Story;
    if (editingStory.value) {
      const { data } = await api.put(`/stories/${editingStory.value._id}`, {
        title: mTitle.value, content: mContent.value,
      });
      story = data;
      const idx = stories.value.findIndex(s => s._id === story._id);
      if (idx !== -1) stories.value[idx] = { ...stories.value[idx], title: story.title, content: story.content };
    } else {
      const { data } = await api.post('/stories', { title: mTitle.value, content: mContent.value });
      story = data;
      stories.value.unshift({ ...story, likes: [], comments: [], media: [] });
    }
    if (mFiles.value.length) {
      mUploading.value = true;
      for (let i = 0; i < mFiles.value.length; i++) {
        const fd = new FormData();
        fd.append('file', mFiles.value[i]);
        mProgress.value[i] = 0;
        try {
          const { data } = await api.post(`/stories/${story._id}/media`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e: any) => {
              mProgress.value[i] = e.total ? Math.round((e.loaded / e.total) * 100) : 50;
            },
          });
          const idx = stories.value.findIndex(s => s._id === story._id);
          if (idx !== -1) stories.value[idx].media = data.media;
        } catch { /* single upload failure is non-fatal */ }
        mProgress.value[i] = 100;
      }
      mUploading.value = false;
    }
    showToast(editingStory.value ? 'Tarina päivitetty' : 'Tarina lisätty');
    modalOpen.value = false; editingStory.value = null;
  } catch (err: any) {
    mError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    mSaving.value = false;
  }
}

// ── Delete media ──
async function deleteMedia(story: Story, mediaId: string) {
  mediaDeleting.value = mediaId;
  try {
    const { data } = await api.delete(`/stories/${story._id}/media/${mediaId}`);
    const idx = stories.value.findIndex(s => s._id === story._id);
    if (idx !== -1) {
      stories.value[idx].media = data.media;
      const cur = carouselIdx.value[story._id] ?? 0;
      if (cur >= data.media.length) carouselIdx.value[story._id] = Math.max(0, data.media.length - 1);
    }
    if (editingStory.value?._id === story._id) editingStory.value.media = data.media;
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Poisto epäonnistui', 'error');
  } finally {
    mediaDeleting.value = null;
  }
}

// ── Delete story ──
async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await api.delete(`/stories/${deleteTarget.value._id}`);
    stories.value = stories.value.filter(s => s._id !== deleteTarget.value!._id);
    if (expandedId.value === deleteTarget.value._id) expandedId.value = null;
    showToast('Tarina poistettu');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Poisto epäonnistui', 'error');
  } finally {
    deleteTarget.value = null;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">

    <!-- ── Auth gate ── -->
    <div v-if="!auth.isLoggedIn" class="text-center py-24 flex flex-col items-center gap-6">
      <div class="w-16 h-16 rounded-2xl bg-dpurple-900/40 border border-dpurple-800/40
                  flex items-center justify-center">
        <Lock class="w-7 h-7 text-dpurple-400" />
      </div>
      <div>
        <h2 class="text-xl font-bold text-white mb-2">Kirjaudu lukeaksesi tarinoita</h2>
        <p class="text-gray-400 text-sm max-w-xs mx-auto">Tarinat ovat vain jäsenille tarkoitettua sisältöä.</p>
      </div>
      <div class="flex gap-3">
        <RouterLink to="/login"
          class="px-5 py-2.5 rounded-xl bg-dpurple-800/60 hover:bg-dpurple-700/60
                 text-white text-sm font-medium transition-all border border-dpurple-700/60">
          Kirjaudu sisään
        </RouterLink>
        <RouterLink to="/hakemus"
          class="px-5 py-2.5 rounded-xl border border-gray-700 hover:border-gray-600
                 text-gray-300 text-sm transition-all">
          Hae jäseneksi
        </RouterLink>
      </div>
    </div>

    <template v-else>

      <!-- ── Header ── -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-white">Tarinoita</h1>
          <p class="text-gray-400 text-sm mt-1">Jäsenten kertomuksia</p>
        </div>
        <button @click="openAddModal"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl border-0
                 bg-dpurple-800/60 hover:bg-dpurple-700/60 text-white text-sm font-medium transition-all">
          <Plus class="w-4 h-4" />Lisää tarina
        </button>
      </div>

      <!-- ── Loading / empty ── -->
      <div v-if="loading" class="text-gray-400 text-sm py-20 text-center">Ladataan tarinoita...</div>
      <div v-else-if="!stories.length" class="text-gray-400 italic py-20 text-center">
        Ei tarinoita vielä. Ole ensimmäinen!
      </div>

      <!-- ── Stories list ── -->
      <div v-else class="flex flex-col gap-4">
        <article v-for="s in stories" :key="s._id"
          class="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden
                 hover:border-gray-700 transition-colors">

          <!-- ── Card header + thumbnail row ── -->
          <div class="flex gap-4 p-5">

            <!-- Media thumbnail — first item -->
            <div v-if="s.media.length"
              class="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-gray-800">
              <video v-if="s.media[0].mediaType === 'video'"
                :src="s.media[0].url" muted preload="metadata"
                class="w-full h-full object-cover" />
              <div v-else-if="brokenMedia.has(s.media[0]._id)"
                class="w-full h-full flex items-center justify-center">
                <ImageOff class="w-5 h-5 text-gray-600" />
              </div>
              <img v-else :src="s.media[0].url" :alt="s.title"
                class="w-full h-full object-cover"
                @error="onImgError(s.media[0]._id)" />
            </div>
            <div v-else
              class="shrink-0 w-20 h-20 rounded-xl bg-dpurple-900/30 border border-dpurple-800/20
                     flex items-center justify-center">
              <BookOpen class="w-7 h-7 text-dpurple-400/50" />
            </div>

            <!-- Title + meta -->
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-bold text-white leading-snug line-clamp-2">{{ s.title }}</h2>
              <p class="text-xs text-gray-500 mt-1">{{ s.author }} · {{ fmtDate(s.createdAt) }}</p>
              <p class="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                {{ s.content.slice(0, 160) }}{{ s.content.length > 160 ? '…' : '' }}
              </p>
            </div>
          </div>

          <!-- ── Action bar ── -->
          <div class="flex items-center gap-1 px-4 pb-3 pt-0 border-t border-gray-800/60">

            <!-- Expand -->
            <button @click="toggleExpand(s)"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border-0
                     text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all">
              <ChevronDown v-if="expandedId !== s._id" class="w-3.5 h-3.5" />
              <ChevronUp   v-else                       class="w-3.5 h-3.5" />
              {{ expandedId === s._id ? 'Sulje' : 'Lue koko tarina' }}
            </button>

            <!-- Like -->
            <button @click="toggleLike(s)"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border-0 transition-all"
              :class="hasLiked(s)
                ? 'text-red-400 bg-red-950/40'
                : 'text-gray-500 hover:text-red-400 hover:bg-red-950/20'">
              <Heart class="w-3.5 h-3.5" :class="hasLiked(s) ? 'fill-red-400' : ''" />
              {{ s.likes.length || '' }}
            </button>

            <!-- Comment count -->
            <button @click="toggleExpand(s)"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border-0
                     text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-all">
              <MessageSquare class="w-3.5 h-3.5" />
              {{ s.comments?.length || 0 }}
            </button>

            <!-- Media count badge -->
            <span v-if="s.media.length"
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs
                     text-dpurple-400/80 bg-dpurple-900/20">
              <Film class="w-3 h-3" />{{ s.media.length }}
            </span>

            <div class="flex-1" />

            <!-- Edit / delete (own stories + admin) -->
            <template v-if="isMyStory(s)">
              <button @click="openEditModal(s)"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border-0
                       text-gray-500 hover:text-white hover:bg-gray-800/60 transition-all">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button @click="deleteTarget = s"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border-0
                       text-gray-600 hover:text-red-400 hover:bg-red-950/20 transition-all">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </template>
          </div>

          <!-- ── Expanded content ── -->
          <div v-if="expandedId === s._id" class="border-t border-gray-800/60">

            <!-- Full text -->
            <div class="px-5 py-5">
              <p class="text-gray-300 whitespace-pre-line leading-relaxed text-sm">{{ s.content }}</p>
            </div>

            <!-- Media carousel -->
            <div v-if="s.media.length"
              class="border-t border-gray-800/40 px-3 pb-3 pt-2"
              @touchstart.passive="onTouchStart"
              @touchend.passive="(e) => onTouchEnd(e as TouchEvent, s)"
              @vue:mounted="startSlideTimer(s)"
              @vue:unmounted="stopSlideTimer(s._id)">

              <!-- Slide area -->
              <div class="relative bg-gray-950 rounded-xl overflow-hidden select-none"
                style="min-height: 200px;">

                <!-- Broken image fallback -->
                <div v-if="brokenMedia.has(currentMedia(s)._id)"
                  class="flex flex-col items-center gap-2 py-14 text-gray-600">
                  <ImageOff class="w-8 h-8" />
                  <span class="text-xs">Kuva ei saatavilla</span>
                </div>

                <!-- Video -->
                <video v-else-if="currentMedia(s).mediaType === 'video'"
                  :key="currentMedia(s)._id"
                  :src="currentMedia(s).url"
                  controls preload="metadata"
                  class="w-full max-h-96 object-contain" />

                <!-- Image -->
                <img v-else
                  :key="currentMedia(s)._id"
                  :src="currentMedia(s).url"
                  :alt="s.title"
                  class="w-full h-72 sm:h-80 object-cover"
                  @error="onImgError(currentMedia(s)._id)" />

                <!-- Prev -->
                <button v-if="s.media.length > 1"
                  @click.stop="prevSlide(s._id, s.media.length); resetSlideTimer(s)"
                  class="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full
                         bg-black/20 hover:bg-black/50 text-white/70 hover:text-white
                         border border-white/15 backdrop-blur-sm transition-all touch-manipulation
                         opacity-60 hover:opacity-100">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <!-- Next -->
                <button v-if="s.media.length > 1"
                  @click.stop="nextSlide(s._id, s.media.length); resetSlideTimer(s)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full
                         bg-black/20 hover:bg-black/50 text-white/70 hover:text-white
                         border border-white/15 backdrop-blur-sm transition-all touch-manipulation
                         opacity-60 hover:opacity-100">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <!-- Counter top-left -->
                <div v-if="s.media.length > 1"
                  class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60
                         text-[11px] font-medium text-gray-300 tabular-nums pointer-events-none">
                  {{ getIdx(s._id) + 1 }}&nbsp;/&nbsp;{{ s.media.length }}
                </div>

                <!-- Countdown ring -->
                <div v-if="s.media.length > 1"
                  class="absolute bottom-2 right-2 z-10 opacity-60 pointer-events-none">
                  <svg width="28" height="28" viewBox="0 0 28 28" style="transform: rotate(-90deg)">
                    <circle cx="14" cy="14" r="9" fill="none"
                      stroke="rgba(255,255,255,0.15)" stroke-width="2" />
                    <circle cx="14" cy="14" r="9" fill="none"
                      stroke="white" stroke-width="2" stroke-linecap="round"
                      :stroke-dasharray="STORY_CIRC"
                      :stroke-dashoffset="STORY_CIRC * (1 - (carouselProgress[s._id] ?? 100) / 100)"
                      style="transition: stroke-dashoffset 0.05s linear" />
                  </svg>
                </div>

                <!-- Delete current media (owner/admin) -->
                <button v-if="isMyStory(s) && !mediaDeleteConfirm"
                  @click.stop="mediaDeleteConfirm = { story: s, mediaId: currentMedia(s)._id }"
                  class="absolute top-2 right-2 px-2 py-1 rounded-lg z-20
                         bg-black/20 hover:bg-red-950/80 text-white/60 hover:text-red-300
                         border border-white/15 hover:border-red-800/60 text-[11px] font-medium
                         flex items-center gap-1 transition-all backdrop-blur-sm
                         opacity-50 hover:opacity-100">
                  <Trash2 class="w-3 h-3" />
                  Poista
                </button>

                <!-- Delete confirm overlay -->
                <div v-if="mediaDeleteConfirm?.story._id === s._id && mediaDeleteConfirm?.mediaId === currentMedia(s)._id"
                  class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3
                         bg-black/85 backdrop-blur-sm">
                  <p class="text-sm text-white font-semibold">Poistetaanko tämä kuva?</p>
                  <p class="text-xs text-gray-400">Toimintoa ei voi peruuttaa.</p>
                  <div class="flex gap-2 mt-1">
                    <button @click.stop="mediaDeleteConfirm = null"
                      class="px-4 py-1.5 rounded-lg text-sm text-gray-300
                             border border-gray-600 bg-transparent hover:border-gray-400 transition-all">
                      Peruuta
                    </button>
                    <button @click.stop="deleteMedia(s, mediaDeleteConfirm.mediaId); mediaDeleteConfirm = null"
                      :disabled="mediaDeleting !== null"
                      class="px-4 py-1.5 rounded-lg text-sm font-medium border-0
                             bg-red-900/70 hover:bg-red-800/70 text-red-300
                             disabled:opacity-50 transition-all">
                      Poista
                    </button>
                  </div>
                </div>
              </div>

              <!-- Dot indicators -->
              <div v-if="s.media.length > 1"
                class="flex justify-center items-center gap-1.5 pt-2">
                <button v-for="(m, i) in s.media" :key="m._id"
                  @click="setSlide(s._id, i)"
                  class="border-0 bg-transparent p-1 rounded-full transition-all touch-manipulation"
                  :class="getIdx(s._id) === i
                    ? 'scale-100'
                    : 'scale-75 opacity-50 hover:opacity-75'">
                  <span class="block rounded-full transition-all"
                    :class="getIdx(s._id) === i
                      ? 'w-4 h-1.5 bg-dpurple-400'
                      : 'w-1.5 h-1.5 bg-gray-600'" />
                </button>
              </div>
            </div>

            <!-- ── Comments ── -->
            <div class="border-t border-gray-800/60 px-5 py-4">
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Kommentit
                <span v-if="s.comments?.length" class="ml-1 font-normal text-gray-600">({{ s.comments.length }})</span>
              </h3>

              <div v-if="commentsLoading === s._id" class="text-gray-500 text-xs py-3">
                Ladataan...
              </div>
              <div v-else-if="!s.comments?.length" class="text-gray-600 text-xs italic py-2">
                Ei vielä kommentteja.
              </div>
              <div v-else class="flex flex-col gap-3 mb-4">
                <div v-for="c in s.comments" :key="c._id"
                  class="bg-black/30 border border-gray-800/60 rounded-xl px-3.5 py-3">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-semibold text-dpurple-400">{{ c.username }}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-gray-700">{{ fmtDateTime(c.createdAt) }}</span>
                      <button v-if="isMyComment(c)"
                        @click="deleteComment(s, c._id)"
                        class="border-0 bg-transparent p-0 text-gray-700 hover:text-red-400 transition-colors">
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{{ c.content }}</p>
                </div>
              </div>

              <!-- Add comment input -->
              <div class="flex gap-2">
                <textarea
                  v-model="commentTexts[s._id]"
                  placeholder="Kirjoita kommentti..."
                  rows="2"
                  @keydown.ctrl.enter="submitComment(s)"
                  class="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-gray-800
                         text-sm text-gray-200 placeholder-gray-700
                         focus:outline-none focus:border-dpurple-700 resize-none transition-colors"
                />
                <button @click="submitComment(s)"
                  :disabled="!commentTexts[s._id]?.trim() || commentSaving === s._id"
                  class="px-3 py-2 rounded-xl border-0 bg-dpurple-800/60 hover:bg-dpurple-700/60
                         text-white disabled:opacity-40 transition-all self-end">
                  <Send v-if="commentSaving !== s._id" class="w-4 h-4" />
                  <span v-else class="text-xs">...</span>
                </button>
              </div>
              <p class="text-[10px] text-gray-700 mt-1">Ctrl+Enter tallentaa</p>
            </div>
          </div>
        </article>
      </div>
    </template>

    <!-- ── Add / Edit modal ── -->
    <Teleport to="body">
      <div v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        @click.self="closeModal">
        <div class="relative w-full max-w-2xl bg-gray-950 border border-gray-800/60 rounded-2xl
                    flex flex-col max-h-[90vh] overflow-hidden">

          <!-- Gradient bar -->
          <div class="h-1 w-full bg-gradient-to-r from-dpurple-900/60 via-dpurple-600/60 to-dpurple-900/60" />

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
            <h2 class="text-base font-bold text-white">
              {{ editingStory ? 'Muokkaa tarinaa' : 'Lisää tarina' }}
            </h2>
            <button @click="closeModal"
              class="border-0 bg-transparent p-1 text-gray-600 hover:text-gray-300 transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            <!-- Error -->
            <div v-if="mError"
              class="px-3 py-2 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-sm">
              {{ mError }}
            </div>

            <!-- Title -->
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Otsikko</label>
              <input v-model="mTitle" type="text" placeholder="Tarinan otsikko"
                class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                       text-gray-200 placeholder-gray-700 text-sm
                       focus:outline-none focus:border-dpurple-700 transition-colors" />
            </div>

            <!-- Content -->
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Tarina</label>
              <textarea v-model="mContent" rows="10" placeholder="Kerro tarinasi..."
                class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                       text-gray-200 placeholder-gray-700 text-sm leading-relaxed
                       focus:outline-none focus:border-dpurple-700 resize-y transition-colors" />
            </div>

            <!-- ── Media section ── -->
            <div>
              <label class="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Kuvat ja videot</span>
                <span :class="(editingStory?.media.length ?? 0) + mFiles.length >= 5 ? 'text-red-400' : 'text-gray-600'">
                  {{ (editingStory?.media.length ?? 0) + mFiles.length }} / 5
                </span>
              </label>

              <!-- Existing media (edit mode) -->
              <div v-if="editingStory?.media.length" class="flex flex-wrap gap-2 mb-3">
                <div v-for="m in editingStory.media" :key="m._id"
                  class="relative w-16 h-16 rounded-xl overflow-hidden bg-black/40 border border-gray-800">
                  <video v-if="m.mediaType === 'video'" :src="m.url" preload="none"
                    class="w-full h-full object-cover" />
                  <img v-else :src="m.url" class="w-full h-full object-cover" />
                  <button @click="deleteMedia(editingStory, m._id)"
                    :disabled="mediaDeleting === m._id"
                    class="absolute inset-0 flex items-center justify-center
                           bg-black/0 hover:bg-black/60 text-transparent hover:text-red-400
                           border-0 transition-all disabled:opacity-40">
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Drop zone -->
              <div v-if="(editingStory?.media.length ?? 0) + mFiles.length < 5"
                class="border-2 border-dashed rounded-xl px-4 py-6 text-center transition-colors cursor-pointer"
                :class="mDragOver
                  ? 'border-dpurple-600 bg-dpurple-900/10'
                  : 'border-gray-800 hover:border-gray-700'"
                @dragover.prevent="mDragOver = true"
                @dragleave="mDragOver = false"
                @drop.prevent="onModalDrop"
                @click="($refs.fileInput as HTMLInputElement).click()">
                <Upload class="w-5 h-5 mx-auto mb-1.5"
                  :class="mDragOver ? 'text-dpurple-400' : 'text-gray-600'" />
                <p class="text-xs" :class="mDragOver ? 'text-dpurple-400' : 'text-gray-600'">
                  Raahaa tai klikkaa · Kuvat, HEIC, videot (max 1 GB/video)
                </p>
                <input ref="fileInput" type="file" multiple accept="image/*,video/*" class="hidden"
                  @change="addFiles(Array.from(($event.target as HTMLInputElement).files || []))" />
              </div>

              <!-- Upload queue -->
              <div v-if="mFiles.length" class="flex flex-col gap-1 mt-2">
                <div v-for="(f, i) in mFiles" :key="i"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-gray-800">
                  <Film v-if="f.type.startsWith('video/')" class="w-3.5 h-3.5 text-dpurple-400 shrink-0" />
                  <span v-else class="w-3.5 h-3.5 shrink-0 text-center text-xs text-gray-500">🖼</span>
                  <span class="flex-1 text-xs text-gray-400 truncate">{{ f.name }}</span>
                  <!-- progress bar -->
                  <div v-if="mProgress[i] !== undefined && mProgress[i] < 100"
                    class="w-16 h-1 rounded bg-gray-800 overflow-hidden">
                    <div class="h-full bg-dpurple-600 transition-all"
                      :style="{ width: mProgress[i] + '%' }" />
                  </div>
                  <Check v-else-if="mProgress[i] === 100" class="w-3.5 h-3.5 text-dgreen-400" />
                  <button v-else @click="removeQueuedFile(i)"
                    class="border-0 bg-transparent p-0 text-gray-700 hover:text-red-400 transition-colors">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-800/60">
            <button @click="closeModal"
              class="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300
                     border-0 bg-transparent transition-colors">
              Peruuta
            </button>
            <button @click="saveModal"
              :disabled="mSaving || mUploading"
              class="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium border-0
                     bg-dpurple-800/60 hover:bg-dpurple-700/60 text-white
                     disabled:opacity-50 transition-all">
              <span v-if="mUploading">Ladataan mediaa...</span>
              <span v-else-if="mSaving">Tallennetaan...</span>
              <template v-else>
                <Check class="w-4 h-4" />
                {{ editingStory ? 'Tallenna muutokset' : 'Julkaise tarina' }}
              </template>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Delete confirm ── -->
    <Teleport to="body">
      <div v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div class="w-full max-w-sm bg-gray-950 border border-gray-800/60 rounded-2xl overflow-hidden">
          <div class="h-1 w-full bg-gradient-to-r from-red-900/60 via-red-700/60 to-red-900/60" />
          <div class="p-6 text-center">
            <div class="w-10 h-10 rounded-2xl bg-red-950/60 border border-red-900/40
                        flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-5 h-5 text-red-400" />
            </div>
            <h3 class="text-base font-bold text-white mb-1">Poistetaanko tarina?</h3>
            <p class="text-sm text-gray-400 mb-2">
              "{{ deleteTarget.title }}"
            </p>
            <p class="text-xs text-gray-500 mb-6">Poisto on pysyvä ja kaikki media poistetaan.</p>
            <div class="flex gap-2 justify-center">
              <button @click="deleteTarget = null"
                class="px-4 py-2 rounded-xl text-sm text-gray-400 border border-gray-700
                       hover:border-gray-600 transition-all bg-transparent">
                Peruuta
              </button>
              <button @click="confirmDelete"
                class="px-4 py-2 rounded-xl text-sm font-medium border-0
                       bg-red-900/60 hover:bg-red-800/60 text-red-300 transition-all">
                Poista
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Toasts ── -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <div v-for="t in toasts" :key="t.id"
        class="px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
        :class="(t as any).type === 'error'
          ? 'bg-red-950 border border-red-800/60 text-red-300'
          : 'bg-dgreen-950 border border-dgreen-800/60 text-dgreen-300'">
        {{ (t as any).msg }}
      </div>
    </div>

  </div>
</template>


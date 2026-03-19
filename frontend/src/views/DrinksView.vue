<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus, GlassWater, ChevronDown, Trash2, X, AlertTriangle, User, Pencil, Film, ImageIcon, CheckCircle2 } from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

interface Drink {
  _id: string;
  name: string;
  instructions: string;
  author: string;
  imageUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | '';
  blobName: string;
  createdAt: string;
}

const auth = useAuthStore();
const drinks = ref<Drink[]>([]);
const loading = ref(true);
const expandedId = ref<string | null>(null);
const deleting = ref<string | null>(null);

// â”€â”€ Add modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const modalOpen = ref(false);
const saving = ref(false);
const saveError = ref('');
const form = ref({ name: '', instructions: '' });
const addFileRef = ref<HTMLInputElement | null>(null);
const addFilePreview = ref<{ url: string; type: 'image' | 'video'; name: string } | null>(null);
const addUploadProgress = ref(0);
const addUploadDone = ref(false);

// â”€â”€ Edit modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const editTarget = ref<Drink | null>(null);
const editForm = ref({ name: '', instructions: '' });
const editSaving = ref(false);
const editError = ref('');
const editFileRef = ref<HTMLInputElement | null>(null);
const editFilePreview = ref<{ url: string; type: 'image' | 'video'; name: string } | null>(null);
const editRemoveMedia = ref(false);
const editUploadProgress = ref(0);
const editUploadDone = ref(false);

// â”€â”€ Delete confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const deleteTarget = ref<Drink | null>(null);

async function fetchDrinks() {
  try {
    const { data } = await api.get('/drinks');
    drinks.value = data;
  } finally {
    loading.value = false;
  }
}
onMounted(fetchDrinks);

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function canEdit(d: Drink) {
  return auth.isAdmin || (auth.isLoggedIn && auth.username === d.author);
}

// â”€â”€ File pick helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HEIC_PREVIEW_RE = /\.(heic|heif)$/i;
function onAddFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const isVid = file.type.startsWith('video/');
  const noPreview = HEIC_PREVIEW_RE.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
  const url = noPreview ? '' : URL.createObjectURL(file);
  addFilePreview.value = { url, type: isVid ? 'video' : 'image', name: file.name };
}
function onEditFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const isVid = file.type.startsWith('video/');
  const noPreview = HEIC_PREVIEW_RE.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
  const url = noPreview ? '' : URL.createObjectURL(file);
  editFilePreview.value = { url, type: isVid ? 'video' : 'image', name: file.name };
  editRemoveMedia.value = false;
}
function clearAddFile() {
  addFilePreview.value = null;
  if (addFileRef.value) addFileRef.value.value = '';
}
function clearEditFile() {
  editFilePreview.value = null;
  editRemoveMedia.value = false;
  if (editFileRef.value) editFileRef.value.value = '';
}

// â”€â”€ Add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openModal() {
  form.value = { name: '', instructions: '' };
  saveError.value = '';
  addFilePreview.value = null;
  addUploadProgress.value = 0;
  addUploadDone.value = false;
  modalOpen.value = true;
}
async function submit() {
  if (!form.value.name.trim() || !form.value.instructions.trim()) return;
  saving.value = true;
  saveError.value = '';
  addUploadProgress.value = 0;
  addUploadDone.value = false;
  const file = addFileRef.value?.files?.[0];
  try {
    const fd = new FormData();
    fd.append('name', form.value.name);
    fd.append('instructions', form.value.instructions);
    if (file) fd.append('media', file);
    const { data } = await api.post('/drinks', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: file
        ? (e: any) => { addUploadProgress.value = e.total ? Math.round((e.loaded / e.total) * 100) : 50; }
        : undefined,
    });
    if (file) {
      addUploadProgress.value = 100;
      addUploadDone.value = true;
      await new Promise(r => setTimeout(r, 900));
    }
    drinks.value.unshift(data);
    modalOpen.value = false;
  } catch (e: any) {
    saveError.value = e.response?.data?.message || 'Lisäys epäonnistui';
  } finally {
    saving.value = false;
  }
}

// â”€â”€ Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openEdit(d: Drink) {
  editTarget.value = d;
  editForm.value = { name: d.name, instructions: d.instructions };
  editError.value = '';
  editFilePreview.value = null;
  editRemoveMedia.value = false;
  editUploadProgress.value = 0;
  editUploadDone.value = false;
}
async function submitEdit() {
  if (!editTarget.value) return;
  editSaving.value = true;
  editError.value = '';
  editUploadProgress.value = 0;
  editUploadDone.value = false;
  const file = editFileRef.value?.files?.[0];
  try {
    const fd = new FormData();
    fd.append('name', editForm.value.name);
    fd.append('instructions', editForm.value.instructions);
    if (editRemoveMedia.value) fd.append('removeMedia', 'true');
    if (file) fd.append('media', file);
    const { data } = await api.put(`/drinks/${editTarget.value._id}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: file
        ? (e: any) => { editUploadProgress.value = e.total ? Math.round((e.loaded / e.total) * 100) : 50; }
        : undefined,
    });
    if (file) {
      editUploadProgress.value = 100;
      editUploadDone.value = true;
      await new Promise(r => setTimeout(r, 900));
    }
    const idx = drinks.value.findIndex(d => d._id === data._id);
    if (idx !== -1) drinks.value[idx] = data;
    editTarget.value = null;
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    editSaving.value = false;
  }
}

// â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function confirmDelete(d: Drink) {
  deleteTarget.value = d;
}
async function doDelete() {
  if (!deleteTarget.value) return;
  const id = deleteTarget.value._id;
  deleting.value = id;
  deleteTarget.value = null;
  try {
    await api.delete(`/drinks/${id}`);
    drinks.value = drinks.value.filter(d => d._id !== id);
    if (expandedId.value === id) expandedId.value = null;
  } finally {
    deleting.value = null;
  }
}

// â”€â”€ Computed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sorted = computed(() => [...drinks.value].sort((a, b) => a.name.localeCompare(b.name, 'fi')));

function drinkMedia(d: Drink): { url: string; type: 'image' | 'video' } | null {
  const url = d.mediaUrl || d.imageUrl;
  if (!url) return null;
  const type: 'image' | 'video' = d.mediaType === 'video' ? 'video' : 'image';
  return { url, type };
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-10">

    <div class="flex items-center justify-between mb-8 gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Juomat</h1>
        <p class="text-xs text-gray-600 mt-0.5">{{ drinks.length }} drinkkiä</p>
      </div>
      <button v-if="auth.isLoggedIn" @click="openModal"
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
               bg-dpurple-900/50 hover:bg-dpurple-800/50 border border-dpurple-800/50
               text-dpurple-300 transition-all duration-150">
        <Plus class="w-4 h-4" />Lisää drinkki
      </button>
    </div>

    <div v-if="loading" class="text-gray-600 text-sm py-16 text-center">Ladataan...</div>

    <div v-else-if="!sorted.length" class="text-center py-20 text-gray-700">
      <GlassWater class="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p class="text-sm">Ei drinkkejä vielä.</p>
      <p v-if="auth.isLoggedIn" class="text-xs mt-1 text-gray-800">Ole ensimmäinen!</p>
    </div>

    <!-- Korttiruudukko -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="d in sorted" :key="d._id"
        class="group rounded-2xl bg-gray-950 border overflow-hidden flex flex-col transition-all duration-200"
        :class="expandedId === d._id
          ? 'border-dpurple-700/60 shadow-lg shadow-dpurple-950/40 sm:col-span-2 lg:col-span-3'
          : 'border-gray-800/60 hover:border-dpurple-900/60 hover:shadow-md hover:shadow-dpurple-950/20'"
      >
        <!-- Kortin yläosa -->
        <div class="px-4 py-3.5 cursor-pointer select-none"
          @click="toggleExpand(d._id)">

          <!-- Ylärivin: nimi + toimintopainikkeet -->
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-white leading-tight">{{ d.name }}</p>
            <div class="flex items-center gap-1 shrink-0 mt-[-2px]">
              <!-- Edit -->
              <button
                v-if="canEdit(d)"
                @click.stop="openEdit(d)"
                class="p-1.5 rounded-lg text-gray-700 hover:text-dpurple-400 hover:bg-dpurple-900/20
                       opacity-0 group-hover:opacity-100 transition-all border-0 bg-transparent"
                title="Muokkaa"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <!-- Delete -->
              <button
                v-if="canEdit(d)"
                @click.stop="confirmDelete(d)"
                :disabled="deleting === d._id"
                class="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-900/20
                       opacity-0 group-hover:opacity-100 transition-all border-0 bg-transparent"
                title="Poista"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
              <div class="p-1.5 text-gray-600 transition-transform duration-200"
                   :class="expandedId === d._id ? 'rotate-180' : ''">
                <ChevronDown class="w-4 h-4" />
              </div>
            </div>
          </div>

          <!-- Alariivi: kuva vasemmalla + tekijä oikealla -->
          <div class="flex items-center gap-3 mt-2">
            <div class="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border border-dpurple-800/40">
              <template v-if="drinkMedia(d)">
                <img v-if="drinkMedia(d)!.type === 'image'"
                  :src="drinkMedia(d)!.url" :alt="d.name"
                  class="w-full h-full object-cover" />
                <div v-else class="w-full h-full bg-dpurple-900/50 flex items-center justify-center">
                  <Film class="w-5 h-5 text-dpurple-400" />
                </div>
              </template>
              <div v-else class="w-full h-full bg-dpurple-900/50 flex items-center justify-center">
                <GlassWater class="w-5 h-5 text-dpurple-400" />
              </div>
            </div>
            <p class="text-xs text-gray-600 flex items-center gap-1">
              <User class="w-3 h-3" />{{ d.author }}
            </p>
          </div>
        </div>

        <!-- Collapsed preview -->
        <div v-if="expandedId !== d._id" class="px-4 pb-3.5 -mt-1">
          <p class="text-xs text-gray-600 truncate leading-relaxed">
            {{ d.instructions.split('\n')[0] }}
          </p>
        </div>

        <!-- Expanded content -->
        <div v-if="expandedId === d._id"
          class="px-4 pb-5 border-t border-gray-800/50 pt-4">
          <div class="flex gap-4 items-start" :class="drinkMedia(d) ? 'flex-col sm:flex-row' : ''">

            <!-- Media -->
            <div v-if="drinkMedia(d)" class="w-full sm:w-48 flex-shrink-0">
              <img v-if="drinkMedia(d)!.type === 'image'"
                :src="drinkMedia(d)!.url" :alt="d.name"
                class="w-full rounded-xl object-cover border border-gray-800 max-h-48 sm:max-h-none" />
              <video v-else
                :src="drinkMedia(d)!.url"
                controls
                class="w-full rounded-xl border border-gray-800 max-h-48 sm:max-h-none"
              />
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{{ d.instructions }}</p>
            </div>
          </div>

          <!-- Muokkaa/Poista expanded (mobiili hover ei toimi) -->
          <div v-if="canEdit(d)" class="mt-4 flex justify-end gap-2">
            <button @click.stop="openEdit(d)"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border-0
                     text-dpurple-400/70 hover:text-dpurple-300 hover:bg-dpurple-900/20 transition-all bg-transparent">
              <Pencil class="w-3.5 h-3.5" />Muokkaa
            </button>
            <button @click.stop="confirmDelete(d)" :disabled="deleting === d._id"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border-0
                     text-red-500/70 hover:text-red-400 hover:bg-red-900/20 transition-all bg-transparent">
              <Trash2 class="w-3.5 h-3.5" />Poista
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ LISÃ„Ã„ DRINKKI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <Teleport to="body">
    <div v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="modalOpen = false" />
      <div class="relative w-full sm:max-w-md bg-gray-950 border border-gray-800
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10">
        <div class="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-800">
          <GlassWater class="w-4 h-4 text-dpurple-500" />
          <h3 class="text-base font-bold text-white">Lisää drinkki</h3>
          <button @click="modalOpen = false"
            class="ml-auto p-1 rounded-lg text-gray-600 hover:text-white transition-colors border-0 bg-transparent">
            <X class="w-5 h-5" />
          </button>
        </div>
        <form @submit.prevent="submit" class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1.5">Nimi *</label>
            <input v-model="form.name" type="text" placeholder="esim. Kanniaali Yöpalo"
              required maxlength="100"
              class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                     placeholder-gray-700 focus:outline-none focus:border-dpurple-700 transition-colors" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5">Ohje / ainesosat *</label>
            <textarea v-model="form.instructions" rows="6"
              placeholder="Kerro valmistusohje, ainesosat ja annosmäärät..."
              required maxlength="2000"
              class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                     placeholder-gray-700 focus:outline-none focus:border-dpurple-700 transition-colors resize-none" />
          </div>
          <!-- Media upload -->
          <div>
            <label class="block text-xs text-gray-500 mb-1.5">Kuva tai video (max 50 MB, valinnainen)</label>
            <div v-if="addFilePreview" class="mb-3 w-36 rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
              <div class="h-24 overflow-hidden">
                <template v-if="addFilePreview.url">
                  <img v-if="addFilePreview.type === 'image'" :src="addFilePreview.url" class="w-full h-full object-cover" />
                  <video v-else :src="addFilePreview.url" class="w-full h-full object-cover" />
                </template>
                <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1 bg-dpurple-900/30 px-2">
                  <ImageIcon class="w-6 h-6 text-dpurple-400/60" />
                  <p class="text-[10px] text-gray-500 text-center leading-tight break-all">{{ addFilePreview.name }}</p>
                </div>
              </div>
              <div class="px-2 py-1 border-t border-gray-700 flex justify-center">
                <button type="button" @click="clearAddFile"
                  class="text-[11px] text-red-400 hover:text-red-300 border-0 bg-transparent p-0 leading-none">
                  poista
                </button>
              </div>
            </div>
            <label class="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-700
                          text-xs text-gray-500 hover:border-dpurple-700 hover:text-dpurple-400 cursor-pointer transition-colors">
              <ImageIcon class="w-4 h-4" />Valitse tiedosto...
              <input ref="addFileRef" type="file" accept="image/*,video/*" class="hidden" @change="onAddFilePick" />
            </label>
            <!-- Progress bar -->
            <div v-if="addUploadProgress > 0 && !addUploadDone" class="mt-2.5 space-y-1">
              <div class="flex justify-between text-xs text-gray-500">
                <span>Ladataan...</span>
                <span>{{ addUploadProgress }}%</span>
              </div>
              <div class="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-dpurple-700 to-dpurple-500 rounded-full transition-all duration-300 ease-out"
                     :style="`width: ${addUploadProgress}%`" />
              </div>
            </div>
            <!-- Success -->
            <div v-if="addUploadDone"
              class="mt-2.5 flex items-center gap-2 text-xs text-dgreen-400 animate-pulse">
              <CheckCircle2 class="w-4 h-4 text-dgreen-400" />Ladattu onnistuneesti!
            </div>
          </div>
          <p v-if="saveError" class="text-xs text-red-400">{{ saveError }}</p>
          <div class="flex items-center justify-end gap-2 pt-1 pb-1">
            <button type="button" @click="modalOpen = false"
              class="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors border-0 bg-transparent">
              Peruuta
            </button>
            <button type="submit" :disabled="saving || !form.name.trim() || !form.instructions.trim()"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-0
                     bg-dpurple-900/60 hover:bg-dpurple-800/60 text-dpurple-300 disabled:opacity-40 transition-all">
              <Plus class="w-4 h-4" />{{ saving ? 'Tallennetaan...' : 'Lisää' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- â”€â”€ MUOKKAA DRINKKI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <Teleport to="body">
    <div v-if="editTarget"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="editTarget = null" />
      <div class="relative w-full sm:max-w-md bg-gray-950 border border-gray-800
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10">
        <div class="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-800">
          <Pencil class="w-4 h-4 text-dpurple-500" />
          <h3 class="text-base font-bold text-white">Muokkaa: {{ editTarget.name }}</h3>
          <button @click="editTarget = null"
            class="ml-auto p-1 rounded-lg text-gray-600 hover:text-white transition-colors border-0 bg-transparent">
            <X class="w-5 h-5" />
          </button>
        </div>
        <form @submit.prevent="submitEdit" class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1.5">Nimi *</label>
            <input v-model="editForm.name" type="text" required maxlength="100"
              class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                     focus:outline-none focus:border-dpurple-700 transition-colors" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5">Ohje / ainesosat *</label>
            <textarea v-model="editForm.instructions" rows="6" required maxlength="2000"
              class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                     focus:outline-none focus:border-dpurple-700 transition-colors resize-none" />
          </div>
          <!-- Nykyinen media -->
          <div v-if="drinkMedia(editTarget) && !editRemoveMedia && !editFilePreview">
            <label class="block text-xs text-gray-500 mb-1.5">Nykyinen media</label>
            <div class="w-36 rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
              <div class="h-24 overflow-hidden">
                <img v-if="drinkMedia(editTarget)!.type === 'image'" :src="drinkMedia(editTarget)!.url"
                  class="w-full h-full object-cover" />
                <video v-else :src="drinkMedia(editTarget)!.url" class="w-full h-full object-cover" />
              </div>
              <div class="px-2 py-1 border-t border-gray-700 flex justify-center">
                <button type="button" @click="editRemoveMedia = true"
                  class="text-[11px] text-red-400 hover:text-red-300 border-0 bg-transparent p-0 leading-none">
                  poista
                </button>
              </div>
            </div>
          </div>
          <!-- Uusi media -->
          <div v-if="!drinkMedia(editTarget) || editRemoveMedia || editFilePreview">
            <label class="block text-xs text-gray-500 mb-1.5">Kuva tai video (max 50 MB)</label>
            <div v-if="editFilePreview" class="mb-3 w-36 rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
              <div class="h-24 overflow-hidden">
                <template v-if="editFilePreview.url">
                  <img v-if="editFilePreview.type === 'image'" :src="editFilePreview.url" class="w-full h-full object-cover" />
                  <video v-else :src="editFilePreview.url" class="w-full h-full object-cover" />
                </template>
                <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1 bg-dpurple-900/30 px-2">
                  <ImageIcon class="w-6 h-6 text-dpurple-400/60" />
                  <p class="text-[10px] text-gray-500 text-center leading-tight break-all">{{ editFilePreview.name }}</p>
                </div>
              </div>
              <div class="px-2 py-1 border-t border-gray-700 flex justify-center">
                <button type="button" @click="clearEditFile"
                  class="text-[11px] text-red-400 hover:text-red-300 border-0 bg-transparent p-0 leading-none">
                  poista
                </button>
              </div>
            </div>
            <label class="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-700
                          text-xs text-gray-500 hover:border-dpurple-700 hover:text-dpurple-400 cursor-pointer transition-colors">
              <ImageIcon class="w-4 h-4" />Valitse tiedosto...
              <input ref="editFileRef" type="file" accept="image/*,video/*" class="hidden" @change="onEditFilePick" />
            </label>
            <!-- Progress bar -->
            <div v-if="editUploadProgress > 0 && !editUploadDone" class="mt-2.5 space-y-1">
              <div class="flex justify-between text-xs text-gray-500">
                <span>Ladataan...</span>
                <span>{{ editUploadProgress }}%</span>
              </div>
              <div class="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-dpurple-700 to-dpurple-500 rounded-full transition-all duration-300 ease-out"
                     :style="`width: ${editUploadProgress}%`" />
              </div>
            </div>
            <!-- Success -->
            <div v-if="editUploadDone"
              class="mt-2.5 flex items-center gap-2 text-xs text-dgreen-400 animate-pulse">
              <CheckCircle2 class="w-4 h-4 text-dgreen-400" />Ladattu onnistuneesti!
            </div>
          </div>
          <p v-if="editError" class="text-xs text-red-400">{{ editError }}</p>
          <div class="flex items-center justify-end gap-2 pt-1 pb-1">
            <button type="button" @click="editTarget = null"
              class="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors border-0 bg-transparent">
              Peruuta
            </button>
            <button type="submit" :disabled="editSaving || !editForm.name.trim() || !editForm.instructions.trim()"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-0
                     bg-dpurple-900/60 hover:bg-dpurple-800/60 text-dpurple-300 disabled:opacity-40 transition-all">
              {{ editSaving ? 'Tallennetaan...' : 'Tallenna' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- â”€â”€ POISTOVAHVISTUS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
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
              <h3 class="text-sm font-bold text-white mb-1">Poistetaanko drinkki?</h3>
              <p class="text-sm text-gray-400">
                <span class="text-white font-medium">{{ deleteTarget?.name }}</span>
                — tätä ei voi peruuttaa.
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="deleteTarget = null"
              class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-800
                     text-gray-400 hover:text-white hover:border-gray-700 transition-all bg-transparent">
              Peruuta
            </button>
            <button @click="doDelete" :disabled="!!deleting"
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

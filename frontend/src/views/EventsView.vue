<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  Calendar, Clock, MapPin, User, Phone, Plus, Pencil, Trash2,
  X, Check, Upload, Lock, ChevronDown, ChevronUp, Users,
} from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

interface Rsvp { userId: string; username: string; status: 'attending' | 'not_attending' | 'maybe' }
interface Event {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: string;
  contactName: string;
  contactPhone: string;
  imageUrl: string;
  blobName: string;
  createdBy: string;
  createdById: string;
  rsvps: Rsvp[];
  createdAt: string;
}

// ── State ──
const events  = ref<Event[]>([]);
const loading = ref(true);
const expandedPast = ref(false);

// Toast
interface Toast { id: number; msg: string; type: 'success' | 'error' }
const toasts = ref<Toast[]>([]);
let _tid = 0;
function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const id = ++_tid;
  toasts.value.push({ id, msg, type });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3500);
}

const now = ref(new Date());
onMounted(async () => {
  setInterval(() => { now.value = new Date(); }, 60_000);
  if (!auth.isLoggedIn) { loading.value = false; return; }
  try {
    const { data } = await api.get('/events');
    events.value = data;
  } finally {
    loading.value = false;
  }
});

// ── Derived ──
const upcoming = computed(() => events.value.filter(e => new Date(e.endDate || e.startDate) >= now.value).sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)));
const past     = computed(() => events.value.filter(e => new Date(e.endDate || e.startDate) < now.value).sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate)));

function isOngoing(e: Event) {
  const s = new Date(e.startDate);
  const en = e.endDate ? new Date(e.endDate) : s;
  return s <= now.value && now.value <= en;
}

function myRsvp(e: Event) {
  return e.rsvps.find(r => r.userId === (auth as any).userId || r.username === auth.username)?.status ?? null;
}
function rsvpCount(e: Event, status: Rsvp['status']) {
  return e.rsvps.filter(r => r.status === status).length;
}
function attendees(e: Event) {
  return e.rsvps.filter(r => r.status === 'attending').map(r => r.username);
}

function isOwner(e: Event) {
  return e.createdBy === auth.username || auth.isAdmin;
}

// ── Formatting ──
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateFull(d: string) {
  return new Date(d).toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── RSVP ──
const rsvpSaving = ref<string | null>(null);
async function setRsvp(event: Event, status: Rsvp['status']) {
  rsvpSaving.value = event._id;
  try {
    const { data } = await api.post(`/events/${event._id}/rsvp`, { status });
    event.rsvps = data.rsvps;
  } catch (err: any) {
    showToast(err.response?.data?.message || 'RSVP epäonnistui', 'error');
  } finally {
    rsvpSaving.value = null;
  }
}

// ── Modal ──
const modalOpen    = ref(false);
const editingEvent = ref<Event | null>(null);
const mTitle       = ref('');
const mDesc        = ref('');
const mStartDate   = ref('');
const mStartTime   = ref('');
const mEndDate     = ref('');
const mEndTime     = ref('');
const mLocation    = ref('');
const mContact     = ref('');
const mPhone       = ref('');
const mFile        = ref<File | null>(null);
const mDragOver    = ref(false);
const mSaving      = ref(false);
const mUploading   = ref(false);
const mError       = ref('');

function toDateInput(d?: string) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}
function toTimeInput(d?: string) {
  if (!d) return '';
  return new Date(d).toISOString().slice(11, 16);
}
function combineDateTime(date: string, time: string) {
  if (!date) return '';
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

function openAddModal() {
  editingEvent.value = null;
  mTitle.value = ''; mDesc.value = '';
  mStartDate.value = ''; mStartTime.value = '';
  mEndDate.value = ''; mEndTime.value = '';
  mLocation.value = ''; mContact.value = ''; mPhone.value = '';
  mFile.value = null; mError.value = '';
  modalOpen.value = true;
}
function openEditModal(e: Event) {
  editingEvent.value = e;
  mTitle.value       = e.title;
  mDesc.value        = e.description;
  mStartDate.value   = toDateInput(e.startDate);
  mStartTime.value   = toTimeInput(e.startDate);
  mEndDate.value     = toDateInput(e.endDate);
  mEndTime.value     = toTimeInput(e.endDate);
  mLocation.value    = e.location;
  mContact.value     = e.contactName;
  mPhone.value       = e.contactPhone;
  mFile.value = null; mError.value = '';
  modalOpen.value = true;
}
function closeModal() {
  if (mSaving.value || mUploading.value) return;
  modalOpen.value = false; editingEvent.value = null;
}
function onDrop(ev: DragEvent) {
  mDragOver.value = false;
  const f = ev.dataTransfer?.files[0];
  if (f && f.type.startsWith('image/')) mFile.value = f;
}

async function saveModal() {
  if (!mTitle.value.trim()) { mError.value = 'Nimi vaaditaan'; return; }
  if (!mStartDate.value)    { mError.value = 'Alkamisaika vaaditaan'; return; }
  mSaving.value = true; mError.value = '';
  const payload = {
    title:        mTitle.value.trim(),
    description:  mDesc.value.trim(),
    startDate:    combineDateTime(mStartDate.value, mStartTime.value),
    endDate:      mEndDate.value ? combineDateTime(mEndDate.value, mEndTime.value) : null,
    location:     mLocation.value.trim(),
    contactName:  mContact.value.trim(),
    contactPhone: mPhone.value.trim(),
  };
  try {
    let saved: Event;
    if (editingEvent.value) {
      const { data } = await api.put(`/events/${editingEvent.value._id}`, payload);
      saved = data;
      const idx = events.value.findIndex(e => e._id === saved._id);
      if (idx !== -1) events.value[idx] = { ...events.value[idx], ...saved };
    } else {
      const { data } = await api.post('/events', payload);
      saved = data;
      events.value.push({ ...saved, rsvps: [] });
    }
    if (mFile.value) {
      mUploading.value = true;
      const fd = new FormData();
      fd.append('file', mFile.value);
      try {
        const { data } = await api.post(`/events/${saved._id}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const idx = events.value.findIndex(e => e._id === saved._id);
        if (idx !== -1) events.value[idx].imageUrl = data.imageUrl;
        if (editingEvent.value) editingEvent.value.imageUrl = data.imageUrl;
      } catch { /* image upload failure non-fatal */ }
      mUploading.value = false;
    }
    showToast(editingEvent.value ? 'Tapahtuma päivitetty' : 'Tapahtuma luotu');
    modalOpen.value = false; editingEvent.value = null;
  } catch (err: any) {
    mError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    mSaving.value = false;
  }
}

// ── Delete ──
const deleteTarget = ref<Event | null>(null);
async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await api.delete(`/events/${deleteTarget.value._id}`);
    events.value = events.value.filter(e => e._id !== deleteTarget.value!._id);
    showToast('Tapahtuma poistettu');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Poisto epäonnistui', 'error');
  } finally {
    deleteTarget.value = null;
  }
}

// ── Image delete ──
async function deleteImage(event: Event) {
  try {
    await api.delete(`/events/${event._id}/image`);
    const idx = events.value.findIndex(e => e._id === event._id);
    if (idx !== -1) events.value[idx].imageUrl = '';
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Poisto epäonnistui', 'error');
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">

    <!-- Auth gate -->
    <div v-if="!auth.isLoggedIn" class="text-center py-24 flex flex-col items-center gap-6">
      <div class="w-16 h-16 rounded-2xl bg-dgreen-900/40 border border-dgreen-800/40
                  flex items-center justify-center">
        <Lock class="w-7 h-7 text-dgreen-400" />
      </div>
      <div>
        <h2 class="text-xl font-bold text-white mb-2">Kirjaudu nähdäksesi tapahtumat</h2>
        <p class="text-gray-400 text-sm max-w-xs mx-auto">Tapahtumat ovat vain jäsenille.</p>
      </div>
      <div class="flex gap-3">
        <RouterLink to="/login"
          class="px-5 py-2.5 rounded-xl bg-dgreen-800/60 hover:bg-dgreen-700/60
                 text-white text-sm font-medium transition-all border border-dgreen-700/60">
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

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-white">Tapahtumat</h1>
          <p class="text-gray-400 text-sm mt-1">Seuran tulevat ja menneet tapahtumat</p>
        </div>
        <button @click="openAddModal"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl border-0
                 bg-dgreen-800/60 hover:bg-dgreen-700/60 text-white text-sm font-medium transition-all">
          <Plus class="w-4 h-4" />Lisää tapahtuma
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-gray-400 text-sm py-20 text-center">Ladataan...</div>

      <template v-else>

        <!-- Upcoming events -->
        <div v-if="upcoming.length" class="flex flex-col gap-4 mb-10">
          <article v-for="e in upcoming" :key="e._id"
            class="rounded-2xl overflow-hidden border transition-colors"
            :class="isOngoing(e)
              ? 'border-dgreen-700/60 bg-dgreen-950/20'
              : 'border-gray-800 bg-gray-950 hover:border-gray-700'">

            <!-- Hero image -->
            <div v-if="e.imageUrl" class="relative">
              <img :src="e.imageUrl" :alt="e.title"
                class="w-full h-48 sm:h-60 object-cover" />
              <!-- Ongoing ribbon -->
              <div v-if="isOngoing(e)"
                class="absolute top-3 left-3 px-3 py-1 rounded-full
                       bg-dgreen-700/90 text-dgreen-100 text-xs font-semibold
                       border border-dgreen-600/60 backdrop-blur-sm">
                ● Käynnissä nyt
              </div>
              <!-- Owner image delete -->
              <button v-if="isOwner(e)" @click="deleteImage(e)"
                class="absolute top-2 right-2 w-7 h-7 rounded-full
                       bg-black/40 hover:bg-red-900/80 text-white/60 hover:text-red-300
                       border border-white/15 flex items-center justify-center
                       transition-all backdrop-blur-sm opacity-50 hover:opacity-100">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
            <!-- No image + ongoing ribbon -->
            <div v-else-if="isOngoing(e)" class="px-5 pt-4">
              <span class="px-3 py-1 rounded-full bg-dgreen-700/70 text-dgreen-200
                           text-xs font-semibold border border-dgreen-600/50">
                ● Käynnissä nyt
              </span>
            </div>

            <!-- Card body -->
            <div class="px-5 py-4">
              <div class="flex items-start justify-between gap-2">
                <h2 class="text-lg font-bold text-white leading-snug">{{ e.title }}</h2>
                <div v-if="isOwner(e)" class="flex items-center gap-1 shrink-0">
                  <button @click="openEditModal(e)"
                    class="p-1.5 rounded-lg border-0 text-gray-500 hover:text-white
                           hover:bg-gray-800 transition-all">
                    <Pencil class="w-3.5 h-3.5" />
                  </button>
                  <button @click="deleteTarget = e"
                    class="p-1.5 rounded-lg border-0 text-gray-600 hover:text-red-400
                           hover:bg-red-950/20 transition-all">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Date/time row -->
              <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                <span class="flex items-center gap-1.5">
                  <Calendar class="w-3.5 h-3.5 text-dgreen-500/70 shrink-0" />
                  {{ fmtDateFull(e.startDate) }}
                </span>
                <span class="flex items-center gap-1.5">
                  <Clock class="w-3.5 h-3.5 text-dgreen-500/70 shrink-0" />
                  {{ fmtTime(e.startDate) }}
                  <template v-if="e.endDate"> – {{ fmtTime(e.endDate) }}
                    <span v-if="toDateInput(e.endDate) !== toDateInput(e.startDate)"
                      class="text-xs text-gray-500">({{ fmtDate(e.endDate) }})</span>
                  </template>
                </span>
              </div>

              <div v-if="e.location" class="flex items-start gap-1.5 mt-1.5 text-sm text-gray-400">
                <MapPin class="w-3.5 h-3.5 mt-0.5 text-dgreen-500/70 shrink-0" />
                <span>{{ e.location }}</span>
              </div>

              <p v-if="e.description" class="mt-3 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {{ e.description }}
              </p>

              <!-- Contact -->
              <div v-if="e.contactName || e.contactPhone"
                class="flex flex-wrap gap-x-4 gap-y-0.5 mt-3">
                <span v-if="e.contactName" class="flex items-center gap-1.5 text-xs text-gray-500">
                  <User class="w-3 h-3" />{{ e.contactName }}
                </span>
                <a v-if="e.contactPhone" :href="`tel:${e.contactPhone}`"
                  class="flex items-center gap-1.5 text-xs text-dgreen-400 hover:text-dgreen-300 transition-colors">
                  <Phone class="w-3 h-3" />{{ e.contactPhone }}
                </a>
              </div>

              <!-- RSVP -->
              <div class="mt-4 pt-3 border-t border-gray-800/60">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-gray-500 mr-1">Ilmoittaudu:</span>
                  <button
                    v-for="[status, label, cls] in ([
                      ['attending',     'Osallistun',  'dgreen'],
                      ['maybe',         'Ehkä',        'dpurple'],
                      ['not_attending', 'En osallistu','red'],
                    ] as const)"
                    :key="status"
                    @click="setRsvp(e, status)"
                    :disabled="rsvpSaving === e._id"
                    class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium
                           border transition-all disabled:opacity-50"
                    :class="myRsvp(e) === status
                      ? status === 'attending'     ? 'bg-dgreen-800/70 border-dgreen-700/60 text-dgreen-300'
                      : status === 'maybe'         ? 'bg-dpurple-800/70 border-dpurple-700/60 text-dpurple-300'
                      :                              'bg-red-900/60 border-red-800/50 text-red-300'
                      : 'bg-transparent border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300'">
                    <Check v-if="myRsvp(e) === status" class="w-3 h-3" />
                    {{ label }}
                  </button>
                </div>

                <!-- RSVP counts + attendee list -->
                <div class="flex flex-wrap gap-3 mt-2">
                  <span v-if="rsvpCount(e, 'attending')" class="flex items-center gap-1 text-xs text-dgreen-400/80">
                    <Users class="w-3 h-3" />{{ rsvpCount(e, 'attending') }} osallistuu
                  </span>
                  <span v-if="rsvpCount(e, 'maybe')" class="text-xs text-dpurple-400/80">
                    {{ rsvpCount(e, 'maybe') }} ehkä
                  </span>
                  <span v-if="rsvpCount(e, 'not_attending')" class="text-xs text-gray-600">
                    {{ rsvpCount(e, 'not_attending') }} ei osallistu
                  </span>
                </div>
                <p v-if="attendees(e).length" class="text-xs text-gray-600 mt-1">
                  {{ attendees(e).join(', ') }}
                </p>
              </div>
            </div>
          </article>
        </div>

        <!-- No upcoming -->
        <div v-else-if="!loading"
          class="text-center py-16 text-gray-500 italic text-sm mb-10">
          Ei tulevia tapahtumia. Lisää ensimmäinen!
        </div>

        <!-- Past events collapsible -->
        <div v-if="past.length" class="border border-gray-800 rounded-2xl overflow-hidden">
          <button @click="expandedPast = !expandedPast"
            class="w-full flex items-center justify-between px-5 py-3.5
                   text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-900/50
                   transition-all border-0 bg-transparent text-left">
            <span class="font-medium">Menneet tapahtumat ({{ past.length }})</span>
            <ChevronDown v-if="!expandedPast" class="w-4 h-4" />
            <ChevronUp   v-else               class="w-4 h-4" />
          </button>

          <div v-if="expandedPast" class="border-t border-gray-800/60">
            <article v-for="e in past" :key="e._id"
              class="flex gap-4 px-5 py-4 border-b border-gray-800/40 last:border-b-0
                     opacity-60 hover:opacity-80 transition-opacity">
              <img v-if="e.imageUrl" :src="e.imageUrl" :alt="e.title"
                class="shrink-0 w-16 h-16 rounded-xl object-cover border border-gray-800" />
              <div v-else
                class="shrink-0 w-16 h-16 rounded-xl bg-gray-900 border border-gray-800
                       flex items-center justify-center">
                <Calendar class="w-6 h-6 text-gray-700" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-gray-300">{{ e.title }}</h3>
                <p class="text-xs text-gray-600 mt-0.5">{{ fmtDate(e.startDate) }} · {{ fmtTime(e.startDate) }}</p>
                <p v-if="e.location" class="text-xs text-gray-600">{{ e.location }}</p>
                <div class="flex gap-2 mt-1">
                  <span v-if="rsvpCount(e, 'attending')" class="text-xs text-gray-600">
                    {{ rsvpCount(e, 'attending') }} osallistui
                  </span>
                </div>
              </div>
              <div v-if="isOwner(e)" class="flex items-center gap-1 shrink-0">
                <button @click="openEditModal(e)"
                  class="p-1.5 rounded-lg border-0 text-gray-600 hover:text-white hover:bg-gray-800 transition-all">
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button @click="deleteTarget = e"
                  class="p-1.5 rounded-lg border-0 text-gray-700 hover:text-red-400 hover:bg-red-950/20 transition-all">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          </div>
        </div>

      </template>
    </template>

    <!-- ── Create / Edit modal ── -->
    <Teleport to="body">
      <div v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        @click.self="closeModal">
        <div class="relative w-full max-w-2xl bg-gray-950 border border-gray-800/60 rounded-2xl
                    flex flex-col max-h-[92vh] overflow-hidden">
          <div class="h-1 w-full bg-gradient-to-r from-dgreen-900/60 via-dgreen-600/60 to-dgreen-900/60" />

          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
            <h2 class="text-base font-bold text-white">
              {{ editingEvent ? 'Muokkaa tapahtumaa' : 'Uusi tapahtuma' }}
            </h2>
            <button @click="closeModal"
              class="border-0 bg-transparent p-1 text-gray-600 hover:text-gray-300 transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div v-if="mError"
              class="px-3 py-2 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-sm">
              {{ mError }}
            </div>

            <!-- Title -->
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Tapahtuman nimi *</label>
              <input v-model="mTitle" type="text" placeholder="Esim. Kesäkokous 2026"
                class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                       text-gray-200 placeholder-gray-700 text-sm
                       focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>

            <!-- Start date/time -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1.5">Alkaa – päivämäärä *</label>
                <input v-model="mStartDate" type="date"
                  class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                         text-gray-200 text-sm focus:outline-none focus:border-dgreen-700 transition-colors
                         [color-scheme:dark]" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1.5">Alkaa – kellonaika</label>
                <input v-model="mStartTime" type="time"
                  class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                         text-gray-200 text-sm focus:outline-none focus:border-dgreen-700 transition-colors
                         [color-scheme:dark]" />
              </div>
            </div>

            <!-- End date/time -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1.5">Loppuu – päivämäärä</label>
                <input v-model="mEndDate" type="date"
                  class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                         text-gray-200 text-sm focus:outline-none focus:border-dgreen-700 transition-colors
                         [color-scheme:dark]" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1.5">Loppuu – kellonaika</label>
                <input v-model="mEndTime" type="time"
                  class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                         text-gray-200 text-sm focus:outline-none focus:border-dgreen-700 transition-colors
                         [color-scheme:dark]" />
              </div>
            </div>

            <!-- Location -->
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Tapahtumapaikan osoite</label>
              <input v-model="mLocation" type="text" placeholder="Katuosoite, kaupunki"
                class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                       text-gray-200 placeholder-gray-700 text-sm
                       focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Kuvaus</label>
              <textarea v-model="mDesc" rows="4" placeholder="Lyhyt kuvaus tapahtumasta..."
                class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                       text-gray-200 placeholder-gray-700 text-sm leading-relaxed
                       focus:outline-none focus:border-dgreen-700 resize-y transition-colors" />
            </div>

            <!-- Contact -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1.5">Yhteyshenkilö</label>
                <input v-model="mContact" type="text" placeholder="Nimi"
                  class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                         text-gray-200 placeholder-gray-700 text-sm
                         focus:outline-none focus:border-dgreen-700 transition-colors" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1.5">Puhelinnumero</label>
                <input v-model="mPhone" type="tel" placeholder="+358 40 123 4567"
                  class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                         text-gray-200 placeholder-gray-700 text-sm
                         focus:outline-none focus:border-dgreen-700 transition-colors" />
              </div>
            </div>

            <!-- Hero image -->
            <div>
              <label class="block text-xs text-gray-500 mb-2">Hero-kuva</label>

              <!-- Existing image in edit mode -->
              <div v-if="editingEvent?.imageUrl && !mFile" class="relative mb-2">
                <img :src="editingEvent.imageUrl" class="w-full h-32 object-cover rounded-xl border border-gray-800" />
                <p class="text-[10px] text-gray-600 mt-1">Valitse uusi tiedosto korvataksesi kuvan</p>
              </div>

              <!-- Drop zone -->
              <div class="border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors cursor-pointer"
                :class="mDragOver ? 'border-dgreen-600 bg-dgreen-900/10' : 'border-gray-800 hover:border-gray-700'"
                @dragover.prevent="mDragOver = true"
                @dragleave="mDragOver = false"
                @drop.prevent="onDrop"
                @click="($refs.imgInput as HTMLInputElement).click()">
                <Upload class="w-5 h-5 mx-auto mb-1.5"
                  :class="mDragOver ? 'text-dgreen-400' : 'text-gray-600'" />
                <p class="text-xs" :class="mDragOver ? 'text-dgreen-400' : 'text-gray-600'">
                  {{ mFile ? mFile.name : 'Raahaa tai klikkaa – kuva (max 20 MB, HEIC ok)' }}
                </p>
                <input ref="imgInput" type="file" accept="image/*" class="hidden"
                  @change="mFile = ($event.target as HTMLInputElement).files?.[0] ?? null" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-800/60">
            <button @click="closeModal"
              class="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300
                     border-0 bg-transparent transition-colors">
              Peruuta
            </button>
            <button @click="saveModal" :disabled="mSaving || mUploading"
              class="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium border-0
                     bg-dgreen-800/60 hover:bg-dgreen-700/60 text-white
                     disabled:opacity-50 transition-all">
              <span v-if="mUploading">Ladataan kuvaa...</span>
              <span v-else-if="mSaving">Tallennetaan...</span>
              <template v-else>
                <Check class="w-4 h-4" />
                {{ editingEvent ? 'Tallenna muutokset' : 'Luo tapahtuma' }}
              </template>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
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
            <h3 class="text-base font-bold text-white mb-1">Poistetaanko tapahtuma?</h3>
            <p class="text-sm text-gray-400 mb-5">"{{ deleteTarget.title }}"</p>
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

    <!-- Toasts -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <div v-for="t in toasts" :key="t.id"
        class="px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
        :class="t.type === 'error'
          ? 'bg-red-950 border border-red-800/60 text-red-300'
          : 'bg-dgreen-950 border border-dgreen-800/60 text-dgreen-300'">
        {{ t.msg }}
      </div>
    </div>

  </div>
</template>

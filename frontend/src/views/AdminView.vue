?<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import {
  ShieldCheck, LogOut, Users, Search, Plus,
  Pencil, Trash2, X, Upload, Check, AlertCircle, ImageOff, TriangleAlert,
  ChevronDown, ChevronUp, MapPin, GlassWater, Flame, Cake, Star, Globe, Mail,
  MessageSquare, Link, Copy, UserCheck, UserX, Send,
} from 'lucide-vue-next';
import api from '../api';

interface Member {
  _id: string; name: string; aliases: string[]; quote: string; born: string;
  highestPromille: string; favDrink: string; location: string;
  email: string; website: string; avatarUrl: string; points: number; active: boolean;
}
type FormData = Omit<Member, 'aliases'> & { aliasInput: string };

interface AppUser {
  _id: string; username: string; status: string;
  linkedMember: { _id: string; name: string } | null; createdAt: string;
}

interface Reply { content: string; createdAt: string }
interface Message {
  _id: string; fromUsername: string; content: string;
  read: boolean; replies: Reply[]; createdAt: string;
}

interface InviteCode { _id: string; code: string; expiresAt: string; usedBy: string | null; createdAt: string }

const auth = useAuthStore();
const router = useRouter();

// ── TABS ──
const tab = ref<'jasenet' | 'kayttajat' | 'viestit' | 'kutsukoodit'>('jasenet');

// ── JÄSENET ──
const members = ref<Member[]>([]);
const loading = ref(true);
const search = ref('');
const deleting = ref<string | null>(null);
const expandedId = ref<string | null>(null);
const modalOpen = ref(false);
const saving = ref(false);
const saveError = ref('');
const uploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const confirmSaveOpen = ref(false);
const deleteTarget = ref<Member | null>(null);
const deleteNameInput = ref('');

// Toast
interface Toast { id: number; message: string; type: 'success' | 'error' }
const toasts = ref<Toast[]>([]);
let _toastId = 0;
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const id = ++_toastId;
  toasts.value.push({ id, message, type });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3500);
}

const emptyForm = (): FormData => ({
  _id: '', name: '', aliasInput: '', quote: '', born: '',
  highestPromille: '', favDrink: '', location: '',
  email: '', website: '', avatarUrl: '', points: 0, active: true,
});
const form = ref<FormData>(emptyForm());

async function loadMembers() {
  loading.value = true;
  try {
    const { data } = await api.get('/members/admin');
    members.value = data;
  } finally {
    loading.value = false;
  }
}

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  return !q ? members.value : members.value.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.location || '').toLowerCase().includes(q) ||
    m.aliases.some(a => a.toLowerCase().includes(q))
  );
});

const stats = computed(() => ({
  total: members.value.length,
  active: members.value.filter(m => m.active).length,
  withPhoto: members.value.filter(m => !!m.avatarUrl).length,
}));

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}
function openAdd() {
  form.value = emptyForm();
  saveError.value = '';
  confirmSaveOpen.value = false;
  modalOpen.value = true;
}
function openEdit(m: Member) {
  form.value = { ...m, aliasInput: m.aliases.join(', ') };
  saveError.value = '';
  confirmSaveOpen.value = false;
  modalOpen.value = true;
}
function requestSave() {
  if (!form.value.name.trim()) { saveError.value = 'Nimi vaaditaan'; return; }
  saveError.value = '';
  if (form.value._id) { confirmSaveOpen.value = true; } else { saveMember(); }
}
async function saveMember() {
  confirmSaveOpen.value = false;
  saving.value = true;
  saveError.value = '';
  try {
    const { aliasInput, _id, ...rest } = form.value;
    const payload = { ...rest, aliases: aliasInput.split(',').map(s => s.trim()).filter(Boolean) };
    if (_id) {
      await api.put(`/members/${_id}`, payload);
      showToast(`${payload.name} päivitetty`);
    } else {
      await api.post('/members', payload);
      showToast(`${payload.name} lisätty`);
    }
    await loadMembers();
    modalOpen.value = false;
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    saving.value = false;
  }
}
function openDelete(m: Member) {
  deleteTarget.value = m;
  deleteNameInput.value = '';
}
async function confirmDelete() {
  if (!deleteTarget.value) return;
  if (deleteNameInput.value.trim() !== deleteTarget.value.name) return;
  deleting.value = deleteTarget.value._id;
  const deletedName = deleteTarget.value.name;
  try {
    await api.delete(`/members/${deleteTarget.value._id}`);
    deleteTarget.value = null;
    deleteNameInput.value = '';
    await loadMembers();
    showToast(`${deletedName} piilotettu`);
  } finally {
    deleting.value = null;
  }
}
async function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  saveError.value = '';
  try {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/images/upload?container=avatars', fd);
    form.value.avatarUrl = data.url;
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Kuvan lataus epäonnistui (Azure ei kytketty?)';
  } finally {
    uploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── KÄYTTÄJÄT ──
const users = ref<AppUser[]>([]);
const usersLoading = ref(false);
const linkSaving = ref<string | null>(null);
const linkSelections = ref<Record<string, string>>({});

async function loadUsers() {
  usersLoading.value = true;
  try {
    const { data } = await api.get('/auth/users');
    users.value = data;
    data.forEach((u: AppUser) => {
      linkSelections.value[u._id] = u.linkedMember?._id || '';
    });
  } finally {
    usersLoading.value = false;
  }
}

async function saveLink(userId: string) {
  linkSaving.value = userId;
  try {
    const memberId = linkSelections.value[userId] || null;
    const { data } = await api.put(`/auth/users/${userId}/link`, { memberId });
    const idx = users.value.findIndex(u => u._id === userId);
    if (idx !== -1) users.value[idx] = data;
    showToast('Linkitys tallennettu');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Linkitys epäonnistui', 'error');
  } finally {
    linkSaving.value = null;
  }
}

async function approveUser(userId: string) {
  try {
    await api.post(`/auth/approve/${userId}`);
    const u = users.value.find(u => u._id === userId);
    if (u) u.status = 'active';
    showToast('Käyttäjä hyväksytty');
  } catch { showToast('Hyväksyntä epäonnistui', 'error'); }
}
async function rejectUser(userId: string) {
  try {
    await api.post(`/auth/reject/${userId}`);
    const u = users.value.find(u => u._id === userId);
    if (u) u.status = 'rejected';
    showToast('Käyttäjä hylätty');
  } catch { showToast('Hylkäys epäonnistui', 'error'); }
}

// ── VIESTIT ──
const messages = ref<Message[]>([]);
const messagesLoading = ref(false);
const expandedMsgId = ref<string | null>(null);
const replyTexts = ref<Record<string, string>>({});
const replySaving = ref<string | null>(null);
const unread = computed(() => messages.value.filter(m => !m.read).length);

async function loadMessages() {
  messagesLoading.value = true;
  try {
    const { data } = await api.get('/messages');
    messages.value = data;
  } finally {
    messagesLoading.value = false;
  }
}

async function markRead(msgId: string) {
  try {
    await api.put(`/messages/${msgId}/read`);
    const m = messages.value.find(x => x._id === msgId);
    if (m) m.read = true;
  } catch {}
}

async function sendReply(msgId: string) {
  const content = replyTexts.value[msgId]?.trim();
  if (!content) return;
  replySaving.value = msgId;
  try {
    const { data } = await api.post(`/messages/${msgId}/reply`, { content });
    const idx = messages.value.findIndex(m => m._id === msgId);
    if (idx !== -1) messages.value[idx] = data;
    replyTexts.value[msgId] = '';
    showToast('Vastaus lähetetty');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Vastaus epäonnistui', 'error');
  } finally {
    replySaving.value = null;
  }
}

function toggleMsg(id: string) {
  if (expandedMsgId.value !== id) {
    expandedMsgId.value = id;
    const m = messages.value.find(x => x._id === id);
    if (m && !m.read) markRead(id);
  } else {
    expandedMsgId.value = null;
  }
}

// ── KUTSUKOODIT ──
const invites = ref<InviteCode[]>([]);
const invitesLoading = ref(false);
const generatingInvite = ref(false);
const newInviteCode = ref('');
const copiedCode = ref('');

async function loadInvites() {
  invitesLoading.value = true;
  try {
    const { data } = await api.get('/auth/invites');
    invites.value = data;
  } finally {
    invitesLoading.value = false;
  }
}

async function generateInvite() {
  generatingInvite.value = true;
  newInviteCode.value = '';
  try {
    const { data } = await api.post('/auth/invite');
    newInviteCode.value = data.code;
    await loadInvites();
    showToast('Kutsukoodi luotu');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Luonti epäonnistui', 'error');
  } finally {
    generatingInvite.value = false;
  }
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  copiedCode.value = code;
  setTimeout(() => { copiedCode.value = ''; }, 2000);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fi-FI', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function logout() {
  auth.logout();
  router.push('/login');
}

// Load on tab switch
async function switchTab(t: typeof tab.value) {
  tab.value = t;
  if (t === 'kayttajat' && !users.value.length) loadUsers();
  if (t === 'viestit' && !messages.value.length) loadMessages();
  if (t === 'kutsukoodit' && !invites.value.length) loadInvites();
}

onMounted(loadMembers);
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">

    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <div class="flex items-center justify-center w-10 h-10 rounded-xl
                  bg-dpurple-900/60 border border-dpurple-800/50">
        <ShieldCheck class="w-5 h-5 text-dpurple-400" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white">Admin-paneeli</h1>
        <p class="text-xs text-gray-600">{{ auth.username }}</p>
      </div>
      <button @click="logout"
        class="ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400
               transition-colors border-0 bg-transparent">
        <LogOut class="w-4 h-4" />Kirjaudu ulos
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-gray-950 border border-gray-800 rounded-2xl p-1">
      <button v-for="(label, key) in { jasenet: 'Jäsenet', kayttajat: 'Käyttäjät', viestit: 'Viestit', kutsukoodit: 'Kutsukoodit' }"
        :key="key" @click="switchTab(key as any)"
        class="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border-0 relative"
        :class="tab === key
          ? 'bg-dpurple-900/50 text-dpurple-300 border border-dpurple-800/50'
          : 'text-gray-600 hover:text-gray-400 bg-transparent'">
        {{ label }}
        <span v-if="key === 'viestit' && unread > 0"
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
          {{ unread }}
        </span>
      </button>
    </div>

    <!-- ── JÄSENET ── -->
    <template v-if="tab === 'jasenet'">
      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="bg-gray-950 border border-gray-800 rounded-2xl p-4">
          <div class="text-2xl font-bold text-white">{{ stats.total }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Jäseniä</div>
        </div>
        <div class="bg-gray-950 border border-dgreen-900/50 rounded-2xl p-4">
          <div class="text-2xl font-bold text-dgreen-400">{{ stats.active }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Aktiivisia</div>
        </div>
        <div class="bg-gray-950 border border-dpurple-900/50 rounded-2xl p-4">
          <div class="text-2xl font-bold text-dpurple-400">{{ stats.withPhoto }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Kuvallisia</div>
        </div>
      </div>

      <!-- Header + search + add -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="text-base font-semibold text-white flex items-center gap-2">
          <Users class="w-4 h-4 text-gray-600" />Jäsenet
        </h2>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
          <input v-model="search" placeholder="Hae..."
            class="pl-8 pr-3 py-1.5 text-sm rounded-xl bg-gray-950 border border-gray-800
                   text-gray-300 placeholder-gray-700 focus:outline-none focus:border-dgreen-800 transition-colors w-56" />
        </div>
        <button @click="openAdd"
          class="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                 bg-dgreen-900/50 hover:bg-dgreen-800/50 border border-dgreen-800/50
                 text-dgreen-300 transition-all duration-150">
          <Plus class="w-4 h-4" />Lisää jäsen
        </button>
      </div>

      <!-- Jäsenlista -->
      <div v-if="loading" class="text-gray-600 text-sm py-10 text-center">Ladataan...</div>
      <div v-else class="flex flex-col gap-1.5">
        <div
          v-for="m in filtered" :key="m._id"
          class="rounded-xl bg-gray-950 border transition-colors"
          :class="[
            m.active ? 'border-gray-800/60' : 'opacity-50 border-gray-800/30',
            expandedId === m._id ? 'border-dgreen-900/50' : ''
          ]"
        >
          <div class="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
               @click="toggleExpand(m._id)">
            <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0
                        bg-dpurple-900/40 flex items-center justify-center text-xs font-bold text-dpurple-400">
              <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" referrerpolicy="no-referrer"
                   class="w-full h-full object-cover" />
              <span v-else>{{ initials(m.name) }}</span>
            </div>
            <div class="w-52 shrink-0 min-w-0">
              <div class="text-sm text-gray-200 font-medium truncate">{{ m.name }}</div>
              <div v-if="m.aliases.length" class="text-xs text-gray-700 truncate">{{ m.aliases.join(', ') }}</div>
            </div>
            <div class="flex-1 hidden sm:block text-xs text-gray-700 truncate">{{ m.location }}</div>
            <span v-if="!m.active"
              class="text-xs text-red-900/80 bg-red-950/40 px-2 py-0.5 rounded-full border border-red-900/30 shrink-0">
              piilotettu
            </span>
            <div class="flex items-center gap-0.5 shrink-0 ml-auto">
              <button @click.stop="openEdit(m)"
                class="p-1.5 rounded-lg text-gray-600 hover:text-dgreen-400 hover:bg-dgreen-900/20
                       transition-colors border-0 bg-transparent">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="openDelete(m)" :disabled="deleting === m._id"
                class="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20
                       transition-colors border-0 bg-transparent">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
              <div class="w-px h-4 bg-gray-800 mx-1"></div>
              <div class="p-1.5 text-gray-700">
                <ChevronUp v-if="expandedId === m._id" class="w-3.5 h-3.5" />
                <ChevronDown v-else class="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div v-if="expandedId === m._id"
            class="px-4 pb-4 pt-1 border-t border-gray-800/50">
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden
                          bg-dpurple-900/30 border border-dpurple-800/20
                          flex items-center justify-center">
                <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" referrerpolicy="no-referrer"
                     class="w-full h-full object-cover object-top" />
                <span v-else class="text-2xl font-bold text-dpurple-700">{{ initials(m.name) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p v-if="m.quote" class="text-xs italic text-dpurple-400/70 mb-2 leading-relaxed">"{{ m.quote }}"</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-gray-500">
                  <span v-if="m.born" class="flex items-center gap-1.5 truncate">
                    <Cake class="w-3 h-3 text-gray-700 shrink-0" />{{ m.born }}
                  </span>
                  <span v-if="m.location" class="flex items-center gap-1.5 truncate">
                    <MapPin class="w-3 h-3 text-gray-700 shrink-0" />{{ m.location }}
                  </span>
                  <span v-if="m.favDrink" class="flex items-center gap-1.5 truncate">
                    <GlassWater class="w-3 h-3 text-gray-700 shrink-0" />{{ m.favDrink }}
                  </span>
                  <span v-if="m.highestPromille" class="flex items-center gap-1.5 truncate">
                    <Flame class="w-3 h-3 text-gray-700 shrink-0" />{{ m.highestPromille }}
                  </span>
                  <span v-if="m.points" class="flex items-center gap-1.5 truncate">
                    <Star class="w-3 h-3 text-gray-700 shrink-0" />{{ m.points }}p
                  </span>
                  <a v-if="m.website && m.website.startsWith('http')"
                    :href="m.website" target="_blank" rel="noopener noreferrer"
                    class="flex items-center gap-1.5 hover:text-dgreen-400 transition-colors truncate">
                    <Globe class="w-3 h-3 text-gray-700 shrink-0" />{{ m.website.replace(/^https?:\/\//, '') }}
                  </a>
                  <span v-if="m.email" class="flex items-center gap-1.5 truncate">
                    <Mail class="w-3 h-3 text-gray-700 shrink-0" />{{ m.email }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-if="!loading" class="text-xs text-gray-700 mt-4 text-center">
        {{ filtered.length }} / {{ members.length }} jäsentä
      </p>
    </template>

    <!-- ── KÄYTTÄJÄT ── -->
    <template v-if="tab === 'kayttajat'">
      <div v-if="usersLoading" class="text-gray-600 text-sm py-10 text-center">Ladataan...</div>
      <div v-else-if="!users.length" class="text-gray-700 text-sm py-10 text-center">Ei käyttäjiä</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="u in users" :key="u._id"
          class="bg-gray-950 border border-gray-800 rounded-2xl p-4">
          <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <span class="text-sm font-medium text-white">{{ u.username }}</span>
              <span class="ml-2 text-xs px-2 py-0.5 rounded-full"
                :class="{
                  'bg-yellow-950/40 border border-yellow-900/40 text-yellow-400': u.status === 'pending',
                  'bg-dgreen-950/40 border border-dgreen-900/40 text-dgreen-400': u.status === 'active',
                  'bg-red-950/40 border border-red-900/40 text-red-400': u.status === 'rejected',
                }">{{ u.status }}</span>
            </div>
            <div class="flex items-center gap-1.5" v-if="u.status === 'pending'">
              <button @click="approveUser(u._id)"
                class="flex items-center gap-1 px-2 py-1 rounded-xl text-xs border-0
                       bg-dgreen-900/40 hover:bg-dgreen-800/40 text-dgreen-400 transition-all">
                <UserCheck class="w-3.5 h-3.5" />Hyväksy
              </button>
              <button @click="rejectUser(u._id)"
                class="flex items-center gap-1 px-2 py-1 rounded-xl text-xs border-0
                       bg-red-900/40 hover:bg-red-800/40 text-red-400 transition-all">
                <UserX class="w-3.5 h-3.5" />Hylkää
              </button>
            </div>
          </div>
          <!-- Jäsenprofiili-linkitys -->
          <div class="flex items-center gap-2 flex-wrap">
            <Link class="w-3.5 h-3.5 text-gray-700 shrink-0" />
            <select v-model="linkSelections[u._id]"
              class="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/60 border border-gray-800 text-sm
                     text-gray-300 focus:outline-none focus:border-dgreen-700 transition-colors">
              <option value="">— Ei linkitettyä jäsentä —</option>
              <option v-for="m in members" :key="m._id" :value="m._id">{{ m.name }}</option>
            </select>
            <button @click="saveLink(u._id)" :disabled="linkSaving === u._id"
              class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs border-0
                     bg-dgreen-900/40 hover:bg-dgreen-800/40 text-dgreen-400 disabled:opacity-50 transition-all">
              <Check class="w-3 h-3" />{{ linkSaving === u._id ? '...' : 'Tallenna' }}
            </button>
          </div>
          <p class="text-xs text-gray-700 mt-2">Rekisteröityi {{ fmtDate(u.createdAt) }}</p>
        </div>
      </div>
    </template>

    <!-- ── VIESTIT ── -->
    <template v-if="tab === 'viestit'">
      <div v-if="messagesLoading" class="text-gray-600 text-sm py-10 text-center">Ladataan...</div>
      <div v-else-if="!messages.length" class="text-gray-700 text-sm py-10 text-center">Ei viestejä</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="m in messages" :key="m._id"
          class="bg-gray-950 border rounded-2xl overflow-hidden transition-colors"
          :class="m.read ? 'border-gray-800' : 'border-yellow-900/50'">
          <div class="px-4 py-3 cursor-pointer flex items-start justify-between gap-3"
               @click="toggleMsg(m._id)">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-white">{{ m.fromUsername }}</span>
                <span v-if="!m.read"
                  class="text-xs bg-yellow-950/50 border border-yellow-900/40 text-yellow-400
                         px-1.5 py-0.5 rounded-full">uusi</span>
              </div>
              <p class="text-sm text-gray-400 line-clamp-2">{{ m.content }}</p>
              <p class="text-xs text-gray-700 mt-1">{{ fmtDate(m.createdAt) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="m.replies.length"
                class="text-xs text-dgreen-400 bg-dgreen-950/40 border border-dgreen-900/40
                       px-2 py-0.5 rounded-full">
                {{ m.replies.length }} vastaus{{ m.replies.length > 1 ? 'ta' : '' }}
              </span>
              <MessageSquare class="w-4 h-4 text-gray-700" />
              <ChevronUp v-if="expandedMsgId === m._id" class="w-3.5 h-3.5 text-gray-700" />
              <ChevronDown v-else class="w-3.5 h-3.5 text-gray-700" />
            </div>
          </div>
          <div v-if="expandedMsgId === m._id"
            class="border-t border-gray-800 px-4 py-3 space-y-3">
            <!-- Full content -->
            <p class="text-sm text-gray-300 leading-relaxed">{{ m.content }}</p>
            <!-- Previous replies -->
            <div v-if="m.replies.length" class="space-y-2">
              <div v-for="r in m.replies" :key="r.createdAt"
                class="bg-dgreen-950/20 border border-dgreen-900/30 rounded-xl px-3 py-2">
                <p class="text-xs text-gray-500 mb-1">Sinä · {{ fmtDate(r.createdAt) }}</p>
                <p class="text-sm text-gray-200">{{ r.content }}</p>
              </div>
            </div>
            <!-- Reply form -->
            <div class="flex gap-2">
              <input v-model="replyTexts[m._id]" type="text" placeholder="Kirjoita vastaus..."
                @keyup.enter="sendReply(m._id)"
                class="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
              <button @click="sendReply(m._id)" :disabled="replySaving === m._id || !replyTexts[m._id]?.trim()"
                class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border-0
                       bg-dgreen-900/40 hover:bg-dgreen-800/40 text-dgreen-400 disabled:opacity-50 transition-all">
                <Send class="w-3.5 h-3.5" />{{ replySaving === m._id ? '...' : 'Vastaa' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── KUTSUKOODIT ── -->
    <template v-if="tab === 'kutsukoodit'">
      <div class="mb-4 flex items-center gap-3">
        <button @click="generateInvite" :disabled="generatingInvite"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                 bg-dgreen-900/50 hover:bg-dgreen-800/50 text-dgreen-300 disabled:opacity-50 transition-all">
          <Plus class="w-4 h-4" />{{ generatingInvite ? 'Luodaan...' : 'Luo kutsukoodi' }}
        </button>
        <div v-if="newInviteCode"
          class="flex items-center gap-2 px-3 py-2 rounded-xl bg-dgreen-950/40 border border-dgreen-800/40">
          <code class="text-sm text-dgreen-300 font-mono">{{ newInviteCode }}</code>
          <button @click="copyCode(newInviteCode)"
            class="text-gray-600 hover:text-dgreen-400 transition-colors border-0 bg-transparent">
            <Check v-if="copiedCode === newInviteCode" class="w-3.5 h-3.5 text-dgreen-400" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="invitesLoading" class="text-gray-600 text-sm py-6 text-center">Ladataan...</div>
      <div v-else-if="!invites.length" class="text-gray-700 text-sm py-6 text-center">Ei kutsukoodeja</div>
      <div v-else class="flex flex-col gap-1.5">
        <div v-for="inv in invites" :key="inv._id"
          class="bg-gray-950 border rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
          :class="inv.usedBy ? 'border-gray-800/40 opacity-60' : 'border-gray-800'">
          <code class="text-sm text-dgreen-300 font-mono flex-1">{{ inv.code }}</code>
          <button v-if="!inv.usedBy" @click="copyCode(inv.code)"
            class="flex items-center gap-1 text-xs text-gray-600 hover:text-dgreen-400
                   transition-colors border-0 bg-transparent">
            <Check v-if="copiedCode === inv.code" class="w-3.5 h-3.5 text-dgreen-400" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
          <span v-if="inv.usedBy" class="text-xs text-gray-600">käytetty</span>
          <span class="text-xs text-gray-700">
            Vanhenee {{ fmtDate(inv.expiresAt) }}
          </span>
        </div>
      </div>
    </template>

  </div>

  <!-- ── MUOKKAUSMODAALI ── -->
  <Teleport to="body">
    <div v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 sm:pt-14 overflow-y-auto">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="!confirmSaveOpen && (modalOpen = false)" />

      <div class="relative w-full max-w-lg bg-gray-950 border border-gray-800
                  rounded-2xl shadow-2xl z-10 mb-8">

        <div class="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-800">
          <h3 class="text-base font-bold text-white">
            {{ form._id ? 'Muokkaa jäsentä' : 'Lisää uusi jäsen' }}
          </h3>
          <button @click="modalOpen = false"
            class="ml-auto p-1 rounded-lg text-gray-600 hover:text-white transition-colors border-0 bg-transparent">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0
                        bg-dpurple-900/40 border border-dpurple-800/30
                        flex items-center justify-center">
              <img v-if="form.avatarUrl" :src="form.avatarUrl" :alt="form.name"
                   referrerpolicy="no-referrer" class="w-full h-full object-cover" />
              <ImageOff v-else class="w-6 h-6 text-dpurple-800" />
            </div>
            <div class="flex-1">
              <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
              <button @click="fileInputRef?.click()" :disabled="uploading"
                class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium
                       border border-dpurple-800/50 text-dpurple-400 hover:bg-dpurple-900/30
                       disabled:opacity-50 transition-colors bg-transparent mb-1">
                <Upload class="w-3.5 h-3.5" />
                {{ uploading ? 'Ladataan...' : 'Lataa kuva' }}
              </button>
              <p class="text-xs text-gray-700">tai syötä URL-kenttään · vaatii Azure Blob</p>
            </div>
            <button @click="form.active = !form.active"
              class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              :class="form.active
                ? 'bg-dgreen-900/40 border-dgreen-800/50 text-dgreen-400'
                : 'bg-gray-900/40 border-gray-800/50 text-gray-600'">
              {{ form.active ? 'Aktiivinen' : 'Piilotettu' }}
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Nimi *</label>
              <input v-model="form.name" type="text" placeholder="Nimi Sukunimi"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Aliakset (pilkulla eroteltu)</label>
              <input v-model="form.aliasInput" type="text" placeholder="alias1, alias2"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Quote</label>
              <input v-model="form.quote" type="text" placeholder="Jäsenen motto tai lainaus"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Syntynyt</label>
              <input v-model="form.born" type="text" placeholder="before 1997"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Pelipaikka</label>
              <input v-model="form.location" type="text" placeholder="Helsinki"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Juoma</label>
              <input v-model="form.favDrink" type="text" placeholder="Kossu"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Korkein promille</label>
              <input v-model="form.highestPromille" type="text" placeholder="putka"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Känniääliö-pisteet</label>
              <input v-model.number="form.points" type="number" min="0"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">E-mail</label>
              <input v-model="form.email" type="text" placeholder="tunnus tai osoite"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Kotisivu</label>
              <input v-model="form.website" type="text" placeholder="https://..."
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Avatar URL (manuaalinen)</label>
              <input v-model="form.avatarUrl" type="text" placeholder="https://..."
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
          </div>

          <div v-if="saveError"
            class="flex items-center gap-2 px-3 py-2 rounded-xl
                   bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
            <AlertCircle class="w-4 h-4 shrink-0" />{{ saveError }}
          </div>
        </div>

        <div v-if="!confirmSaveOpen"
          class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button @click="modalOpen = false"
            class="px-4 py-2 rounded-xl text-sm text-gray-600 hover:text-gray-300
                   transition-colors border-0 bg-transparent">Peruuta</button>
          <button @click="requestSave" :disabled="saving"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                   bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-50 transition-all">
            <Check class="w-4 h-4" />{{ saving ? 'Tallennetaan...' : 'Tallenna' }}
          </button>
        </div>

        <div v-else
          class="px-6 py-4 border-t border-yellow-900/40 bg-yellow-950/20 rounded-b-2xl">
          <p class="text-sm text-yellow-300/80 mb-3 flex items-center gap-2">
            <TriangleAlert class="w-4 h-4 shrink-0 text-yellow-500" />
            Tallennetaanko muutokset jäsenelle <strong class="ml-1">{{ form.name }}</strong>?
          </p>
          <div class="flex items-center justify-end gap-3">
            <button @click="confirmSaveOpen = false"
              class="px-4 py-1.5 rounded-xl text-sm text-gray-500 hover:text-gray-300
                     transition-colors border-0 bg-transparent">Peruuta</button>
            <button @click="saveMember" :disabled="saving"
              class="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium border-0
                     bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-50 transition-all">
              <Check class="w-4 h-4" />{{ saving ? 'Tallennetaan...' : 'Kyllä, tallenna' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── POISTOVAHVISTUSMODAALI ── -->
  <Teleport to="body">
    <div v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="deleteTarget = null" />

      <div class="relative w-full max-w-sm bg-gray-950 border border-red-900/40
                  rounded-2xl shadow-2xl z-10 p-6">
        <div class="flex items-start gap-3 mb-5">
          <div class="flex-shrink-0 w-9 h-9 rounded-xl bg-red-950/60 border border-red-900/40
                      flex items-center justify-center">
            <TriangleAlert class="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white mb-1">Poistetaanko jäsen?</h3>
            <p class="text-sm text-gray-500">
              Kirjoita jäsenen nimi vahvistukseksi:
              <span class="block text-gray-300 font-mono text-xs mt-1 select-all">{{ deleteTarget.name }}</span>
            </p>
          </div>
        </div>

        <input v-model="deleteNameInput" type="text" placeholder="Kirjoita nimi tähän..."
          class="w-full px-3 py-2 mb-4 rounded-xl bg-black/60 border text-sm text-gray-200
                 placeholder-gray-700 focus:outline-none transition-colors"
          :class="deleteNameInput && deleteNameInput !== deleteTarget.name
            ? 'border-red-900/60 focus:border-red-700'
            : 'border-gray-800 focus:border-dgreen-700'" />

        <div class="flex items-center justify-end gap-3">
          <button @click="deleteTarget = null"
            class="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300
                   transition-colors border-0 bg-transparent">Peruuta</button>
          <button @click="confirmDelete"
            :disabled="deleteNameInput.trim() !== deleteTarget.name || !!deleting"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                   bg-red-900/70 hover:bg-red-800/70 text-red-200
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <Trash2 class="w-4 h-4" />{{ deleting ? 'Poistetaan...' : 'Piilota jäsen' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── TOAST-ILMOITUKSET ── -->
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-3 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-2 scale-95"
      >
        <div v-for="t in toasts" :key="t.id"
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl
                 border text-sm font-medium min-w-[200px]"
          :class="t.type === 'success'
            ? 'bg-gray-950/95 border-dgreen-800/60 text-dgreen-300'
            : 'bg-gray-950/95 border-red-800/60 text-red-300'">
          <div class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
               :class="t.type === 'success' ? 'bg-dgreen-900/70' : 'bg-red-900/70'">
            <Check v-if="t.type === 'success'" class="w-3 h-3" />
            <AlertCircle v-else class="w-3 h-3" />
          </div>
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

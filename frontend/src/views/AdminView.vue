?<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import {
  ShieldCheck, LogOut, Users, Search, Plus,
  Pencil, Trash2, X, Upload, Check, AlertCircle, ImageOff, TriangleAlert,
  ChevronDown, ChevronUp, MapPin, GlassWater, Flame, Cake, Star, Globe, Mail,
  MessageSquare, Link, Copy, UserCheck, UserX, Send, Shield, ShieldOff, KeyRound, Eye, EyeOff, FileText, ExternalLink, Film,
} from 'lucide-vue-next';
import api from '../api';

interface MemberPhoto { _id: string; url: string; mediaType: 'image' | 'video'; blobName?: string; }
interface Deceased { year: number | null; note: string; }
interface Member {
  _id: string; name: string; aliases: string[]; quote: string; born: string;
  highestPromille: string; favDrink: string; location: string;
  email: string; website: string; avatarUrl: string; points: number; active: boolean;
  photos: MemberPhoto[];
  deceased?: Deceased | null;
}
type FormData = Omit<Member, 'aliases'> & { aliasInput: string };

interface AppUser {
  _id: string; username: string; status: string; role: string;
  linkedMember: { _id: string; name: string } | null; createdAt: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  lastSeenAt?: string | null;
}

interface Reply { content: string; byUsername?: string; createdAt: string }
interface Message {
  _id: string; fromUsername: string; content: string;
  read: boolean; repliesRead: boolean; replies: Reply[]; createdAt: string;
}

interface InviteCode { _id: string; code: string; expiresAt: string; usedBy: string | null; createdAt: string }

const auth = useAuthStore();
const router = useRouter();

// ── TABS ──
const tab = ref<'jasenet' | 'kayttajat' | 'viestit' | 'kutsukoodit' | 'hakemukset' | 'jakolinkit'>('jasenet');

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
  email: '', website: '', avatarUrl: '', points: 0, active: true, photos: [] as MemberPhoto[],
  deceased: null,
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
    const { aliasInput, _id, photos: _photos, ...rest } = form.value;
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

const editingMemberPhotos = computed<MemberPhoto[]>(() =>
  members.value.find(x => x._id === form.value._id)?.photos ?? []
);
const photoUrlInput = ref('');
const uploadingPhoto = ref(false);
const addingPhotoUrl = ref(false);
const photoFileInputRef = ref<HTMLInputElement | null>(null);
const confirmDeletePhotoId = ref<string | null>(null);

async function uploadMemberPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !form.value._id) return;
  uploadingPhoto.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post(`/members/${form.value._id}/photos`, fd);
    const idx = members.value.findIndex(m => m._id === data._id);
    if (idx !== -1) members.value.splice(idx, 1, data);
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Lataus epäonnistui';
  } finally {
    uploadingPhoto.value = false;
    if (photoFileInputRef.value) photoFileInputRef.value.value = '';
  }
}
async function addMemberPhotoUrl() {
  const url = photoUrlInput.value.trim();
  if (!url || !form.value._id) return;
  addingPhotoUrl.value = true;
  try {
    const fd = new FormData();
    fd.append('url', url);
    const { data } = await api.post(`/members/${form.value._id}/photos`, fd);
    const idx = members.value.findIndex(m => m._id === data._id);
    if (idx !== -1) members.value.splice(idx, 1, data);
    photoUrlInput.value = '';
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Lisäys epäonnistui';
  } finally {
    addingPhotoUrl.value = false;
  }
}
async function deleteMemberPhoto(photoId: string) {
  if (!form.value._id) return;
  confirmDeletePhotoId.value = null;
  try {
    const { data } = await api.delete(`/members/${form.value._id}/photos/${photoId}`);
    const idx = members.value.findIndex(m => m._id === data._id);
    if (idx !== -1) members.value.splice(idx, 1, data);
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Poisto epäonnistui';
  }
}

const AVATAR_BASE = 'https://digital.pictures.fi/kuvat/k%C3%A4/members-collection/';
const TRIPOD_RE = /kanniaalio\.tripod\.com\/members\/([^?#]+)/i;
function avatarSrc(url: string): string {
  if (!url) return '';
  // Rewrite legacy tripod URLs to digital.pictures.fi
  const tripodMatch = url.match(TRIPOD_RE);
  if (tripodMatch) return `${AVATAR_BASE}${tripodMatch[1]}/_full.jpg`;
  // Plain filename → digital.pictures.fi
  if (!url.startsWith('http')) return `${AVATAR_BASE}${url}/_full.jpg`;
  // Full URL (Azure Blob or other) → use as-is
  return url;
}

// ── KÄYTTÄJÄT ──
const users = ref<AppUser[]>([]);
const usersLoading = ref(false);
const linkSaving = ref<string | null>(null);
const roleSaving = ref<string | null>(null);
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

async function setRole(userId: string, role: 'user' | 'admin') {
  roleSaving.value = userId;
  try {
    const { data } = await api.put(`/auth/users/${userId}/role`, { role });
    const idx = users.value.findIndex(u => u._id === userId);
    if (idx !== -1) users.value[idx] = { ...users.value[idx] as AppUser, role: data.role };
    showToast(role === 'admin' ? 'Käyttäjä ylennetty adminiksi' : 'Admin-oikeus poistettu');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Roolin muutos epäonnistui', 'error');
  } finally {
    roleSaving.value = null;
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

// ── KÄYTTIÄJÄT: SALASANA ──
const pwModalOpen = ref(false);
const pwTarget = ref<AppUser | null>(null);
const pwOld = ref('');
const pwNew = ref('');
const pwConfirm = ref('');
const pwSaving = ref(false);
const pwError = ref('');
const showPwOld = ref(false);
const showPwNew = ref(false);
const showPwConfirm = ref(false);
const forceChangeSaving = ref<string | null>(null);
const pwIsSelf = computed(() => pwTarget.value?.username === auth.username);

function openPwModal(u: AppUser) {
  pwTarget.value = u;
  pwOld.value = '';
  pwNew.value = '';
  pwConfirm.value = '';
  pwError.value = '';
  showPwOld.value = false;
  showPwNew.value = false;
  showPwConfirm.value = false;
  pwModalOpen.value = true;
}

function closePwModal() {
  pwModalOpen.value = false;
  pwTarget.value = null;
}

async function setUserPassword() {
  pwError.value = '';
  if (pwIsSelf.value && !pwOld.value) { pwError.value = 'Vanha salasana vaaditaan'; return; }
  if (pwNew.value.length < 8) { pwError.value = 'Salasanan tulee olla vähintään 8 merkkiä'; return; }
  if (pwNew.value !== pwConfirm.value) { pwError.value = 'Salasanat eivät täsmää'; return; }
  if (!pwTarget.value) return;
  pwSaving.value = true;
  try {
    if (pwIsSelf.value) {
      await api.post('/auth/change-password', { oldPassword: pwOld.value, newPassword: pwNew.value });
    } else {
      await api.put(`/auth/users/${pwTarget.value._id}/password`, { newPassword: pwNew.value });
    }
    closePwModal();
    showToast('Salasana vaihdettu');
  } catch (err: any) {
    pwError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    pwSaving.value = false;
  }
}

async function forcePasswordChange(userId: string, force: boolean) {
  forceChangeSaving.value = userId;
  try {
    const { data } = await api.put(`/auth/users/${userId}/force-password-change`, { force });
    const u = users.value.find(u => u._id === userId);
    if (u) u.mustChangePassword = data.mustChangePassword;
    showToast(force ? 'Salasananvaihto pakotettu' : 'Pakotus poistettu');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Toiminto epäonnistui', 'error');
  } finally {
    forceChangeSaving.value = null;
  }
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

// ── HAKEMUKSET ──
interface Application {
  _id: string; name: string; email: string; location: string;
  favDrink: string; motivation: string; status: 'pending' | 'approved' | 'rejected';
  handledBy: string | null; handledAt: string | null; createdAt: string;
}
const applications = ref<Application[]>([]);
const applicationsLoading = ref(false);
const pendingAppsCount = ref(0);
const expandedAppId = ref<string | null>(null);
const appHandlingSaving = ref<string | null>(null);

async function loadApplications() {
  applicationsLoading.value = true;
  try {
    const { data } = await api.get('/applications');
    applications.value = data;
    pendingAppsCount.value = data.filter((a: Application) => a.status === 'pending').length;
  } finally {
    applicationsLoading.value = false;
  }
}

async function handleApplication(id: string, status: 'approved' | 'rejected') {
  appHandlingSaving.value = id;
  try {
    const { data } = await api.put(`/applications/${id}`, { status });
    const idx = applications.value.findIndex(a => a._id === id);
    if (idx !== -1) applications.value[idx] = data;
    pendingAppsCount.value = applications.value.filter(a => a.status === 'pending').length;
    showToast(status === 'approved' ? 'Hakemus hyväksytty' : 'Hakemus hylätty');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Toiminto epäonnistui', 'error');
  } finally {
    appHandlingSaving.value = null;
  }
}

// ── GUIDES PIN ──
const guidesPin = ref('');
const guidesPinSaving = ref(false);
const guidesPinSaved = ref(false);
const guidesPinError = ref('');

async function saveGuidesPin() {
  if (!guidesPin.value.trim() || guidesPin.value.length < 4) {
    guidesPinError.value = 'PIN oltava vähintään 4 merkkiä'; return;
  }
  guidesPinSaving.value = true; guidesPinError.value = ''; guidesPinSaved.value = false;
  try {
    await api.put('/guides/pin', { pin: guidesPin.value.trim() });
    guidesPinSaved.value = true;
    guidesPin.value = '';
    showToast('Guides-PIN vaihdettu');
    setTimeout(() => { guidesPinSaved.value = false; }, 3000);
  } catch (err: any) {
    guidesPinError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    guidesPinSaving.value = false;
  }
}
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

type OnlineStatus = 'online' | 'recent' | 'away' | 'offline';
function onlineStatus(lastSeenAt?: string | null): OnlineStatus {
  if (!lastSeenAt) return 'offline';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 5 * 60 * 1000)   return 'online';   // < 5 min
  if (diff < 30 * 60 * 1000)  return 'recent';   // < 30 min
  if (diff < 24 * 60 * 60 * 1000) return 'away'; // < 24h
  return 'offline';
}
function onlineLabel(s: OnlineStatus) {
  return { online: 'Online', recent: 'Aktiivinen', away: 'Nähty tänään', offline: 'Offline' }[s];
}
function onlineDotClass(s: OnlineStatus) {
  return {
    online: 'bg-dgreen-400',
    recent: 'bg-yellow-400',
    away:   'bg-gray-500',
    offline:'bg-gray-700',
  }[s];
}
function fmtRelative(d?: string | null): string {
  if (!d) return 'Ei koskaan';
  const diff = Date.now() - new Date(d).getTime();
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (min < 1)   return 'juuri nyt';
  if (min < 60)  return `${min} min sitten`;
  if (h < 24)    return `${h} h sitten`;
  if (days < 7)  return `${days} pv sitten`;
  return new Date(d).toLocaleDateString('fi-FI');
}

function logout() {
  auth.logout();
  router.push('/login');
}

// Load on tab switch
// ── JAKOLINKIT ──
interface ShareItem {
  _id: string; token: string; blobName: string; folderId: string | null;
  folderName: string | null; mediaType: 'image' | 'video';
  createdBy: string; createdAt: string;
  downloadCount: number; lastDownloadAt: string | null;
}
const shares = ref<ShareItem[]>([]);
const sharesLoading = ref(false);
const deletingShare = ref<string | null>(null);
const confirmDeleteShare = ref<string | null>(null);
const copiedShareToken = ref<string | null>(null);
const MEDIA_BASE = (import.meta.env.VITE_MEDIA_URL ?? '') + '/kuvat';

function shareImgUrl(s: ShareItem) {
  const t = auth.token ? `?t=${auth.token}` : '';
  return s.folderName
    ? `${MEDIA_BASE}/${encodeURIComponent(s.folderName)}/${s.blobName}${t}`
    : `${MEDIA_BASE}/${s.blobName}${t}`;
}

async function loadShares() {
  sharesLoading.value = true;
  try {
    const { data } = await api.get('/images/shares');
    shares.value = data;
  } catch { /* ohitetaan */ }
  finally { sharesLoading.value = false; }
}

async function deleteShare(id: string) {
  if (confirmDeleteShare.value !== id) {
    confirmDeleteShare.value = id;
    setTimeout(() => { if (confirmDeleteShare.value === id) confirmDeleteShare.value = null; }, 3000);
    return;
  }
  confirmDeleteShare.value = null;
  deletingShare.value = id;
  try {
    await api.delete(`/images/shares/${id}`);
    shares.value = shares.value.filter(s => s._id !== id);
  } catch { /* ohitetaan */ }
  finally { deletingShare.value = null; }
}

function sharePageUrl(token: string) {
  return `${window.location.origin}/jaa/${token}`;
}

async function copyShareUrl(token: string) {
  await navigator.clipboard.writeText(sharePageUrl(token)).catch(() => {});
  copiedShareToken.value = token;
  setTimeout(() => { if (copiedShareToken.value === token) copiedShareToken.value = null; }, 2000);
}

// ── TABS ──
async function switchTab(t: typeof tab.value) {
  tab.value = t;
  if (t === 'kayttajat' && !users.value.length) loadUsers();
  if (t === 'viestit' && !messages.value.length) loadMessages();
  if (t === 'kutsukoodit' && !invites.value.length) loadInvites();
  if (t === 'hakemukset' && !applications.value.length) loadApplications();
  if (t === 'jakolinkit') loadShares();
}

onMounted(() => { loadMembers(); api.get('/applications/pending-count').then(r => { pendingAppsCount.value = r.data.count; }).catch(() => {}); });
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <div class="flex items-center justify-center w-10 h-10 rounded-xl
                  bg-dpurple-900/60 border border-dpurple-800/50">
        <ShieldCheck class="w-5 h-5 text-dpurple-400" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white">Admin-paneeli</h1>
        <p class="text-xs text-gray-600">{{ auth.username }}</p>
      </div>
      <button @click="logout"
        class="self-start sm:ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400
               transition-colors border-0 bg-transparent">
        <LogOut class="w-4 h-4" />Kirjaudu ulos
      </button>
    </div>

    <!-- Tabs -->
    <div class="grid grid-cols-2 sm:flex gap-1 mb-6 bg-gray-950 border border-gray-800 rounded-2xl p-1">
      <button v-for="(label, key) in { jasenet: 'Jäsenet', kayttajat: 'Käyttäjät', viestit: 'Viestit', hakemukset: 'Hakemukset', kutsukoodit: 'Kutsukoodit', jakolinkit: 'Jakolinkit' }"
        :key="key" @click="switchTab(key as any)"
        class="sm:flex-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border-0 relative"
        :class="tab === key
          ? 'bg-dpurple-900/50 text-dpurple-300 border border-dpurple-800/50'
          : 'text-gray-600 hover:text-gray-400 bg-transparent'">
        {{ label }}
        <span v-if="key === 'viestit' && unread > 0"
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
          {{ unread }}
        </span>
        <span v-if="key === 'hakemukset' && pendingAppsCount > 0"
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
          {{ pendingAppsCount }}
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
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <h2 class="text-base font-semibold text-white flex items-center gap-2 shrink-0">
          <Users class="w-4 h-4 text-gray-600" />Jäsenet
        </h2>
        <div class="relative flex-1 min-w-32">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
          <input v-model="search" placeholder="Hae..."
            class="pl-8 pr-3 py-1.5 text-sm rounded-xl bg-gray-950 border border-gray-800
                   text-gray-300 placeholder-gray-700 focus:outline-none focus:border-dgreen-800 transition-colors w-full" />
        </div>
        <button @click="openAdd"
          class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                 bg-dgreen-900/50 hover:bg-dgreen-800/50 border border-dgreen-800/50
                 text-dgreen-300 transition-all duration-150">
          <Plus class="w-4 h-4" /><span class="hidden sm:inline">Lisää jäsen</span><span class="sm:hidden">Lisää</span>
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
          <div class="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
               @click="toggleExpand(m._id)">
            <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0
                        bg-dpurple-900/40 flex items-center justify-center text-xs font-bold text-dpurple-400">
              <img v-if="m.avatarUrl" :src="avatarSrc(m.avatarUrl)" :alt="m.name" referrerpolicy="no-referrer"
                   class="w-full h-full object-cover" />
              <span v-else>{{ initials(m.name) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-gray-200 font-medium truncate">{{ m.name }}</div>
              <div v-if="m.aliases.length" class="text-xs text-gray-700 truncate">{{ m.aliases.join(', ') }}</div>
            </div>
            <div class="hidden sm:block flex-1 text-xs text-gray-700 truncate px-2">{{ m.location }}</div>
            <span v-if="!m.active"
              class="text-[10px] text-red-900/80 bg-red-950/40 px-1.5 py-0.5 rounded-full border border-red-900/30 shrink-0">
              piilotettu
            </span>
            <div class="flex items-center gap-0 shrink-0">
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
            class="px-3 pb-3 pt-2 border-t border-gray-800/50">
            <div class="flex gap-3">
              <div class="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden
                          bg-dpurple-900/30 border border-dpurple-800/20
                          flex items-center justify-center">
                <img v-if="m.avatarUrl" :src="avatarSrc(m.avatarUrl)" :alt="m.name" referrerpolicy="no-referrer"
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
            <div class="flex items-center gap-2 flex-wrap">
              <span class="relative flex items-center justify-center w-2 h-2">
                <span v-if="onlineStatus(u.lastSeenAt) === 'online'"
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-dgreen-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full w-2 h-2" :class="onlineDotClass(onlineStatus(u.lastSeenAt))"></span>
              </span>
              <span class="text-sm font-medium text-white">{{ u.username }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full"
                :class="{
                  'bg-yellow-950/40 border border-yellow-900/40 text-yellow-400': u.status === 'pending',
                  'bg-dgreen-950/40 border border-dgreen-900/40 text-dgreen-400': u.status === 'active',
                  'bg-red-950/40 border border-red-900/40 text-red-400': u.status === 'rejected',
                }">{{ u.status }}</span>
              <span v-if="u.role === 'admin'"
                class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                       bg-dpurple-950/40 border border-dpurple-800/40 text-dpurple-400">
                <Shield class="w-3 h-3" />admin
              </span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <template v-if="u.status === 'pending'">
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
              </template>
              <button v-if="u.username !== auth.username && u.role !== 'admin'"
                @click="setRole(u._id, 'admin')" :disabled="roleSaving === u._id"
                class="flex items-center gap-1 px-2 py-1 rounded-xl text-xs border-0
                       bg-dpurple-900/40 hover:bg-dpurple-800/40 text-dpurple-400 disabled:opacity-50 transition-all">
                <Shield class="w-3.5 h-3.5" />{{ roleSaving === u._id ? '...' : 'Ylennä adminiksi' }}
              </button>
              <button v-if="u.username !== auth.username && u.role === 'admin'"
                @click="setRole(u._id, 'user')" :disabled="roleSaving === u._id"
                class="flex items-center gap-1 px-2 py-1 rounded-xl text-xs border-0
                       bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 disabled:opacity-50 transition-all">
                <ShieldOff class="w-3.5 h-3.5" />{{ roleSaving === u._id ? '...' : 'Poista admin' }}
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
          <div class="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            <p class="text-xs text-gray-700">
              <span class="text-gray-600">Viimeksi nähty:</span>
              <span :class="onlineStatus(u.lastSeenAt) === 'online' ? 'text-dgreen-500' : 'text-gray-600'">
                {{ ' ' }}{{ onlineLabel(onlineStatus(u.lastSeenAt)) }} &middot; {{ fmtRelative(u.lastSeenAt) }}
              </span>
            </p>
            <p class="text-xs text-gray-700">
              <span class="text-gray-600">Kirjautui:</span>
              {{ ' ' }}{{ fmtRelative(u.lastLoginAt) }}
            </p>
          </div>
          <!-- Salasana & pakotus -->
          <div class="flex items-center gap-2 flex-wrap mt-2">
            <button @click="openPwModal(u)"
              class="flex items-center gap-1 px-2 py-1 rounded-xl text-xs border-0
                     bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 transition-all">
              <KeyRound class="w-3.5 h-3.5" />Vaihda salasana
            </button>
            <button v-if="u.username !== auth.username"
              @click="forcePasswordChange(u._id, !u.mustChangePassword)"
              :disabled="forceChangeSaving === u._id"
              class="flex items-center gap-1 px-2 py-1 rounded-xl text-xs border-0 transition-all disabled:opacity-50"
              :class="u.mustChangePassword
                ? 'bg-yellow-950/40 hover:bg-yellow-900/40 text-yellow-400'
                : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-500'">
              <TriangleAlert class="w-3.5 h-3.5" />{{ forceChangeSaving === u._id ? '...' : u.mustChangePassword ? 'Pakotus päällä' : 'Pakota vaihto' }}
            </button>
          </div>
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
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-sm font-medium text-white">{{ m.fromUsername }}</span>
                <span v-if="!m.read"
                  class="text-xs bg-yellow-950/50 border border-yellow-900/40 text-yellow-400
                         px-1.5 py-0.5 rounded-full">uusi</span>
                <span v-if="m.replies.length && !m.repliesRead"
                  class="text-xs bg-gray-900 border border-gray-700/50 text-gray-500
                         px-1.5 py-0.5 rounded-full">ei luettu</span>
              </div>
              <p class="text-sm text-gray-400 line-clamp-2">{{ m.content }}</p>
              <p class="text-xs text-gray-700 mt-1">{{ fmtDate(m.createdAt) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="m.replies.length"
                class="text-xs px-2 py-0.5 rounded-full"
                :class="m.repliesRead
                  ? 'text-dgreen-700 bg-dgreen-950/40 border border-dgreen-900/40'
                  : 'text-dgreen-400 bg-dgreen-950/40 border border-dgreen-900/40'">
                {{ m.replies.length }} vastaus{{ m.replies.length > 1 ? 'ta' : '' }}
              </span>
              <MessageSquare class="w-4 h-4 text-gray-700" />
              <ChevronUp v-if="expandedMsgId === m._id" class="w-3.5 h-3.5 text-gray-700" />
              <ChevronDown v-else class="w-3.5 h-3.5 text-gray-700" />
            </div>
          </div>
          <div v-if="expandedMsgId === m._id"
            class="border-t border-gray-800 px-4 py-4 space-y-3">
            <!-- Thread: user message -->
            <div class="flex justify-end">
              <div class="max-w-[85%] bg-gray-900/60 border border-gray-800 rounded-2xl rounded-tr-sm px-4 py-3">
                <p class="text-xs text-gray-600 mb-1">{{ m.fromUsername }} · {{ fmtDate(m.createdAt) }}</p>
                <p class="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{{ m.content }}</p>
              </div>
            </div>
            <!-- Thread: admin replies -->
            <div v-if="m.replies.length" class="space-y-2">
              <div v-for="r in m.replies" :key="r.createdAt" class="flex justify-start">
                <div class="max-w-[85%] bg-dgreen-950/20 border border-dgreen-900/30 rounded-2xl rounded-tl-sm px-4 py-3">
                  <p class="text-xs text-gray-500 mb-1">{{ r.byUsername || 'Admin' }} · {{ fmtDate(r.createdAt) }}</p>
                  <p class="text-sm text-gray-200 whitespace-pre-wrap">{{ r.content }}</p>
                </div>
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

    <!-- ── HAKEMUKSET ── -->
    <template v-if="tab === 'hakemukset'">
      <div v-if="applicationsLoading" class="text-gray-600 text-sm py-10 text-center">Ladataan...</div>
      <div v-else-if="!applications.length" class="text-gray-700 text-sm py-10 text-center">Ei hakemuksia</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="a in applications" :key="a._id"
          class="bg-gray-950 border rounded-2xl overflow-hidden transition-colors"
          :class="{
            'border-yellow-900/50': a.status === 'pending',
            'border-dgreen-900/40': a.status === 'approved',
            'border-red-900/40':    a.status === 'rejected',
          }">
          <!-- Row header -->
          <div class="px-4 py-3 cursor-pointer flex items-start justify-between gap-3"
               @click="expandedAppId = expandedAppId === a._id ? null : a._id">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="text-sm font-medium text-white">{{ a.name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-yellow-950/40 border border-yellow-900/40 text-yellow-400': a.status === 'pending',
                    'bg-dgreen-950/40 border border-dgreen-900/40 text-dgreen-400': a.status === 'approved',
                    'bg-red-950/40 border border-red-900/40 text-red-400':          a.status === 'rejected',
                  }">{{ a.status === 'pending' ? 'odottaa' : a.status === 'approved' ? 'hyväksytty' : 'hylätty' }}</span>
              </div>
              <p class="text-xs text-gray-600 truncate">{{ a.email }} · {{ a.location }}</p>
              <p class="text-xs text-gray-700 mt-0.5">{{ fmtDate(a.createdAt) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <FileText class="w-4 h-4 text-gray-700" />
              <ChevronUp v-if="expandedAppId === a._id" class="w-3.5 h-3.5 text-gray-700" />
              <ChevronDown v-else class="w-3.5 h-3.5 text-gray-700" />
            </div>
          </div>
          <!-- Expanded detail -->
          <div v-if="expandedAppId === a._id"
            class="border-t border-gray-800 px-4 py-4 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <p class="text-xs text-gray-600 mb-0.5">Sähköposti</p>
                <p class="text-gray-300">{{ a.email }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600 mb-0.5">Paikkakunta</p>
                <p class="text-gray-300">{{ a.location }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600 mb-0.5">Lempijuoma</p>
                <p class="text-gray-300">{{ a.favDrink }}</p>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-600 mb-0.5">Motivaatio</p>
              <p class="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{{ a.motivation }}</p>
            </div>
            <p v-if="a.handledBy" class="text-xs text-gray-700">
              Käsitteli {{ a.handledBy }} · {{ fmtDate(a.handledAt!) }}
            </p>
            <!-- Action buttons -->
            <div v-if="a.status === 'pending'" class="flex gap-2 flex-wrap pt-1">
              <button @click="handleApplication(a._id, 'approved')" :disabled="appHandlingSaving === a._id"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-0
                       bg-dgreen-900/40 hover:bg-dgreen-800/40 text-dgreen-400 disabled:opacity-50 transition-all">
                <UserCheck class="w-3.5 h-3.5" />{{ appHandlingSaving === a._id ? '...' : 'Hyväksy' }}
              </button>
              <button @click="handleApplication(a._id, 'rejected')" :disabled="appHandlingSaving === a._id"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-0
                       bg-red-900/40 hover:bg-red-800/40 text-red-400 disabled:opacity-50 transition-all">
                <UserX class="w-3.5 h-3.5" />{{ appHandlingSaving === a._id ? '...' : 'Hylkää' }}
              </button>
            </div>
            <div v-else class="flex gap-2 pt-1">
              <button @click="handleApplication(a._id, a.status === 'approved' ? 'rejected' : 'approved')"
                :disabled="appHandlingSaving === a._id"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border-0
                       bg-gray-800/60 hover:bg-gray-700/60 text-gray-500 disabled:opacity-50 transition-all">
                <TriangleAlert class="w-3.5 h-3.5" />{{ appHandlingSaving === a._id ? '...' : 'Muuta päätöstä' }}
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

      <!-- Guides PIN reset -->
      <div class="mt-6 border-t border-gray-800/60 pt-5">
        <p class="text-xs font-semibold text-dpurple-400 uppercase tracking-wider mb-3">
          Ohjesivu PIN (/guides)
        </p>
        <div class="flex gap-2 items-end flex-wrap">
          <div class="flex-1 min-w-0">
            <label class="block text-xs text-gray-500 mb-1.5">Uusi PIN (4–20 merkkiä)</label>
            <input v-model="guidesPin" type="text" placeholder="esim. 123456"
              class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                     text-gray-200 placeholder-gray-700 text-sm font-mono tracking-widest
                     focus:outline-none focus:border-dpurple-700 transition-colors" />
          </div>
          <button @click="saveGuidesPin" :disabled="guidesPinSaving"
            class="px-4 py-2.5 rounded-xl border-0 text-sm font-medium
                   bg-dpurple-800/60 hover:bg-dpurple-700/60 text-white
                   disabled:opacity-50 transition-all shrink-0">
            {{ guidesPinSaving ? 'Tallennetaan...' : guidesPinSaved ? '✓ Tallennettu' : 'Vaihda PIN' }}
          </button>
        </div>
        <p v-if="guidesPinError" class="text-red-400 text-xs mt-2">{{ guidesPinError }}</p>
        <p class="text-xs text-gray-700 mt-2">Uusi PIN tulee voimaan välittömästi.</p>
      </div>
    </template>

    <!-- ── JAKOLINKIT ── -->
    <template v-if="tab === 'jakolinkit'">
      <div class="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <p class="text-xs text-gray-500">
          Kaikki aktiiviset jakolinkit — linkin avaaminen laskee katselukerran.
        </p>
        <button @click="loadShares" :disabled="sharesLoading"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-gray-800
                 bg-gray-950 hover:bg-gray-900 text-gray-400 disabled:opacity-50 transition-all">
          Päivitä
        </button>
      </div>

      <div v-if="sharesLoading" class="text-gray-600 text-sm py-8 text-center">Ladataan...</div>
      <div v-else-if="!shares.length" class="text-gray-700 text-sm py-8 text-center">Ei jakolinkkejä</div>

      <div v-else class="flex flex-col gap-2">
        <div v-for="s in shares" :key="s._id"
          class="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden flex flex-col sm:flex-row">

          <!-- Esikatselukuva: mobiilissa ylhäällä, desktop vasemmalla -->
          <div class="sm:w-28 sm:shrink-0 h-28 sm:h-auto bg-gray-900 flex items-center justify-center overflow-hidden">
            <img v-if="s.mediaType === 'image'" :src="shareImgUrl(s)" crossorigin="anonymous"
              class="w-full h-full object-cover" />
            <div v-else class="flex flex-col items-center gap-1 text-gray-600">
              <Film class="w-7 h-7" />
              <span class="text-xs">Video</span>
            </div>
          </div>

          <!-- Tiedot + toiminnot -->
          <div class="flex-1 min-w-0 px-4 py-3 flex flex-col gap-2">
            <!-- Yläosa: nimi + badget -->
            <div class="flex items-start gap-2 flex-wrap">
              <span class="text-xs font-mono text-gray-300 truncate max-w-[180px] sm:max-w-[280px]">{{ s.blobName }}</span>
              <span v-if="s.folderName"
                class="text-xs text-dpurple-400 bg-dpurple-900/30 border border-dpurple-800/30 rounded-full px-2 py-0.5 shrink-0">
                {{ s.folderName }}
              </span>
            </div>

            <!-- Meta -->
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-xs text-gray-600">{{ s.createdBy }}</span>
              <span class="text-xs text-gray-700">{{ new Date(s.createdAt).toLocaleDateString('fi-FI') }}</span>
              <span class="flex items-center gap-1 text-xs"
                :class="s.downloadCount > 0 ? 'text-dgreen-400' : 'text-gray-700'">
                <Eye class="w-3 h-3" />{{ s.downloadCount }}
              </span>
              <span v-if="s.lastDownloadAt" class="text-xs text-gray-600">
                Viimeksi {{ new Date(s.lastDownloadAt).toLocaleDateString('fi-FI') }}
              </span>
            </div>

            <!-- Toiminnot -->
            <div class="flex items-center gap-1.5 mt-auto pt-1">
              <!-- Teksti-nappulat desktop, ikoni-nappulat mobile -->
              <a :href="sharePageUrl(s.token)" target="_blank" rel="noopener"
                class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border border-gray-700
                       bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-all no-underline text-xs">
                <ExternalLink class="w-3.5 h-3.5 shrink-0" /><span class="hidden sm:inline">Avaa</span>
              </a>
              <button @click="copyShareUrl(s.token)"
                class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border transition-all text-xs"
                :class="copiedShareToken === s.token
                  ? 'border-dgreen-700/60 bg-dgreen-950/40 text-dgreen-300'
                  : 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white'">
                <Check v-if="copiedShareToken === s.token" class="w-3.5 h-3.5 shrink-0" />
                <Copy v-else class="w-3.5 h-3.5 shrink-0" />
                <span class="hidden sm:inline">{{ copiedShareToken === s.token ? 'Kopioitu!' : 'Kopioi' }}</span>
              </button>
              <button @click="deleteShare(s._id)" :disabled="deletingShare === s._id"
                class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border transition-all text-xs"
                :class="confirmDeleteShare === s._id
                  ? 'border-red-600 bg-red-900/40 text-red-200'
                  : 'border-red-900/50 bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-red-200 disabled:opacity-50'">
                <Trash2 class="w-3.5 h-3.5 shrink-0" />
                <span class="hidden sm:inline">{{ deletingShare === s._id ? '...' : confirmDeleteShare === s._id ? 'Vahvista' : 'Poista' }}</span>
              </button>
            </div>
          </div>
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

        <div class="px-4 sm:px-6 py-4 sm:py-5 space-y-4 max-h-[80vh] sm:max-h-[72vh] overflow-y-auto">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0
                        bg-dpurple-900/40 border border-dpurple-800/30
                        flex items-center justify-center">
              <img v-if="form.avatarUrl" :src="avatarSrc(form.avatarUrl)" :alt="form.name"
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
              <p class="text-xs text-gray-700">Lataus menee Azure Blob → täysi URL tallentuu</p>
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
              <label class="block text-xs text-gray-600 mb-1">Avatar URL tai tiedostonimi</label>
              <input v-model="form.avatarUrl" type="text" placeholder="jarno01.jpg tai https://..."
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
              <p class="text-[11px] text-gray-700 mt-1">Pelkkä tiedostonimi (esim. <span class="text-gray-500">jarno01.jpg</span>) hakee digital.pictures.fi · täysi URL käytetään sellaisenaan</p>
            </div>

            <!-- In memoriam -->
            <div class="sm:col-span-2 pt-3 border-t border-gray-800/50">
              <label class="block text-xs text-gray-600 mb-2">✦ In memoriam</label>
              <div class="flex gap-2 items-start">
                <div class="flex-1">
                  <label class="block text-[11px] text-gray-700 mb-1">Vuosi (tyhjä = elässä)</label>
                  <input
                    :value="form.deceased?.year ?? ''"
                    @input="form.deceased = { year: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null, note: form.deceased?.note ?? '' }"
                    type="number" min="1900" max="2100" placeholder="esim. 2019"
                    class="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-sm text-amber-200
                           placeholder-gray-700 focus:outline-none focus:border-amber-700 transition-colors" />
                </div>
                <div class="flex-[2]">
                  <label class="block text-[11px] text-gray-700 mb-1">Muistosanat (valinnainen)</label>
                  <input
                    :value="form.deceased?.note ?? ''"
                    @input="form.deceased = { year: form.deceased?.year ?? null, note: ($event.target as HTMLInputElement).value }"
                    type="text" placeholder="esim. Rauhassa levtäkköön"
                    class="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-sm text-amber-200
                           placeholder-gray-700 focus:outline-none focus:border-amber-700 transition-colors" />
                </div>
              </div>
              <p v-if="form.deceased?.year"
                class="text-[11px] text-amber-600/80 mt-1">
                Jäsen näytetään muistomerkkinä: ✦ In memoriam {{ form.deceased.year }}
              </p>
            </div>

            <!-- Photos / Videos (only for existing members) -->
            <div v-if="form._id" class="sm:col-span-2 pt-3 border-t border-gray-800/50">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs text-gray-600">Kuvat &amp; Videot (slideshow)</label>
                <span class="text-xs" :class="editingMemberPhotos.length >= 10 ? 'text-red-500' : 'text-gray-700'">
                  {{ editingMemberPhotos.length }} / 10
                </span>
              </div>
              <!-- Existing photos grid -->
              <div v-if="editingMemberPhotos.length" class="grid grid-cols-4 gap-2 mb-2.5">
                <div v-for="p in editingMemberPhotos" :key="p._id"
                  class="relative aspect-square rounded-lg overflow-hidden bg-gray-900 border border-gray-800/50 group">
                  <img v-if="p.mediaType === 'image'" :src="avatarSrc(p.url)"
                       class="w-full h-full object-cover" draggable="false" />
                  <video v-else :src="p.url" muted
                         class="w-full h-full object-cover" />
                  <!-- Confirm overlay -->
                  <div v-if="confirmDeletePhotoId === p._id"
                    class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1.5 p-1">
                    <p class="text-[10px] text-white text-center leading-tight">Poistetaanko?</p>
                    <div class="flex gap-1">
                      <button @click="deleteMemberPhoto(p._id)"
                        class="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white text-[10px] border-0 transition-colors">
                        Poista
                      </button>
                      <button @click="confirmDeletePhotoId = null"
                        class="px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-[10px] border-0 transition-colors">
                        Peru
                      </button>
                    </div>
                  </div>
                  <!-- Delete trigger -->
                  <button v-else @click="confirmDeletePhotoId = p._id"
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-900/80
                           flex items-center justify-center transition-colors border-0 p-0
                           opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <X class="w-3 h-3 text-white" />
                  </button>
                </div>
              </div>
              <!-- Add new -->
              <div v-if="editingMemberPhotos.length < 10" class="space-y-1.5">
                <div class="flex gap-1.5">
                  <input v-model="photoUrlInput" type="text"
                    placeholder="https://... tai tiedostonimi"
                    class="flex-1 px-2.5 py-1.5 rounded-xl bg-black/60 border border-gray-800 text-xs text-gray-200
                           placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors"
                    @keyup.enter="addMemberPhotoUrl" />
                  <button @click="addMemberPhotoUrl"
                    :disabled="addingPhotoUrl || !photoUrlInput.trim()"
                    class="px-2.5 py-1.5 rounded-xl text-xs border-0 bg-dgreen-900/40 text-dgreen-400
                           hover:bg-dgreen-800/40 disabled:opacity-40 transition-all">
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <input ref="photoFileInputRef" type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v,.webm"
                         class="hidden" @change="uploadMemberPhoto" />
                  <button @click="photoFileInputRef?.click()" :disabled="uploadingPhoto"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-dpurple-800/50
                           text-dpurple-400 hover:bg-dpurple-900/30 disabled:opacity-50 transition-colors bg-transparent">
                    <Upload class="w-3 h-3" />{{ uploadingPhoto ? 'Ladataan...' : 'Lataa tiedosto (max 50 MB)' }}
                  </button>
                </div>
              </div>
            </div>
          </div><!-- /grid -->

          <div v-if="saveError"
            class="flex items-center gap-2 px-3 py-2 rounded-xl
                   bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
            <AlertCircle class="w-4 h-4 shrink-0" />{{ saveError }}
          </div>
        </div>

        <div v-if="!confirmSaveOpen"
          class="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-800">
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

  <!-- ── SALASANA MODAL (admin asettaa käyttäjän salasanan) ── -->
  <Teleport to="body">
    <div v-if="pwModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      @click.self="closePwModal">
      <div class="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-white flex items-center gap-2">
            <KeyRound class="w-4 h-4 text-gray-400" />Vaihda salasana
          </h3>
          <button @click="closePwModal" class="text-gray-600 hover:text-white border-0 bg-transparent transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>
        <p class="text-sm text-gray-500 mb-4">{{ pwTarget?.username }}</p>
        <div class="flex flex-col gap-3">
          <div v-if="pwIsSelf">
            <label class="text-xs text-gray-500 mb-1 block">Vanha salasana</label>
            <div class="relative">
              <input v-model="pwOld" :type="showPwOld ? 'text' : 'password'" autocomplete="current-password"
                placeholder="Nykyinen salasana"
                class="w-full px-3 py-2 pr-10 rounded-xl bg-black/60 border border-gray-800 text-sm
                       text-gray-200 placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
              <button type="button" @click="showPwOld = !showPwOld"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400
                       border-0 bg-transparent transition-colors">
                <Eye v-if="!showPwOld" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">Uusi salasana</label>
            <div class="relative">
              <input v-model="pwNew" :type="showPwNew ? 'text' : 'password'" autocomplete="new-password"
                placeholder="Vähintään 8 merkkiä"
                class="w-full px-3 py-2 pr-10 rounded-xl bg-black/60 border border-gray-800 text-sm
                       text-gray-200 placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
              <button type="button" @click="showPwNew = !showPwNew"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400
                       border-0 bg-transparent transition-colors">
                <Eye v-if="!showPwNew" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">Vahvista salasana</label>
            <div class="relative">
              <input v-model="pwConfirm" :type="showPwConfirm ? 'text' : 'password'" autocomplete="new-password"
                placeholder="Toista uusi salasana"
                class="w-full px-3 py-2 pr-10 rounded-xl bg-black/60 border border-gray-800 text-sm
                       text-gray-200 placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
              <button type="button" @click="showPwConfirm = !showPwConfirm"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400
                       border-0 bg-transparent transition-colors">
                <Eye v-if="!showPwConfirm" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
          <p v-if="pwError" class="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5 shrink-0" />{{ pwError }}
          </p>
          <button @click="setUserPassword" :disabled="pwSaving"
            class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-0
                   bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-60 transition-all">
            <Check class="w-4 h-4" />{{ pwSaving ? 'Tallennetaan...' : 'Aseta salasana' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

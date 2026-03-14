<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useInboxStore } from '../stores/inbox';
import { useRouter } from 'vue-router';
import {
  User, LogOut, Pencil, Check, AlertCircle, Upload, ImageOff,
  Send, MessageSquare, ChevronDown, ChevronUp, Plus, MailOpen, Mail
} from 'lucide-vue-next';
import api from '../api';

const auth = useAuthStore();
const inbox = useInboxStore();
const router = useRouter();

function logout() { auth.logout(); router.push('/login'); }

// ── JÄSENPROFIILI ──
interface Member {
  _id: string; name: string; aliases: string[]; quote: string; born: string;
  highestPromille: string; favDrink: string; location: string;
  email: string; website: string; avatarUrl: string;
}
const member = ref<Member | null>(null);
const memberLoading = ref(true);
const editOpen = ref(false);
const saving = ref(false);
const saveError = ref('');
const saveOk = ref(false);
const uploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const form = ref({
  name: '', aliasInput: '', quote: '', born: '',
  highestPromille: '', favDrink: '', location: '',
  email: '', website: '', avatarUrl: '',
});

async function loadMember() {
  memberLoading.value = true;
  try {
    const { data } = await api.get('/members/mine');
    member.value = data;
    form.value = { ...data, aliasInput: (data.aliases || []).join(', ') };
  } catch {
    member.value = null;
  } finally {
    memberLoading.value = false;
  }
}

async function saveMember() {
  saving.value = true;
  saveError.value = '';
  saveOk.value = false;
  try {
    const { aliasInput, ...rest } = form.value;
    const { data } = await api.put('/members/mine', {
      ...rest,
      aliases: aliasInput.split(',').map((s: string) => s.trim()).filter(Boolean),
    });
    member.value = data;
    saveOk.value = true;
    setTimeout(() => { saveOk.value = false; editOpen.value = false; }, 1500);
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    saving.value = false;
  }
}

async function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/images/upload?container=avatars', fd);
    form.value.avatarUrl = data.url;
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Kuvan lataus epäonnistui';
  } finally {
    uploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}

// ── VIESTIT ──
interface Reply { content: string; createdAt: string }
interface Message { _id: string; content: string; read: boolean; repliesRead: boolean; replies: Reply[]; createdAt: string }
const messages = ref<Message[]>([]);
const messagesLoading = ref(true);
const composeOpen = ref(false);
const newMessage = ref('');
const sending = ref(false);
const sendError = ref('');
const expandedMsg = ref<string | null>(null);

const unreadCount = computed(() => messages.value.filter(m => !m.repliesRead && m.replies.length > 0).length);

async function loadMessages() {
  messagesLoading.value = true;
  try {
    const { data } = await api.get('/messages/mine');
    messages.value = data;
    inbox.setUnread(data.filter((m: Message) => !m.repliesRead && m.replies.length > 0).length);
  } finally {
    messagesLoading.value = false;
  }
}

async function sendMessage() {
  if (!newMessage.value.trim()) return;
  sending.value = true;
  sendError.value = '';
  try {
    const { data } = await api.post('/messages', { content: newMessage.value.trim() });
    messages.value.unshift(data);
    newMessage.value = '';
    composeOpen.value = false;
  } catch (err: any) {
    sendError.value = err.response?.data?.message || 'Lähetys epäonnistui';
  } finally {
    sending.value = false;
  }
}

async function toggleMsg(id: string) {
  if (expandedMsg.value === id) {
    expandedMsg.value = null;
    return;
  }
  expandedMsg.value = id;
  const m = messages.value.find(x => x._id === id);
  if (m && !m.repliesRead && m.replies.length > 0) {
    try {
      await api.put(`/messages/${id}/reply-read`);
      m.repliesRead = true;
      inbox.setUnread(messages.value.filter(x => !x.repliesRead && x.replies.length > 0).length);
    } catch {}
  }
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fi-FI', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

onMounted(() => { loadMember(); loadMessages(); });
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10 max-w-2xl mx-auto">

    <!-- Header -->
    <div class="flex items-center gap-3 mb-8">
      <div class="flex items-center justify-center w-10 h-10 rounded-xl
                  bg-dgreen-900/40 border border-dgreen-800/50">
        <User class="w-5 h-5 text-dgreen-400" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-white">{{ auth.username }}</h1>
        <p class="text-xs text-gray-600">Oma profiili</p>
      </div>
      <button @click="logout"
        class="ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400
               transition-colors border-0 bg-transparent">
        <LogOut class="w-4 h-4" />Kirjaudu ulos
      </button>
    </div>

    <!-- ── JÄSENPROFIILI ── -->
    <section class="mb-8">
      <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Jäsenprofiilisi</h2>

      <div v-if="memberLoading" class="text-gray-600 text-sm py-6 text-center">Ladataan...</div>

      <div v-else-if="!member"
        class="bg-gray-950 border border-gray-800 rounded-2xl p-5 text-center">
        <p class="text-sm text-gray-600 mb-1">Sinulla ei ole linkitettyä jäsenprofiilia.</p>
        <p class="text-xs text-gray-700">Admin voi linkittää tunnuksesi jäsenprofiiliin.</p>
      </div>

      <div v-else class="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden">
        <!-- Preview -->
        <div class="flex items-center gap-4 p-4">
          <div class="w-14 h-14 rounded-xl overflow-hidden shrink-0
                      bg-dpurple-900/40 border border-dpurple-800/30 flex items-center justify-center">
            <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.name"
                 class="w-full h-full object-cover object-top" />
            <span v-else class="text-lg font-bold text-dpurple-400/60">{{ initials(member.name) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-base font-bold text-white">{{ member.name }}</div>
            <div v-if="member.quote" class="text-xs italic text-dpurple-400/70 mt-0.5 truncate">"{{ member.quote }}"</div>
          </div>
          <button @click="editOpen = !editOpen"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-0
                   bg-dgreen-900/40 hover:bg-dgreen-800/40 text-dgreen-400 transition-all">
            <Pencil class="w-3.5 h-3.5" />
            {{ editOpen ? 'Sulje' : 'Muokkaa' }}
            <ChevronUp v-if="editOpen" class="w-3 h-3" />
            <ChevronDown v-else class="w-3 h-3" />
          </button>
        </div>

        <!-- Muokkauslomake -->
        <div v-if="editOpen" class="border-t border-gray-800 p-4 space-y-3">

          <!-- Avatar upload -->
          <div class="flex items-center gap-3 mb-1">
            <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0
                        bg-dpurple-900/40 border border-dpurple-800/30 flex items-center justify-center">
              <img v-if="form.avatarUrl" :src="form.avatarUrl" class="w-full h-full object-cover object-top" />
              <ImageOff v-else class="w-5 h-5 text-dpurple-700" />
            </div>
            <div>
              <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
              <button @click="fileInputRef?.click()" :disabled="uploading"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border-0
                       border border-dpurple-800/50 text-dpurple-400 hover:bg-dpurple-900/30
                       disabled:opacity-50 transition-colors bg-transparent">
                <Upload class="w-3 h-3" />{{ uploading ? 'Ladataan...' : 'Vaihda kuva' }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Nimi</label>
              <input v-model="form.name" type="text"
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
              <input v-model="form.quote" type="text"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Syntynyt</label>
              <input v-model="form.born" type="text"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Pelipaikka</label>
              <input v-model="form.location" type="text"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Lempiuoma</label>
              <input v-model="form.favDrink" type="text"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Korkein promille</label>
              <input v-model="form.highestPromille" type="text"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">E-mail</label>
              <input v-model="form.email" type="text"
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
            class="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
            <AlertCircle class="w-4 h-4 shrink-0" />{{ saveError }}
          </div>

          <button @click="saveMember" :disabled="saving || saveOk"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                   bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-60 transition-all">
            <Check class="w-4 h-4" />{{ saveOk ? 'Tallennettu!' : saving ? 'Tallennetaan...' : 'Tallenna' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── VIESTIT ── -->
    <section>
      <!-- Section header -->
      <div class="flex items-center gap-3 mb-3">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Viestit</h2>
        <span v-if="unreadCount > 0"
          class="inline-flex items-center justify-center w-5 h-5 rounded-full
                 bg-dgreen-600 text-white text-[10px] font-bold">
          {{ unreadCount }}
        </span>
        <button @click="composeOpen = !composeOpen"
          class="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-0
                 bg-dgreen-900/40 hover:bg-dgreen-800/40 text-dgreen-400 transition-all">
          <Plus class="w-3.5 h-3.5" />Kirjoita
        </button>
      </div>

      <!-- Compose -->
      <div v-if="composeOpen"
        class="bg-gray-950 border border-dgreen-900/40 rounded-2xl p-4 mb-3">
        <p class="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
          <Send class="w-3 h-3" />Viesti adminille
        </p>
        <textarea v-model="newMessage" rows="4" placeholder="Kirjoita viestisi..."
          autofocus
          class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                 placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors resize-none mb-3" />
        <div v-if="sendError"
          class="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/50 border border-red-900/50
                 text-red-400 text-xs mb-2">
          <AlertCircle class="w-3.5 h-3.5 shrink-0" />{{ sendError }}
        </div>
        <div class="flex items-center gap-2 justify-end">
          <button @click="composeOpen = false; newMessage = ''"
            class="px-3 py-1.5 rounded-xl text-xs text-gray-600 hover:text-gray-300
                   transition-colors border-0 bg-transparent">
            Peruuta
          </button>
          <button @click="sendMessage" :disabled="sending || !newMessage.trim()"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium border-0
                   bg-dgreen-900/60 hover:bg-dgreen-800/60 text-dgreen-300 disabled:opacity-50 transition-all">
            <Send class="w-3.5 h-3.5" />{{ sending ? 'Lähetetään...' : 'Lähetä' }}
          </button>
        </div>
      </div>

      <!-- Inbox list -->
      <div v-if="messagesLoading" class="text-gray-600 text-sm py-6 text-center">Ladataan...</div>
      <div v-else-if="messages.length === 0"
        class="text-center py-10 text-gray-700">
        <MessageSquare class="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p class="text-sm">Ei viestejä vielä.</p>
        <p class="text-xs mt-1 text-gray-800">Lähetä ensimmäinen viesti adminille.</p>
      </div>
      <div v-else class="flex flex-col gap-1.5">
        <div
          v-for="m in messages" :key="m._id"
          class="rounded-2xl border overflow-hidden transition-all"
          :class="[
            expandedMsg === m._id ? 'bg-gray-950 border-dgreen-900/50' : 'bg-gray-950 border-gray-800/60 hover:border-gray-700/60',
            !m.repliesRead && m.replies.length ? 'border-l-2 border-l-dgreen-600' : '',
          ]"
        >
          <!-- Row -->
          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
               @click="toggleMsg(m._id)">
            <!-- Unread / read dot -->
            <div class="shrink-0">
              <MailOpen v-if="m.repliesRead || !m.replies.length" class="w-4 h-4 text-gray-700" />
              <Mail v-else class="w-4 h-4 text-dgreen-500" />
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm truncate"
                :class="!m.repliesRead && m.replies.length ? 'text-white font-medium' : 'text-gray-400'">
                {{ m.content }}
              </p>
              <p class="text-xs text-gray-700 mt-0.5">{{ fmtDate(m.createdAt) }}</p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span v-if="!m.repliesRead && m.replies.length"
                class="text-xs px-2 py-0.5 rounded-full bg-dgreen-950/60 border border-dgreen-900/50
                       text-dgreen-400 font-medium">
                {{ m.replies.length }} uusi{{ m.replies.length > 1 ? 'a' : '' }}
              </span>
              <span v-else-if="m.replies.length"
                class="text-xs px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800 text-gray-600">
                {{ m.replies.length }} vastaus{{ m.replies.length > 1 ? 'ta' : '' }}
              </span>
              <div class="text-gray-700 transition-transform duration-200"
                   :class="expandedMsg === m._id ? 'rotate-180' : ''">
                <ChevronDown class="w-4 h-4" />
              </div>
            </div>
          </div>

          <!-- Thread view -->
          <div v-if="expandedMsg === m._id"
            class="border-t border-gray-800/50 px-4 py-4 space-y-3">

            <!-- Original message bubble (user) -->
            <div class="flex justify-end">
              <div class="max-w-[85%] bg-dgreen-950/30 border border-dgreen-900/30 rounded-2xl rounded-tr-sm px-4 py-3">
                <p class="text-xs text-dgreen-700 mb-1">Sinä · {{ fmtDate(m.createdAt) }}</p>
                <p class="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{{ m.content }}</p>
              </div>
            </div>

            <!-- Admin replies -->
            <div v-if="!m.replies.length"
              class="text-center py-2">
              <p class="text-xs text-gray-700 italic">Ei vastauksia vielä — admin vastaa pian.</p>
            </div>
            <div v-for="r in m.replies" :key="r.createdAt" class="flex justify-start">
              <div class="max-w-[85%] bg-dpurple-950/30 border border-dpurple-900/30 rounded-2xl rounded-tl-sm px-4 py-3">
                <p class="text-xs text-dpurple-700 mb-1">Admin · {{ fmtDate(r.createdAt) }}</p>
                <p class="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{{ r.content }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

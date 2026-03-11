<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import {
  User, LogOut, Pencil, Check, AlertCircle, Upload, ImageOff,
  Send, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-vue-next';
import api from '../api';

const auth = useAuthStore();
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
interface Message { _id: string; content: string; read: boolean; replies: Reply[]; createdAt: string }
const messages = ref<Message[]>([]);
const messagesLoading = ref(true);
const newMessage = ref('');
const sending = ref(false);
const sendOk = ref(false);
const sendError = ref('');
const expandedMsg = ref<string | null>(null);

async function loadMessages() {
  messagesLoading.value = true;
  try {
    const { data } = await api.get('/messages/mine');
    messages.value = data;
  } finally {
    messagesLoading.value = false;
  }
}

async function sendMessage() {
  if (!newMessage.value.trim()) return;
  sending.value = true;
  sendError.value = '';
  sendOk.value = false;
  try {
    await api.post('/messages', { content: newMessage.value.trim() });
    newMessage.value = '';
    sendOk.value = true;
    await loadMessages();
    setTimeout(() => { sendOk.value = false; }, 2000);
  } catch (err: any) {
    sendError.value = err.response?.data?.message || 'Lähetys epäonnistui';
  } finally {
    sending.value = false;
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
      <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Viestit adminille</h2>

      <!-- Lähetä viesti -->
      <div class="bg-gray-950 border border-gray-800 rounded-2xl p-4 mb-3">
        <textarea v-model="newMessage" rows="3" placeholder="Kirjoita viesti adminille..."
          class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                 placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors resize-none mb-3" />
        <div v-if="sendError"
          class="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-2">
          <AlertCircle class="w-4 h-4 shrink-0" />{{ sendError }}
        </div>
        <button @click="sendMessage" :disabled="sending || !newMessage.trim()"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                 bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-50 transition-all">
          <Send class="w-4 h-4" />{{ sendOk ? 'Lähetetty!' : sending ? 'Lähetetään...' : 'Lähetä' }}
        </button>
      </div>

      <!-- Viestihistoria -->
      <div v-if="messagesLoading" class="text-gray-600 text-sm py-4 text-center">Ladataan...</div>
      <div v-else-if="messages.length === 0" class="text-gray-700 text-sm text-center py-4">Ei viestejä vielä</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="m in messages" :key="m._id"
          class="bg-gray-950 border rounded-2xl overflow-hidden"
          :class="m.replies.length ? 'border-dgreen-900/40' : 'border-gray-800'">
          <div class="px-4 py-3 cursor-pointer flex items-start justify-between gap-3"
               @click="expandedMsg = expandedMsg === m._id ? null : m._id">
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-300 line-clamp-2">{{ m.content }}</p>
              <p class="text-xs text-gray-700 mt-1">{{ fmtDate(m.createdAt) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="m.replies.length"
                class="text-xs text-dgreen-400 bg-dgreen-950/40 border border-dgreen-900/40
                       px-2 py-0.5 rounded-full">
                {{ m.replies.length }} vastaus{{ m.replies.length > 1 ? 'ta' : '' }}
              </span>
              <MessageSquare class="w-4 h-4 text-gray-700" />
              <ChevronUp v-if="expandedMsg === m._id" class="w-3.5 h-3.5 text-gray-700" />
              <ChevronDown v-else class="w-3.5 h-3.5 text-gray-700" />
            </div>
          </div>
          <div v-if="expandedMsg === m._id"
            class="border-t border-gray-800 px-4 py-3 space-y-2">
            <p v-if="!m.replies.length" class="text-xs text-gray-700 italic">Ei vastauksia vielä</p>
            <div v-for="r in m.replies" :key="r.createdAt"
              class="bg-dgreen-950/20 border border-dgreen-900/30 rounded-xl px-3 py-2">
              <p class="text-xs text-gray-500 mb-1">Admin · {{ fmtDate(r.createdAt) }}</p>
              <p class="text-sm text-gray-200">{{ r.content }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import {
  ShieldCheck, LogOut, Users, Search, Plus,
  Pencil, Trash2, X, Upload, Check, AlertCircle, ImageOff
} from 'lucide-vue-next';
import api from '../api';

interface Member {
  _id: string;
  name: string;
  aliases: string[];
  quote: string;
  born: string;
  highestPromille: string;
  favDrink: string;
  location: string;
  email: string;
  website: string;
  avatarUrl: string;
  points: number;
  active: boolean;
}

type FormData = Omit<Member, 'aliases'> & { aliasInput: string };

const auth = useAuthStore();
const router = useRouter();

const members = ref<Member[]>([]);
const loading = ref(true);
const search = ref('');
const deleting = ref<string | null>(null);

// Modal
const modalOpen = ref(false);
const saving = ref(false);
const saveError = ref('');
const uploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

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

onMounted(loadMembers);

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

function openAdd() {
  form.value = emptyForm();
  saveError.value = '';
  modalOpen.value = true;
}

function openEdit(m: Member) {
  form.value = { ...m, aliasInput: m.aliases.join(', ') };
  saveError.value = '';
  modalOpen.value = true;
}

async function saveMember() {
  if (!form.value.name.trim()) { saveError.value = 'Nimi vaaditaan'; return; }
  saving.value = true;
  saveError.value = '';
  try {
    const { aliasInput, ...rest } = form.value;
    const payload = { ...rest, aliases: aliasInput.split(',').map(s => s.trim()).filter(Boolean) };
    if (form.value._id) {
      await api.put(`/members/${form.value._id}`, payload);
    } else {
      await api.post('/members', payload);
    }
    await loadMembers();
    modalOpen.value = false;
  } catch (err: any) {
    saveError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    saving.value = false;
  }
}

async function deleteMember(id: string) {
  if (!confirm('Piilotetaanko jäsen sivustolta?')) return;
  deleting.value = id;
  try {
    await api.delete(`/members/${id}`);
    await loadMembers();
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

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">

    <!-- Header -->
    <div class="flex items-center gap-3 mb-8">
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
        <LogOut class="w-4 h-4" />
        Kirjaudu ulos
      </button>
    </div>

    <!-- Tilastot -->
    <div class="grid grid-cols-3 gap-3 mb-10">
      <div class="bg-black/50 border border-gray-900 rounded-2xl p-4">
        <div class="text-2xl font-bold text-white">{{ stats.total }}</div>
        <div class="text-xs text-gray-600 mt-0.5">Jäseniä</div>
      </div>
      <div class="bg-black/50 border border-dgreen-900/40 rounded-2xl p-4">
        <div class="text-2xl font-bold text-dgreen-400">{{ stats.active }}</div>
        <div class="text-xs text-gray-600 mt-0.5">Aktiivisia</div>
      </div>
      <div class="bg-black/50 border border-dpurple-900/40 rounded-2xl p-4">
        <div class="text-2xl font-bold text-dpurple-400">{{ stats.withPhoto }}</div>
        <div class="text-xs text-gray-600 mt-0.5">Kuvallisia</div>
      </div>
    </div>

    <!-- Jäsenet-osion header -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-base font-semibold text-white flex items-center gap-2">
        <Users class="w-4 h-4 text-gray-600" />
        Jäsenet
      </h2>
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
        <input v-model="search" placeholder="Hae..."
          class="pl-8 pr-3 py-1.5 text-sm rounded-xl bg-black/60 border border-gray-800
                 text-gray-300 placeholder-gray-700 focus:outline-none focus:border-dgreen-800 transition-colors w-56" />
      </div>
      <button @click="openAdd"
        class="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
               bg-dgreen-900/50 hover:bg-dgreen-800/50 border border-dgreen-800/50
               text-dgreen-300 transition-all duration-150">
        <Plus class="w-4 h-4" />
        Lisää jäsen
      </button>
    </div>

    <!-- Jäsenlista -->
    <div v-if="loading" class="text-gray-600 text-sm py-10 text-center">Ladataan...</div>
    <div v-else class="flex flex-col gap-1">
      <div
        v-for="m in filtered" :key="m._id"
        class="group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors"
        :class="m.active ? 'hover:bg-white/[0.03]' : 'opacity-40 hover:opacity-60'"
      >
        <!-- Avatar -->
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0
                    bg-dpurple-900/40 flex items-center justify-center text-xs font-bold text-dpurple-400">
          <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
          <span v-else>{{ initials(m.name) }}</span>
        </div>

        <!-- Nimi -->
        <div class="flex-1 min-w-0">
          <span class="text-sm text-gray-200 font-medium">{{ m.name }}</span>
          <span v-if="m.aliases.length" class="text-xs text-gray-700 ml-2">{{ m.aliases.join(', ') }}</span>
        </div>

        <span v-if="m.location" class="hidden sm:block text-xs text-gray-700">{{ m.location }}</span>
        <span v-if="!m.active"
          class="text-xs text-red-900/80 bg-red-950/40 px-2 py-0.5 rounded-full border border-red-900/30">
          piilotettu
        </span>

        <!-- Napit -->
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button @click="openEdit(m)"
            class="p-1.5 rounded-lg text-gray-600 hover:text-dgreen-400 hover:bg-dgreen-900/20
                   transition-colors border-0 bg-transparent">
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button @click="deleteMember(m._id)" :disabled="deleting === m._id"
            class="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20
                   transition-colors border-0 bg-transparent">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <p v-if="!loading" class="text-xs text-gray-700 mt-4 text-center">
      {{ filtered.length }} / {{ members.length }} jäsentä
    </p>
  </div>

  <!-- Modal -->
  <Teleport to="body">
    <div v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 sm:pt-14 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="modalOpen = false" />

      <!-- Korttimodaali -->
      <div class="relative w-full max-w-lg bg-[#090909] border border-dgreen-900/50
                  rounded-2xl shadow-2xl z-10 mb-8">

        <!-- Otsikko -->
        <div class="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-900/80">
          <h3 class="text-base font-bold text-white">
            {{ form._id ? 'Muokkaa jäsentä' : 'Lisää uusi jäsen' }}
          </h3>
          <button @click="modalOpen = false"
            class="ml-auto p-1 rounded-lg text-gray-600 hover:text-white transition-colors border-0 bg-transparent">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Lomake -->
        <div class="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">

          <!-- Avatar + upload -->
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0
                        bg-dpurple-900/40 border border-dpurple-800/30
                        flex items-center justify-center">
              <img v-if="form.avatarUrl" :src="form.avatarUrl" :alt="form.name" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
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
              <p class="text-xs text-gray-700">tai syötä URL alle · vaatii Azure Blob</p>
            </div>
            <!-- Aktiivinen-kytkin -->
            <button @click="form.active = !form.active"
              class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              :class="form.active
                ? 'bg-dgreen-900/40 border-dgreen-800/50 text-dgreen-400'
                : 'bg-gray-900/40 border-gray-800/50 text-gray-600'">
              {{ form.active ? 'Aktiivinen' : 'Piilotettu' }}
            </button>
          </div>

          <!-- Kentät -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Nimi *</label>
              <input v-model="form.name" type="text" placeholder="Nimi Sukunimi"
                class="w-full px-3 py-2 rounded-xl bg-black/60 border border-gray-800 text-sm text-gray-200
                       placeholder-gray-700 focus:outline-none focus:border-dgreen-700 transition-colors" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-600 mb-1">Aliakset (pilkulla eroteltu)</label>
              <input v-model="form.aliasInput" type="text" placeholder="alias1, alias2, alias3"
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

          <!-- Virheviesti -->
          <div v-if="saveError"
            class="flex items-center gap-2 px-3 py-2 rounded-xl
                   bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
            <AlertCircle class="w-4 h-4 shrink-0" />
            {{ saveError }}
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-900/80">
          <button @click="modalOpen = false"
            class="px-4 py-2 rounded-xl text-sm text-gray-600 hover:text-gray-300
                   transition-colors border-0 bg-transparent">
            Peruuta
          </button>
          <button @click="saveMember" :disabled="saving"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-0
                   bg-dgreen-800/80 hover:bg-dgreen-700/80 text-white disabled:opacity-50 transition-all">
            <Check class="w-4 h-4" />
            {{ saving ? 'Tallennetaan...' : 'Tallenna' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

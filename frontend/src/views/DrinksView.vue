<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus, GlassWater, ChevronDown, Trash2, X, AlertTriangle, User } from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

interface Drink {
  _id: string;
  name: string;
  instructions: string;
  author: string;
  imageUrl: string;
  createdAt: string;
}

const auth = useAuthStore();
const drinks = ref<Drink[]>([]);
const loading = ref(true);
const expandedId = ref<string | null>(null);
const deleting = ref<string | null>(null);

// Add modal
const modalOpen = ref(false);
const saving = ref(false);
const saveError = ref('');
const form = ref({ name: '', instructions: '' });

// Delete confirm modal
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

function openModal() {
  form.value = { name: '', instructions: '' };
  saveError.value = '';
  modalOpen.value = true;
}

async function submit() {
  if (!form.value.name.trim() || !form.value.instructions.trim()) return;
  saving.value = true;
  saveError.value = '';
  try {
    const { data } = await api.post('/drinks', form.value);
    drinks.value.unshift(data);
    modalOpen.value = false;
  } catch (e: any) {
    saveError.value = e.response?.data?.message || 'Lisäys epäonnistui';
  } finally {
    saving.value = false;
  }
}

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

const sorted = computed(() => [...drinks.value].sort((a, b) => a.name.localeCompare(b.name, 'fi')));
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
        <!-- Kortin yläosa: nimi + napit -->
        <div
          class="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
          @click="toggleExpand(d._id)"
        >
          <!-- Väripallo / ikoni -->
          <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                      bg-dpurple-900/50 border border-dpurple-800/40">
            <GlassWater class="w-4 h-4 text-dpurple-400" />
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white leading-tight truncate">{{ d.name }}</p>
            <p class="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
              <User class="w-3 h-3" />{{ d.author }}
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              v-if="auth.isAdmin"
              @click.stop="confirmDelete(d)"
              :disabled="deleting === d._id"
              class="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-900/20
                     opacity-0 group-hover:opacity-100 transition-all border-0 bg-transparent"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
            <div class="p-1.5 text-gray-600 transition-transform duration-200"
                 :class="expandedId === d._id ? 'rotate-180' : ''">
              <ChevronDown class="w-4 h-4" />
            </div>
          </div>
        </div>

        <!-- Preview (collapsed): ensimmäinen rivi ohjeesta -->
        <div v-if="expandedId !== d._id"
          class="px-4 pb-3.5 -mt-1">
          <p class="text-xs text-gray-600 truncate leading-relaxed">
            {{ d.instructions.split('\n')[0] }}
          </p>
        </div>

        <!-- Expanded: täysi ohje -->
        <div v-if="expandedId === d._id"
          class="px-4 pb-5 border-t border-gray-800/50 pt-4">
          <div class="flex gap-4 items-start">
            <img v-if="d.imageUrl" :src="d.imageUrl" :alt="d.name"
              referrerpolicy="no-referrer"
              class="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-gray-800" />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{{ d.instructions }}</p>
            </div>
          </div>
          <!-- Admin: poistonappi myös expanded-tilassa mobiililla (hover ei toimi) -->
          <div v-if="auth.isAdmin" class="mt-4 flex justify-end">
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

  <!-- ── LISÄÄ DRINKKI -MODAALI ── -->
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

          <p v-if="saveError" class="text-xs text-red-400">{{ saveError }}</p>

          <div class="flex items-center justify-end gap-2 pt-1 pb-1">
            <button type="button" @click="modalOpen = false"
              class="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300
                     transition-colors border-0 bg-transparent">
              Peruuta
            </button>
            <button type="submit" :disabled="saving || !form.name.trim() || !form.instructions.trim()"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-0
                     bg-dpurple-900/60 hover:bg-dpurple-800/60 text-dpurple-300
                     disabled:opacity-40 transition-all">
              <Plus class="w-4 h-4" />
              {{ saving ? 'Tallennetaan...' : 'Lisää' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- ── POISTOVAHVISTUS -MODAALI ── -->
  <Teleport to="body">
    <div v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="deleteTarget = null" />

      <div class="relative w-full sm:max-w-sm bg-gray-950 border border-red-900/40
                  rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">

        <!-- Punainen yläpalkki -->
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
              <Trash2 class="w-3.5 h-3.5" />
              {{ deleting ? 'Poistetaan...' : 'Poista' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

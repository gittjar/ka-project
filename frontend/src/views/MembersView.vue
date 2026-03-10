<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Search, ArrowUpDown,
  MapPin, GlassWater, Flame, Cake, Star, Globe, Mail, Hash
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
}

const members = ref<Member[]>([]);
const search = ref('');
const sortKey = ref<'name' | 'location' | 'points'>('name');
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get('/members');
    members.value = data;
  } finally {
    loading.value = false;
  }
});

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  let result = members.value.filter(m =>
    !q ||
    m.name.toLowerCase().includes(q) ||
    (m.location || '').toLowerCase().includes(q) ||
    m.aliases.some(a => a.toLowerCase().includes(q)) ||
    (m.quote || '').toLowerCase().includes(q)
  );
  if (sortKey.value === 'name')     result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  if (sortKey.value === 'location') result = [...result].sort((a, b) => (a.location || '').localeCompare(b.location || '', 'fi'));
  if (sortKey.value === 'points')   result = [...result].sort((a, b) => (b.points || 0) - (a.points || 0));
  return result;
});

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
</script>

<template>
  <div class="px-4 sm:px-8 lg:px-12 py-10">

    <!-- Otsikko -->
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold text-white mb-1">Jäsenet</h1>
      <p class="text-gray-600 text-sm">{{ members.length }} jäsentä rekisterissä</p>
    </div>

    <!-- Hakupalkki + lajittelu -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
        <input
          v-model="search" type="text"
          placeholder="Hae nimellä, aliaksella, quotella tai paikkakunnalla..."
          class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/60 border border-gray-800
                 text-gray-200 placeholder-gray-700 text-sm
                 focus:outline-none focus:border-dgreen-700 transition-colors"
        />
      </div>
      <div class="relative shrink-0">
        <select v-model="sortKey"
          class="appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-black/60 border border-gray-800
                 text-gray-400 text-sm focus:outline-none focus:border-dgreen-700 cursor-pointer">
          <option value="name">A–Z</option>
          <option value="location">Paikkakunta</option>
          <option value="points">Pisteet</option>
        </select>
        <ArrowUpDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
      </div>
    </div>

    <!-- Ladataan -->
    <div v-if="loading" class="text-gray-600 py-20 text-center text-sm">Ladataan jäseniä...</div>

    <!-- Ei tuloksia -->
    <div v-else-if="filtered.length === 0" class="text-gray-600 italic py-20 text-center text-sm">
      Ei tuloksia haulla "{{ search }}"
    </div>

    <!-- Kortit – yksi per rivi, täysi leveys -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="m in filtered" :key="m._id"
        class="flex overflow-hidden rounded-2xl bg-gray-950 h-44
               border border-gray-800 hover:border-dgreen-900/60 hover:bg-dgreen-950/20
               transition-all duration-150"
      >
        <!-- Avatar – koko kortin korkeus -->
        <div class="flex-shrink-0 w-36 sm:w-44 bg-dpurple-900/40 border-r border-dpurple-800/20
                    flex items-center justify-center">
          <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" referrerpolicy="no-referrer" class="w-full h-full object-cover object-top" />
          <span v-else class="text-3xl font-bold text-dpurple-400/40">{{ initials(m.name) }}</span>
        </div>

        <!-- Sisältö -->
        <div class="flex-1 min-w-0 p-6">

          <!-- Nimi + pisteet -->
          <div class="flex items-start justify-between gap-4 mb-1">
            <h2 class="text-xl font-bold text-white leading-tight">{{ m.name }}</h2>
            <div v-if="m.points"
              class="shrink-0 flex items-center gap-1.5 text-sm font-semibold
                     text-dgreen-400 bg-dgreen-950/40 border border-dgreen-900/40
                     px-2.5 py-1 rounded-full">
              <Star class="w-3.5 h-3.5" />{{ m.points }}p
            </div>
          </div>

          <!-- Aliakset -->
          <div v-if="m.aliases.length" class="flex flex-wrap gap-1.5 mb-3">
            <span v-for="a in m.aliases" :key="a"
              class="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full
                     bg-dpurple-900/40 border border-dpurple-800/30 text-dpurple-400/80">
              <Hash class="w-2.5 h-2.5" />{{ a }}
            </span>
          </div>

          <!-- Quote -->
          <p v-if="m.quote" class="text-sm italic text-dpurple-400/70 mb-4 leading-relaxed">
            "{{ m.quote }}"
          </p>

          <!-- Kaikki kentät -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-sm text-gray-500">
            <span v-if="m.born" class="flex items-center gap-2">
              <Cake class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.born }}
            </span>
            <span v-if="m.location" class="flex items-center gap-2">
              <MapPin class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.location }}
            </span>
            <span v-if="m.favDrink" class="flex items-center gap-2">
              <GlassWater class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.favDrink }}
            </span>
            <span v-if="m.highestPromille" class="flex items-center gap-2">
              <Flame class="w-3.5 h-3.5 text-gray-700 shrink-0" />Korkein: {{ m.highestPromille }}
            </span>
            <a v-if="m.website && m.website.startsWith('http')"
              :href="m.website" target="_blank" rel="noopener noreferrer"
              class="flex items-center gap-2 hover:text-dgreen-400 transition-colors truncate">
              <Globe class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.website.replace(/^https?:\/\//, '') }}
            </a>
            <span v-if="m.email" class="flex items-center gap-2 truncate">
              <Mail class="w-3.5 h-3.5 text-gray-700 shrink-0" />{{ m.email }}
            </span>
          </div>

        </div>
      </div>
    </div>

    <!-- Laskuri -->
    <p v-if="!loading && filtered.length > 0" class="text-xs text-gray-700 mt-8 text-center">
      {{ filtered.length }} / {{ members.length }} jäsentä
    </p>

  </div>
</template>

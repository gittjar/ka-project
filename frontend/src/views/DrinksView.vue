<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Plus, GlassWater, ChevronDown, Trash2, X, AlertTriangle, User, Pencil, Film, ImageIcon, CheckCircle2, MapPin, Navigation, Beer, ShoppingCart, Star } from 'lucide-vue-next';
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
onMounted(() => {
  fetchDrinks();
  api.get('/config').then(r => { mapsKey.value = r.data.googleMapsKey || null; }).catch(() => {});
});

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

// ── Computed ──────────────────────────────────────────────────────────────────
const sorted = computed(() => [...drinks.value].sort((a, b) => a.name.localeCompare(b.name, 'fi')));

function drinkMedia(d: Drink): { url: string; type: 'image' | 'video' } | null {
  const url = d.mediaUrl || d.imageUrl;
  if (!url) return null;
  const type: 'image' | 'video' = d.mediaType === 'video' ? 'video' : 'image';
  return { url, type };
}

// ── Lähellä olevat paikat ────────────────────────────────────────────────────

interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number;
  open: boolean | null;
  type: 'bar' | 'alko' | 'kauppa';
}

const nearbyPlaces = ref<NearbyPlace[]>([]);
const nearbyLoading = ref(false);
const nearbyError = ref('');
const nearbyRadius = ref(1000);
const userLat = ref<number | null>(null);
const userLng = ref<number | null>(null);
const locationAsked = ref(false);
const activeFilter = ref<'kaikki' | 'bar' | 'alko' | 'kauppa'>('kaikki');
const nearbyMapDiv = ref<HTMLElement | null>(null);
const mapsKey = ref<string | null>(null);
let _nearbyMap: any = null;
let _nearbyMarkers: any[] = [];
let _nearbyLines: any[] = [];
let _userMarker: any = null;

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const TYPE_COLORS: Record<string, string> = {
  bar:    '#a855f7',
  alko:   '#22c55e',
  kauppa: '#f59e0b',
};

const filteredPlaces = computed(() =>
  activeFilter.value === 'kaikki'
    ? nearbyPlaces.value
    : nearbyPlaces.value.filter(p => p.type === activeFilter.value)
);

function loadGoogleMapsScript(key: string): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    s.async = true; s.onload = () => resolve(); s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

async function initNearbyMap(places: NearbyPlace[]) {
  if (!mapsKey.value || !nearbyMapDiv.value || !userLat.value) return;
  await loadGoogleMapsScript(mapsKey.value);
  const G = (window as any).google.maps;
  const userPos = { lat: userLat.value, lng: userLng.value! };

  if (!_nearbyMap) {
    _nearbyMap = new G.Map(nearbyMapDiv.value, {
      center: userPos,
      zoom: 14,
      styles: DARK_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: G.ControlPosition.RIGHT_BOTTOM },
    });
  }

  // Sininen täplä — luodaan vain kerran, siirretään tarvittaessa
  if (!_userMarker) {
    _userMarker = new G.Marker({
      position: userPos,
      map: _nearbyMap,
      icon: {
        path: G.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5,
      },
      title: 'Sijaintisi',
      zIndex: 100,
    });
  } else {
    _userMarker.setPosition(userPos);
  }

  // Poista vanhat pinit ja viivat
  _nearbyMarkers.forEach(m => m.setMap(null));
  _nearbyLines.forEach(l => l.setMap(null));
  _nearbyMarkers = [];
  _nearbyLines = [];

  // Laske fitBounds kaikista pisteistä
  const bounds = new G.LatLngBounds();
  bounds.extend(userPos);

  places.forEach(p => {
    const color = TYPE_COLORS[p.type] || '#888';
    // Viiva käyttäjästä kohteeseen
    const line = new G.Polyline({
      path: [userPos, { lat: p.lat, lng: p.lng }],
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.35,
      strokeWeight: 1.5,
      map: _nearbyMap,
    });
    _nearbyLines.push(line);
    // Pini
    const marker = new G.Marker({
      position: { lat: p.lat, lng: p.lng },
      map: _nearbyMap,
      title: p.name,
      icon: {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: color, fillOpacity: 1, strokeColor: '#000', strokeWeight: 1,
        scale: 1.6, anchor: new G.Point(12, 22),
      },
    });
    _nearbyMarkers.push(marker);
    bounds.extend({ lat: p.lat, lng: p.lng });
  });

  if (places.length > 0) {
    _nearbyMap.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  } else {
    _nearbyMap.setCenter(userPos);
    _nearbyMap.setZoom(14);
  }
}

async function fetchNearby() {
  if (!userLat.value) return;
  nearbyLoading.value = true;
  nearbyError.value = '';
  try {
    const { data } = await api.get<NearbyPlace[]>(
      `/places/nearby?lat=${userLat.value}&lng=${userLng.value}&radius=${nearbyRadius.value}`
    );
    nearbyPlaces.value = data;
    await initNearbyMap(data);
  } catch (e: any) {
    nearbyError.value = e.response?.data?.message || 'Haku epäonnistui';
  } finally {
    nearbyLoading.value = false;
  }
}

function requestLocation() {
  locationAsked.value = true;
  nearbyLoading.value = true;
  if (!navigator.geolocation) {
    nearbyError.value = 'Selaimesi ei tue paikannusta';
    nearbyLoading.value = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      userLat.value = pos.coords.latitude;
      userLng.value = pos.coords.longitude;
      await fetchNearby();
    },
    (err) => {
      const msgs: Record<number, string> = {
        1: 'Lupa evätty — salli sijainti selaimen osoitepalkista 🔒',
        2: 'Sijaintia ei löydetty (verkkovirhe tai GPS ei toimi)',
        3: 'Aikakatkaisu — yritä uudelleen',
      };
      nearbyError.value = msgs[err.code] || `Virhe ${err.code}: ${err.message}`;
      nearbyLoading.value = false;
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
  );
}

watch(nearbyMapDiv, async (el) => {
  if (!el) {
    // Div unmountattu — nollataan jotta seuraava mount luo kartan oikeaan containeriin
    _nearbyMap = null;
    _userMarker = null;
    _nearbyMarkers = [];
    _nearbyLines = [];
    return;
  }
  if (userLat.value) await initNearbyMap(filteredPlaces.value);
});

watch(filteredPlaces, async places => {
  if (_nearbyMap) await initNearbyMap(places);
});

function calcDist(lat: number, lng: number): number {
  if (!userLat.value || !userLng.value) return 0;
  const R = 6371000;
  const dLat = (lat - userLat.value) * Math.PI / 180;
  const dLng = (lng - userLng.value) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(userLat.value * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function distanceM(lat: number, lng: number): string {
  const d = calcDist(lat, lng);
  if (!d) return '';
  return d < 1000 ? Math.round(d) + ' m' : (d/1000).toFixed(1) + ' km';
}

function walkTime(lat: number, lng: number): string {
  const d = calcDist(lat, lng);
  if (!d) return '';
  const mins = Math.round(d * 1.3 / 83.3); // ~5 km/h, 1.3× reittikerroin
  return mins < 1 ? '< 1 min kävellen' : `~${mins} min kävellen`;
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
                       sm:opacity-0 sm:group-hover:opacity-100 transition-all border-0 bg-transparent"
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
                       sm:opacity-0 sm:group-hover:opacity-100 transition-all border-0 bg-transparent"
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

          <!-- Muokkaa/Poista expanded -->
          <div v-if="canEdit(d)" class="mt-4 pt-3 border-t border-gray-800/40 flex flex-col sm:flex-row sm:justify-end gap-0.5 sm:gap-2">
            <button @click.stop="openEdit(d)"
              class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border-0
                     text-dpurple-400/70 hover:text-dpurple-300 transition-all bg-transparent text-left">
              <Pencil class="w-3 h-3 shrink-0" />Muokkaa
            </button>
            <button @click.stop="confirmDelete(d)" :disabled="deleting === d._id"
              class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border-0
                     text-red-500/70 hover:text-red-400 transition-all bg-transparent text-left">
              <Trash2 class="w-3 h-3 shrink-0" />Poista
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── LÄHIMMÄT PAIKAT ──────────────────────────────────────────────────────── -->
  <div class="max-w-4xl mx-auto px-4 pb-16 mt-12">
    <div class="border-t border-gray-800/60 pt-10">

      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <MapPin class="w-4 h-4 text-dgreen-400" />Lähimmät juomapaikat
          </h2>
          <p class="text-xs text-gray-600 mt-0.5">Baarit, alkot ja kaupat — sijaintiasi ei tallenneta</p>
        </div>
        <div v-if="userLat" class="flex items-center gap-2">
          <select v-model="nearbyRadius" @change="fetchNearby"
            class="px-2 py-1.5 rounded-lg text-xs bg-gray-900 border border-gray-700 text-gray-400 focus:outline-none">
            <option :value="500">500 m</option>
            <option :value="1000">1 km</option>
            <option :value="2000">2 km</option>
            <option :value="5000">5 km</option>
          </select>
          <button @click="fetchNearby" :disabled="nearbyLoading"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-700
                   text-gray-400 hover:text-white hover:border-gray-500 transition-all disabled:opacity-40 bg-transparent">
            <Navigation class="w-3 h-3" />Päivitä
          </button>
        </div>
      </div>

      <!-- Sijaintipyyntö -->
      <div v-if="!locationAsked"
        class="flex flex-col items-center gap-4 py-12 rounded-2xl border border-gray-800/60 bg-gray-900/30">
        <div class="w-12 h-12 rounded-2xl bg-dgreen-950/60 border border-dgreen-900/40 flex items-center justify-center">
          <Navigation class="w-5 h-5 text-dgreen-400" />
        </div>
        <div class="text-center">
          <p class="text-sm text-white font-medium mb-1">Näytä lähimmät juomapaikat</p>
          <p class="text-xs text-gray-600">Selaimen sijantilupa tarvitaan — tietoa ei tallenneta</p>
        </div>
        <button @click="requestLocation"
          class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border-0
                 bg-dgreen-900/60 hover:bg-dgreen-800/60 text-dgreen-300 transition-all">
          <MapPin class="w-4 h-4" />Käytä sijaintia
        </button>
      </div>

      <!-- Lataus -->
      <div v-else-if="nearbyLoading"
        class="flex items-center justify-center gap-3 py-12 text-gray-600 text-sm">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Haetaan lähellä olevia paikkoja...
      </div>

      <!-- Virhe -->
      <div v-else-if="nearbyError" class="flex flex-col items-center gap-3 py-8">
        <p class="text-red-400/80 text-sm text-center">{{ nearbyError }}</p>
        <button @click="locationAsked = false; nearbyError = ''"
          class="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white bg-transparent transition-all">
          Yritä uudelleen
        </button>
      </div>

      <!-- Tulokset -->
      <div v-else-if="userLat">
        <!-- Filtterit -->
        <div class="flex gap-2 mb-4 flex-wrap">
          <button v-for="f in (['kaikki','bar','alko','kauppa'] as const)" :key="f"
            @click="activeFilter = f"
            class="px-3 py-1 rounded-full text-xs font-medium border transition-all"
            :class="activeFilter === f
              ? 'border-dgreen-700 bg-dgreen-950/60 text-dgreen-300'
              : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 bg-transparent'">
            {{ f === 'kaikki' ? `Kaikki (${nearbyPlaces.length})` : f === 'bar' ? '🍺 Baarit' : f === 'alko' ? '🍾 Alkot' : '🛒 Kaupat' }}
          </button>
        </div>

        <!-- Kartta -->
        <div v-if="mapsKey" class="w-full rounded-2xl overflow-hidden border border-gray-800/60 mb-4" style="height:380px">
          <div ref="nearbyMapDiv" style="width:100%;height:100%" />
        </div>

        <!-- Lista -->
        <div v-if="filteredPlaces.length" class="space-y-2">
          <a v-for="p in filteredPlaces" :key="p.id"
            :href="`https://maps.google.com/?q=${p.lat},${p.lng}`"
            target="_blank" rel="noopener"
            class="flex items-start gap-3 p-3 rounded-xl border border-gray-800/60 bg-gray-900/30
                   hover:bg-gray-900/60 hover:border-gray-700 transition-all group">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              :style="{ background: p.type === 'bar' ? 'rgba(168,85,247,0.15)' : p.type === 'alko' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)' }">
              <Beer v-if="p.type === 'bar'" class="w-4 h-4 text-purple-400" />
              <GlassWater v-else-if="p.type === 'alko'" class="w-4 h-4 text-dgreen-400" />
              <ShoppingCart v-else class="w-4 h-4 text-amber-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm text-white font-medium group-hover:text-dgreen-300 transition-colors">{{ p.name }}</span>
                <span v-if="p.open === true" class="text-[10px] px-1.5 py-0.5 rounded-full bg-dgreen-950/60 border border-dgreen-900/40 text-dgreen-400">Auki</span>
                <span v-else-if="p.open === false" class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/60 border border-red-900/40 text-red-400">Kiinni</span>
              </div>
              <p class="text-xs text-gray-600 truncate mt-0.5">{{ p.address }}</p>
              <div class="flex items-center gap-3 mt-1">
                <span v-if="p.rating" class="flex items-center gap-1 text-xs text-gray-500">
                  <Star class="w-3 h-3 text-yellow-500/70" />{{ p.rating.toFixed(1) }}
                  <span class="text-gray-700">({{ p.ratingCount }})</span>
                </span>
                <span class="text-xs text-gray-600">{{ distanceM(p.lat, p.lng) }}</span>
                <span class="text-xs text-gray-700">{{ walkTime(p.lat, p.lng) }}</span>
              </div>
            </div>
            <MapPin class="w-3.5 h-3.5 text-gray-700 group-hover:text-dgreen-500 shrink-0 mt-1 transition-colors" />
          </a>
        </div>
        <p v-else class="text-center py-6 text-gray-700 text-sm">Ei paikkoja löydetty valitulla suodattimella</p>
      </div>
    </div>
  </div>

  <!-- ── LISÄÄ DRINKKI ──────────────────────────────────────────────────────────── -->
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

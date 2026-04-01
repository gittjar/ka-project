<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api from '../api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const MEDIA_BASE = (import.meta.env.VITE_MEDIA_URL ?? '') + '/kuvat';

const loading = ref(true);
const notFound = ref(false);
const blobName = ref('');
const folderId = ref<string | null>(null);
const isVideo = computed(() => /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i.test(blobName.value));

const token = route.params.token as string;
const mediaUrl = computed(() => blobName.value ? `${MEDIA_BASE}/s/${token}` : '');

onMounted(async () => {
  try {
    const { data } = await api.get(`/images/share/${token}`);
    blobName.value = data.blobName;
    folderId.value = data.folderId ?? null;
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});

function openInGallery() {
  const query: Record<string, string> = { img: blobName.value };
  if (folderId.value) query.folder = folderId.value;
  router.push({ path: '/galleria', query });
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-12">
    <div v-if="loading" class="flex items-center justify-center py-24 text-gray-500 text-sm">
      Ladataan...
    </div>

    <div v-else-if="notFound" class="flex flex-col items-center justify-center py-24 text-center gap-3">
      <p class="text-gray-400 text-sm">Jakolinkki on vanhentunut tai virheellinen.</p>
      <RouterLink to="/galleria" class="text-dpurple-400 text-sm hover:underline">Avaa galleria</RouterLink>
    </div>

    <div v-else class="flex flex-col items-center gap-6">
      <!-- Kuva tai video -->
      <video v-if="isVideo" :src="mediaUrl" controls crossorigin="anonymous"
        class="max-h-[75vh] max-w-full rounded-xl shadow-xl" />
      <img v-else :src="mediaUrl" crossorigin="anonymous"
        class="max-h-[75vh] max-w-full rounded-xl shadow-xl object-contain" />

      <!-- Toimintopainikkeet -->
      <div class="flex flex-col sm:flex-row items-center gap-3">
        <button v-if="auth.isLoggedIn" @click="openInGallery"
          class="px-5 py-2.5 rounded-xl bg-dpurple-700 hover:bg-dpurple-600
                 text-white text-sm font-medium transition-colors">
          Avaa galleriassa
        </button>
        <RouterLink v-else to="/login"
          class="px-5 py-2.5 rounded-xl bg-dpurple-700 hover:bg-dpurple-600
                 text-white text-sm font-medium transition-colors">
          Kirjaudu nähdäksesi gallerian
        </RouterLink>
        <RouterLink to="/"
          class="px-5 py-2.5 rounded-xl border border-gray-700 hover:border-gray-500
                 text-gray-300 text-sm font-medium transition-colors">
          Etusivu
        </RouterLink>
      </div>
    </div>
  </div>
</template>

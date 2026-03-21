<script setup lang="ts">
import { ref } from 'vue';
import { BookOpen, Lock, ChevronDown, ChevronUp, Shield, Users, Image, BookText, GlassWater, Calendar, Key, Check, LogIn } from 'lucide-vue-next';
import api from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

// ── PIN gate ──
const SESSION_KEY = 'guides_unlocked';
const unlocked = ref(sessionStorage.getItem(SESSION_KEY) === '1');
const pin = ref('');
const pinError = ref('');
const verifying = ref(false);

async function verifyPin() {
  if (!pin.value.trim()) { pinError.value = 'Syötä PIN'; return; }
  verifying.value = true; pinError.value = '';
  try {
    await api.post('/guides/verify', { pin: pin.value.trim() });
    sessionStorage.setItem(SESSION_KEY, '1');
    unlocked.value = true;
  } catch {
    pinError.value = 'Väärä PIN-koodi';
    pin.value = '';
  } finally {
    verifying.value = false;
  }
}

// ── Collapsible sections ──
const open = ref<Record<string, boolean>>({});
function toggle(id: string) { open.value[id] = !open.value[id]; }

// ── Admin PIN reset ──
const newPin = ref('');
const pinSaving = ref(false);
const pinSaved = ref(false);
const pinSaveError = ref('');

async function saveNewPin() {
  if (!newPin.value.trim() || newPin.value.length < 4) {
    pinSaveError.value = 'PIN oltava vähintään 4 merkkiä'; return;
  }
  pinSaving.value = true; pinSaveError.value = ''; pinSaved.value = false;
  try {
    await api.put('/guides/pin', { pin: newPin.value.trim() });
    pinSaved.value = true;
    newPin.value = '';
    setTimeout(() => { pinSaved.value = false; }, 3000);
  } catch (err: any) {
    pinSaveError.value = err.response?.data?.message || 'Tallennus epäonnistui';
  } finally {
    pinSaving.value = false;
  }
}

interface Section {
  id: string; title: string; icon: any; content: { heading?: string; text?: string; steps?: string[]; note?: string }[];
}

const sections: Section[] = [
  {
    id: 'overview',
    title: 'Yleiskatsaus — Mitä admin voi tehdä?',
    icon: Shield,
    content: [
      { text: 'Admin-käyttäjällä on täydet oikeudet koko palveluun. Admin-paneeliin pääset navigaatiopalkin kautta kun olet kirjautunut admin-tunnuksella.' },
      { heading: 'Admin-välilehdet', steps: [
        'Jäsenet — Lisää, muokkaa ja poista jäseniä. Hallinnoi jäsentietoja, kuvia ja pisteitä.',
        'Käyttäjät — Hyväksy, hylkää ja hallinnoi käyttäjätunnuksia. Myönnä tai poista admin-oikeudet.',
        'Viestit — Lue ja vastaa käyttäjien lähettämiin viesteihin/hakemuksiin.',
        'Kutsukoodit — Luo kutsukoodeja rekisteröitymistä varten.',
      ]},
    ],
  },
  {
    id: 'new-user',
    title: 'Uuden käyttäjän hyväksyminen',
    icon: Users,
    content: [
      { text: 'Rekisteröitymiseen tarvitaan kutsukoodi. Uusi käyttäjä saa tunnuksen "pending"-tilaan, kunnes admin hyväksyy sen.' },
      { heading: 'Vaiheet', steps: [
        'Luo ensin kutsukoodi: Admin-paneeli → Kutsukoodit → "Luo kutsukoodi".',
        'Kopioi koodi ja lähetä se henkilölle esim. WhatsAppilla tai sähköpostilla.',
        'Henkilö rekisteröityy osoitteessa /rekisteroidy kutsukoodilla.',
        'Siirry Admin-paneeli → Käyttäjät.',
        'Etsi uusi käyttäjä listasta (tila: "pending").',
        'Paina "Hyväksy" — käyttäjä saa kirjautumisyhteyden palveluun.',
        'Jos haluat linkittää tunnuksen jäsenprofiiliin, valitse "Linkitä jäseneen" -pudotusvalikosta oikea jäsen.',
      ]},
      { note: 'Kutsukoodit vanhenevat 7 päivässä. Luo uusi koodi tarvittaessa.' },
    ],
  },
  {
    id: 'admin-rights',
    title: 'Admin-oikeuksien myöntäminen',
    icon: Shield,
    content: [
      { text: 'Admin-oikeudet antavat täyden pääsyn kaikkeen — myönnä harkiten vain luotetuille henkilöille.' },
      { heading: 'Admin-oikeuden myöntäminen', steps: [
        'Siirry Admin-paneeli → Käyttäjät.',
        'Etsi haluamasi käyttäjä hakukentällä.',
        'Paina kilpi-ikonia (Shield) käyttäjän kohdalla — rooli vaihtuu "user" → "admin".',
        'Vahvista toiminto ponnahdusikkunassa.',
        'Henkilö näkee "/admin"-linkin navigaatiossa seuraavan kirjautumisen jälkeen.',
      ]},
      { heading: 'Admin-oikeuden poistaminen', steps: [
        'Sama prosessi — kilpi-ikoni (ShieldOff) vaihtaa roolin takaisin "user":ksi.',
        'Muutos astuu voimaan henkilön seuraavalla kirjautumiskerralla.',
      ]},
      { note: 'Et voi poistaa omia admin-oikeuksiasi — tarvitaan toinen admin.' },
    ],
  },
  {
    id: 'member-management',
    title: 'Jäsenten hallinta',
    icon: BookText,
    content: [
      { heading: 'Uuden jäsenen lisääminen', steps: [
        'Admin-paneeli → Jäsenet → "Lisää jäsen" (+ nappi).',
        'Täytä nimi, liikanimi, lainaus, syntymävuosi, promilleennätys, lempipiima, paikkakunta, sähköposti, verkkosivut.',
        'Lataa kasvokuva (avatarUrl) — hyväksytään jpg/png/webp/heic, max 5 MB.',
        'Tallenna → jäsen näkyy heti /jasenet-sivulla.',
      ]},
      { heading: 'Jäsenen profiilikuvan lisääminen', steps: [
        'Avaa jäsen Admin-paneelissa klikkaamalla hänen nimeään.',
        'Selaa alas "Kuvat"-osioon.',
        'Lataa kuva tai video (max 50 MB, HEIC ok).',
        'Kuvat näkyvät jäsenen profiilikortissa karusellinauhana.',
      ]},
      { heading: 'Jäsenen linkittäminen käyttäjätunnukseen', steps: [
        'Admin-paneeli → Käyttäjät → etsi käyttäjä.',
        'Klikkaa "Linkitä jäseneen" ja valitse oikea jäsen pudotusvalikosta.',
        'Linkitetty käyttäjä näkee oman profiilinsa /profiili-sivulla ja voi muokata bio-tietojaan.',
      ]},
    ],
  },
  {
    id: 'content',
    title: 'Sisällönhallinta (tarinat, kuvat, juomat, tapahtumat)',
    icon: Image,
    content: [
      { heading: 'Tarinat (/tarinat)', steps: [
        'Admin voi poistaa minkä tahansa tarinan tai kommentin.',
        'Admin voi poistaa yksittäisiä mediakuvia/videoita tarinoilta.',
        'Käyttäjät voivat muokata ja poistaa vain omia tarinoitaan.',
      ]},
      { heading: 'Kuvagalleria (/kuvat)', steps: [
        'Admin voi luoda kansioita, siirtää kuvia ja poistaa mitä tahansa.',
        'Gallerian karusellikuvat (etusivu) hallitaan erillisellä carousel-kansiolla.',
        'Kuvien maksimiresoluutio skaalataan automaattisesti 1400px leveydelle.',
      ]},
      { heading: 'Juomat (/juomat)', steps: [
        'Vain admin voi lisätä, muokata ja poistaa juomia.',
        'Juomalle voi lisätä kuvan Azure Blob Storageen.',
      ]},
      { heading: 'Tapahtumat (/tapahtumat)', steps: [
        'Kaikki kirjautuneet käyttäjät voivat luoda tapahtumia.',
        'Admin voi muokata ja poistaa minkä tahansa tapahtuman.',
        'RSVP-toiminto: Osallistun / Ehkä / En osallistu — kaikki jäsenet voivat ilmoittautua.',
      ]},
    ],
  },
  {
    id: 'static',
    title: 'Historiikki ja hakemukset',
    icon: GlassWater,
    content: [
      { heading: 'Historiikki (/historia)', steps: [
        'Historiikkisivu on staattinen — sisältö muokataan suoraan HistoryView.vue-tiedostoon koodina.',
        'Lahjoitustaulukko hallitaan samassa tiedostossa.',
      ]},
      { heading: 'Jäsenhakemukset (/hakemus)', steps: [
        'Hakemussivun kautta lähetetyt viestit näkyvät Admin-paneeli → Viestit.',
        'Vastaa viestiin admin-paneelista — vastaus menee käyttäjälle postilaatikkoon (/profiili).',
      ]},
    ],
  },
  {
    id: 'workflow',
    title: 'Uuden adminin perehdytys',
    icon: Calendar,
    content: [
      { text: 'Kun annat admin-oikeudet uudelle henkilölle, käy läpi nämä asiat:' },
      { heading: 'Muistilista perehdytykseen', steps: [
        'Näytä admin-paneelin välilehdet ja niiden toiminnot.',
        'Kerro kutsukoodimenettely — älä jaa koodeja julkisesti.',
        'Opeta jäsenten linkittäminen käyttäjätunnuksiin.',
        'Muistuta: admin-oikeudet ovat henkilökohtaisia, ei jaeta tunnuksia.',
        'Kerro guides-sivu (/guides) ja anna sen PIN-koodi.',
        'PIN on vaihdettavissa admin-paneelista — vaihda aina kun uusi henkilö saa sen tietoonsa.',
      ]},
      { heading: 'Turvallisuusohjeet', steps: [
        'Älä käytä samaa salasanaa muissa palveluissa.',
        'Kirjaudu ulos julkisilta laitteilta.',
        'Jos epäilet tunnusten vuotamista, vaihda salasana heti ja ilmoita pääadminille.',
        'Admin voi poistaa käyttäjän oikeudet välittömästi tarvittaessa.',
      ]},
      { note: 'Tämä sivu on tarkoitettu vain admineille. PIN on vaihdettavissa admin-paneelista.' },
    ],
  },
];
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">

    <!-- PIN gate -->
    <div v-if="!unlocked" class="flex flex-col items-center justify-center py-28 gap-6">
      <div class="w-16 h-16 rounded-2xl bg-dpurple-900/40 border border-dpurple-800/40
                  flex items-center justify-center">
        <Lock class="w-7 h-7 text-dpurple-400" />
      </div>
      <div class="text-center">
        <h1 class="text-2xl font-bold text-white mb-1">Admin-ohjeet</h1>
        <p class="text-gray-500 text-sm">Syötä PIN-koodi jatkaaksesi</p>
      </div>
      <form @submit.prevent="verifyPin" class="flex flex-col items-center gap-3 w-full max-w-xs">
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          placeholder="PIN-koodi"
          autocomplete="off"
          class="w-full px-4 py-3 rounded-2xl text-center text-xl font-mono tracking-widest
                 bg-black/60 border border-gray-800 text-white placeholder-gray-700
                 focus:outline-none focus:border-dpurple-700 transition-colors"
        />
        <p v-if="pinError" class="text-red-400 text-sm">{{ pinError }}</p>
        <button type="submit" :disabled="verifying"
          class="w-full py-2.5 rounded-2xl border-0 font-medium text-sm
                 bg-dpurple-800/60 hover:bg-dpurple-700/60 text-white
                 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <LogIn class="w-4 h-4" />
          {{ verifying ? 'Tarkistetaan...' : 'Avaa ohjeet' }}
        </button>
      </form>
    </div>

    <!-- Guide content -->
    <template v-else>
      <div class="flex items-center gap-3 mb-8">
        <div class="w-10 h-10 rounded-xl bg-dpurple-900/40 border border-dpurple-800/40
                    flex items-center justify-center shrink-0">
          <BookOpen class="w-5 h-5 text-dpurple-400" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-white">Admin-ohjeet</h1>
          <p class="text-gray-500 text-sm mt-0.5">Sisäinen käsikirja — ei julkinen</p>
        </div>

        <!-- Admin: PIN reset link -->
        <a v-if="auth.isAdmin" href="#pin-reset"
          class="ml-auto flex items-center gap-1.5 text-xs text-gray-600
                 hover:text-dpurple-400 transition-colors shrink-0">
          <Key class="w-3.5 h-3.5" />PIN
        </a>
      </div>

      <!-- Sections -->
      <div class="flex flex-col gap-2">
        <div v-for="s in sections" :key="s.id"
          class="border border-gray-800 rounded-2xl overflow-hidden">

          <!-- Section header -->
          <button @click="toggle(s.id)"
            class="w-full flex items-center gap-3 px-5 py-4 text-left
                   hover:bg-gray-900/40 transition-all border-0 bg-transparent">
            <component :is="s.icon" class="w-4 h-4 text-dpurple-400/70 shrink-0" />
            <span class="flex-1 text-sm font-semibold text-gray-200">{{ s.title }}</span>
            <ChevronDown v-if="!open[s.id]" class="w-4 h-4 text-gray-600 shrink-0" />
            <ChevronUp   v-else              class="w-4 h-4 text-gray-500 shrink-0" />
          </button>

          <!-- Section body -->
          <div v-if="open[s.id]" class="border-t border-gray-800/60 px-5 py-4 space-y-4">
            <div v-for="(block, bi) in s.content" :key="bi">
              <p v-if="block.heading" class="text-xs font-semibold text-dpurple-400 uppercase tracking-wider mb-2">
                {{ block.heading }}
              </p>
              <p v-if="block.text" class="text-sm text-gray-300 leading-relaxed">{{ block.text }}</p>
              <ol v-if="block.steps" class="flex flex-col gap-1.5">
                <li v-for="(step, si) in block.steps" :key="si"
                  class="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check class="w-3.5 h-3.5 text-dgreen-500/70 mt-0.5 shrink-0" />
                  {{ step }}
                </li>
              </ol>
              <div v-if="block.note"
                class="flex items-start gap-2 px-3 py-2.5 rounded-xl
                       bg-yellow-950/30 border border-yellow-900/40 text-yellow-400/80 text-xs">
                ⚠ {{ block.note }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PIN reset (admin only) -->
      <div v-if="auth.isAdmin" id="pin-reset" class="mt-8 border border-gray-800 rounded-2xl p-5">
        <p class="text-xs font-semibold text-dpurple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Key class="w-3.5 h-3.5" /> Vaihda guides-PIN
        </p>
        <div class="flex gap-2 items-end flex-wrap">
          <div class="flex-1 min-w-0">
            <label class="block text-xs text-gray-500 mb-1.5">Uusi PIN (4–20 merkkiä)</label>
            <input v-model="newPin" type="text" placeholder="esim. 123456"
              class="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-gray-800
                     text-gray-200 placeholder-gray-700 text-sm font-mono tracking-widest
                     focus:outline-none focus:border-dpurple-700 transition-colors" />
          </div>
          <button @click="saveNewPin" :disabled="pinSaving"
            class="px-4 py-2.5 rounded-xl border-0 text-sm font-medium
                   bg-dpurple-800/60 hover:bg-dpurple-700/60 text-white
                   disabled:opacity-50 transition-all shrink-0">
            {{ pinSaving ? 'Tallennetaan...' : pinSaved ? '✓ Tallennettu' : 'Vaihda PIN' }}
          </button>
        </div>
        <p v-if="pinSaveError" class="text-red-400 text-xs mt-2">{{ pinSaveError }}</p>
        <p class="text-xs text-gray-700 mt-2">Uusi PIN tulee voimaan välittömästi. Kerro uusi PIN kaikille admineille.</p>
      </div>
    </template>
  </div>
</template>

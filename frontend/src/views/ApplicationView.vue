<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'

const router = useRouter()

const form = ref({
  name: '',
  email: '',
  location: '',
  favDrink: '',
  motivation: '',
})

// Track which fields the user has touched (to avoid showing errors before they interact)
const touched = ref<Record<string, boolean>>({})
const showModal = ref(false)
const sent = ref(false)
const sending = ref(false)
const sendError = ref('')
const countdown = ref(10)

// Replace with your Web3Forms Access Key from https://web3forms.com
const WEB3FORMS_KEY = '187f4f74-c05f-4c23-97ee-dca01956a8ba'

// Additional recipient emails (cc). Web3Forms sends to the key owner by default.
// Add more addresses separated by commas if needed.
const CC_EMAILS = ''  // e.g. 'toinen@example.com,kolmas@example.com'

const NICK_RE = /^[a-zA-ZäöåÄÖÅ0-9 _-]{2,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

function validateField(name: string, value: string): string {
  if (name === 'name') {
    if (!value.trim()) return 'Nimi on pakollinen'
    if (value.trim().length < 2) return 'Vähintään 2 merkkiä'
    if (!NICK_RE.test(value.trim())) return 'Vain kirjaimet, numerot, välilyönti, - ja _'
  }
  if (name === 'email') {
    if (!value.trim()) return 'Sähköposti on pakollinen'
    if (!EMAIL_RE.test(value.trim())) return 'Virheellinen sähköpostiosoite'
  }
  if (name === 'location' && !value.trim()) return 'Paikkakunta on pakollinen'
  if (name === 'favDrink' && !value.trim()) return 'Lempijuoma on pakollinen'
  if (name === 'motivation' && !value.trim()) return 'Perustelu on pakollinen'
  return ''
}

const errors = computed(() => ({
  name:       validateField('name',       form.value.name),
  email:      validateField('email',      form.value.email),
  location:   validateField('location',   form.value.location),
  favDrink:   validateField('favDrink',   form.value.favDrink),
  motivation: validateField('motivation', form.value.motivation),
}))

const hasErrors = computed(() => Object.values(errors.value).some(Boolean))

const modalErrors = computed(() =>
  Object.entries(errors.value)
    .filter(([, msg]) => msg)
    .map(([, msg]) => msg)
)

function touch(name: string) {
  touched.value[name] = true
}

function showError(name: string): boolean {
  return !!touched.value[name] && !!errors.value[name as keyof typeof errors.value]
}

async function submit() {
  // Mark all fields as touched so errors show
  for (const key of Object.keys(form.value)) touched.value[key] = true
  if (hasErrors.value) {
    showModal.value = true
    return
  }

  sending.value = true
  sendError.value = ''
  try {
    // Tallenna backendiin — tämä on kriittinen polku
    await api.post('/applications', {
      name: form.value.name,
      email: form.value.email,
      location: form.value.location,
      favDrink: form.value.favDrink,
      motivation: form.value.motivation,
    })

    // Lähetä sähköposti-ilmoitus Web3Formsin kautta — epäonnistuminen ei estä onnistumista
    const payload: Record<string, string> = {
      access_key: WEB3FORMS_KEY,
      subject: `Kanniaalio+ hakemus: ${form.value.name}`,
      name: form.value.name,
      email: form.value.email,
      location: form.value.location,
      favDrink: form.value.favDrink,
      motivation: form.value.motivation,
    }
    if (CC_EMAILS) payload.cc = CC_EMAILS
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null) // fire-and-forget, ei blokkaa

    sent.value = true
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        router.push('/')
      }
    }, 1000)
  } catch (err: unknown) {
    sendError.value = err instanceof Error ? err.message : 'Lähetys epäonnistui, yritä uudelleen.'
  } finally {
    sending.value = false
  }
}

const fieldDefs = [
  { name: 'name',       label: 'Mudname tai nick',      type: 'text',     placeholder: 'Käyttäjänimi' },
  { name: 'email',      label: 'Sähköposti',             type: 'email',    placeholder: 'sahkoposti@example.com' },
  { name: 'location',   label: 'Paikkakunta',            type: 'text',     placeholder: 'Kaupunki' },
  { name: 'favDrink',   label: 'Lempijuoma',             type: 'text',     placeholder: 'Mitä juot?' },
  { name: 'motivation', label: 'Miksi haluat liittyä?',  type: 'textarea', placeholder: 'Kerro itsestäsi...' },
] as const
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-6">Hakemus</h1>

    <!-- Intro text cards -->
    <div class="space-y-3 mb-8">
      <div class="rounded-xl border border-dpurple-800/60 bg-dpurple-950/40 px-5 py-4 text-gray-300 leading-relaxed shadow-sm">
        Täytä hakemus liittyäksesi legendaariseen <span class="text-dpurple-400 font-semibold">Kanniaalio+</span>:aan.
        Olemme vuodesta 2003 toiminut epävirallinen yhteisö, jossa yhdistyvät BatMUD-pelaajat ja rento hauskanpito.
      </div>
      <div class="rounded-xl border border-dpurple-800/60 bg-dpurple-950/40 px-5 py-4 text-gray-400 text-sm leading-relaxed shadow-sm">
        Kaikki kentät ovat pakollisia. Kännimestarit käsittelevät hakemuksen ja ottavat yhteyttä.
      </div>
    </div>

    <!-- Success -->
    <div v-if="sent" class="rounded-xl border border-green-700/60 bg-green-900/20 p-8 text-center shadow-sm space-y-4">
      <p class="text-green-300 font-semibold text-lg">Hakemus lähetetty! 🎉</p>
      <p class="text-gray-400 text-sm">Kännimestarit ottavat yhteyttä.</p>
      <div class="flex flex-col items-center gap-2 pt-2">
        <div
          class="w-16 h-16 rounded-full border-4 border-dpurple-600 flex items-center justify-center text-2xl font-bold text-dpurple-400"
          style="box-shadow: 0 0 18px rgba(124,58,237,0.35)"
        >
          {{ countdown }}
        </div>
        <p class="text-gray-500 text-xs">Sinut ohjataan etusivulle {{ countdown }} sekunnin kuluttua.</p>
        <button
          @click="router.push('/')"
          class="mt-1 px-4 py-1.5 rounded-lg bg-dpurple-800 hover:bg-dpurple-600 text-white text-sm transition-colors"
        >
          Siirry nyt →
        </button>
      </div>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submit" novalidate class="space-y-5">
      <div v-for="field in fieldDefs" :key="field.name">
        <label class="flex items-center gap-1 text-sm text-gray-400 mb-1">
          {{ field.label }}
          <span
            class="text-red-400 text-xs font-bold transition-opacity duration-200"
            :class="showError(field.name) || (!touched[field.name] && !form[field.name]) ? 'opacity-100' : 'opacity-0'"
          >★</span>
        </label>

        <textarea
          v-if="field.type === 'textarea'"
          v-model="form[field.name]"
          :placeholder="field.placeholder"
          rows="4"
          @blur="touch(field.name)"
          class="w-full px-4 py-2 rounded-lg bg-gray-800 border text-gray-100 placeholder-gray-500 focus:outline-none resize-none transition-colors"
          :class="showError(field.name)
            ? 'border-red-500/70 focus:border-red-400'
            : 'border-gray-700 focus:border-dpurple-600'"
        />
        <input
          v-else
          v-model="form[field.name]"
          :type="field.type"
          :placeholder="field.placeholder"
          @blur="touch(field.name)"
          class="w-full px-4 py-2 rounded-lg bg-gray-800 border text-gray-100 placeholder-gray-500 focus:outline-none transition-colors"
          :class="showError(field.name)
            ? 'border-red-500/70 focus:border-red-400'
            : 'border-gray-700 focus:border-dpurple-600'"
        />

        <p v-if="showError(field.name)" class="text-red-400 text-xs mt-1">
          {{ errors[field.name] }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="sending"
        class="w-full py-2.5 bg-dpurple-600 hover:bg-dpurple-400 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="sending">Lähetetään...</span>
        <span v-else>Lähetä hakemus</span>
      </button>

      <p v-if="sendError" class="text-red-400 text-sm text-center">{{ sendError }}</p>
    </form>

    <!-- Validation modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          style="background:rgba(0,0,0,0.7)"
          @click.self="showModal = false"
        >
          <div class="rounded-2xl border border-dpurple-700/60 bg-dpurple-950 shadow-2xl max-w-sm w-full p-6">
            <h3 class="text-lg font-bold text-red-400 mb-3">Täytä puuttuvat kentät</h3>
            <ul class="space-y-1.5 mb-5">
              <li
                v-for="(msg, i) in modalErrors"
                :key="i"
                class="flex items-start gap-2 text-sm text-gray-300"
              >
                <span class="text-red-400 mt-0.5">●</span>
                {{ msg }}
              </li>
            </ul>
            <button
              @click="showModal = false"
              class="w-full py-2 rounded-lg bg-dpurple-800 hover:bg-dpurple-600 text-white font-semibold transition-colors"
            >
              Selvä, korjaan
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

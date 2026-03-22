<script setup lang="ts">
interface Donation {
  name: string
  amount: number
  message: string
}

const donations: Donation[] = [
  { name: 'Facekiller',   amount: 16,       message: 'tuoppi boothillissä!' },
  { name: 'Sriel',        amount: 1,        message: 'Vinnaa viinaa tzatza tzaa!!' },
  { name: 'Calath',       amount: 50000,    message: 'minakin olen!' },
  { name: 'Demo',         amount: 11605,    message: 'mäkin haluun känniääliöks' },
  { name: 'Demo',         amount: 11605,    message: 'mäkin haluun känniääliöks' },
  { name: 'Fimir',        amount: 15000,    message: 'Makin haluun KaNniaaLiOkS!!' },
  { name: 'Juggelo',      amount: 10000,    message: 'känniääliö+!' },
  { name: 'Elero',        amount: 30000,    message: 'känniääliö+!' },
  { name: 'Enochian',     amount: 40000,    message: 'känniääliö+' },
  { name: 'Wan',          amount: 5000,     message: 'perkele' },
  { name: 'Sriel',        amount: 500,      message: 'kakka kurkkaa kulman takaa' },
  { name: 'Sriel',        amount: 500,      message: 'hivelen jölliäni.' },
  { name: 'Sriel',        amount: 500,      message: 'ihihihi' },
  { name: 'Wan',          amount: 21000,    message: 'perkele' },
  { name: 'Kiro',         amount: 20000,    message: 'kanniaalio+' },
  { name: 'Juggelo',      amount: 10000,    message: 'lisämaksu' },
  { name: 'Greatorian',   amount: 30000,    message: 'ikinä en oo mitään juonu mutta paremmaksi pitää pistää:)' },
  { name: 'Juggelo',      amount: 20000,    message: 'ja grenuhan ei mua voita' },
  { name: 'Chizra',       amount: 20000,    message: 't0t4l 0wn4g3 by 7h3 w0r57 455h0l3z!!' },
  { name: 'Eraser',       amount: 60000,    message: 'repikaa siita suomi channulla!' },
  { name: 'Juggelo',      amount: 30000,    message: 'ja eraseri vois haistaa vitun' },
  { name: 'Kawasa',       amount: 65000,    message: 'rahaaa on :p' },
  { name: 'Greatorian',   amount: 10000,    message: 'tuleeks siihen channuki?' },
  { name: 'Gideon',       amount: 1,        message: 'voitko lopettaa sen spammaamisen ;)' },
  { name: 'Sunshine',     amount: 100000,   message: 'repikaa siita' },
  { name: 'Kawasa',       amount: 5001,     message: 'enoo enää !' },
  { name: 'Chaoslord',    amount: 10000,    message: 'juggelo haisee kaninpaskalle' },
  { name: 'Juggelo',      amount: 40000,    message: 'ja sunillehhan ei hävitty viel' },
  { name: 'Sriel',        amount: 250001,   message: 'kakka leimaa kellokortin ja juo navipuu rahat' },
  { name: 'Lemure',       amount: 6666,     message: 'vittu että on tyhmää touhua' },
  { name: 'Farliss',      amount: 123,      message: 'taalta loyty miljonaari!' },
  { name: 'Elero',        amount: 20000,    message: 'viinaa viinaa tsa tsa tsaaaaaaaaaaaaaaaaa' },
  { name: 'Drizzin',      amount: 30000,    message: 'tili tuli tili meni :(' },
  { name: 'Elero',        amount: 10000,    message: 'missÄÄ grilliiiiiiiii?' },
  { name: 'Gideon',       amount: 666,      message: '666 is the number of the beast (and my phone number)' },
  { name: 'Kiro',         amount: 30000,    message: 'helvetti.' },
  { name: 'Wan',          amount: 55000,    message: 'orror' },
  { name: 'Cola',         amount: 200000,   message: 'spede on päivän sana' },
  { name: 'Demo',         amount: 69,       message: 'eik sulta ilman rahaa enää vastauksiakaa?' },
  { name: 'Facekiller',   amount: 10101,    message: 'ykksii ja nollii' },
  { name: 'Nixon',        amount: 10,       message: 'kiire... sori unohtu 5 nolla perasta.' },
  { name: 'Kawasa',       amount: 150000,   message: 'vitun spede lähemeneee' },
  { name: 'Sriel',        amount: 250002,   message: 'ryomivä yrj, kurkkiva kakka' },
  { name: 'Bumba',        amount: 1,        message: 'et sitten laittanu minun messagea' },
  { name: 'Habbar',       amount: 69690,    message: 'pilluahan tuo tekis mieli vaikka vähän pienempääkin' },
  { name: 'Mardraum',     amount: 666,      message: 'hewi ihmisii etelä suomest?? --dimmu_88' },
  { name: 'Pahvi',        amount: 10000,    message: '' },
  { name: 'Beyond',       amount: 10000,    message: '' },
  { name: 'Blackhand',    amount: 20000,    message: '' },
  { name: 'Sarnath',      amount: 100,      message: '' },
  { name: 'Greatorian',   amount: 5000,     message: 'onks täällä söpöjä teinejä lääh?' },
  { name: 'Facekiller',   amount: 6969,     message: 'chättiseuraa1!' },
  { name: 'Greatorian',   amount: 2000,     message: 'vittu mä teistä kiinnostunu mä haluun vaan viinaa jos annat mulle sorbuksen mä en enää sua lyö mä oon' },
  { name: 'Beyond',       amount: 10000,    message: '' },
  { name: 'Dagel',        amount: 50000,    message: 'tänään eroon rahoista!' },
  { name: 'Facekiller',   amount: 25000,    message: 'stattei' },
  { name: 'Snort',        amount: 30000,    message: 'prkl se channu pystyy, et loppuu tää spämi' },
  { name: 'Kiro',         amount: 40000,    message: 'tom collinsia koko rahalla.' },
  { name: 'Painkiller',   amount: 50000,    message: 'viive? halit valvojalle. sano mun nimi.' },
  { name: 'Blashyrkh',    amount: 2000,     message: 'sepix+' },
  { name: 'Greatorian',   amount: 50000,    message: 'paljos on jo koossa?' },
  { name: 'Zeme',         amount: 10000,    message: 'kympin ilta' },
  { name: 'Acidia',       amount: 0.01,     message: 'pääseeks tällä ees keravan anttilaan :(' },
  { name: 'Bloodhunter',  amount: 10000,    message: '10 ilta missä?' },
  { name: 'Sriel',        amount: 200000,   message: 'pippeli' },
  { name: 'Bluegirl',     amount: 100,      message: 'tuleeko talla pippelia?' },
  { name: 'Juggelo',      amount: 10000,    message: 'hyvin tää huijjaus että sä saisit lisää rahaa toimii, tarttenu ku pikku alotus summa tehä sulle ja heti kaikki idiootit alkaa syytää rahaa sulle' },
  { name: 'Farliss',      amount: 321,      message: 'munki mielesta mie oon ihana, kivaku saki tykkasit musta' },
  { name: 'Graxrah',      amount: 59,       message: 'uaaaaaaaaah!' },
  { name: 'Graxrah',      amount: 10000,    message: 'lisämaksu, koska häpi auer!' },
  { name: 'Anrak',        amount: 1000,     message: 'ei paljoa, mutta menee hyvän asian eteen joten täytyy edes osallistua... terkkuja...' },
  { name: 'Elero',        amount: 1234,     message: 'missä jatkot? (tm)' },
  { name: 'Graxrah',      amount: 800,      message: 'sit tekeen lisaa rahaa!' },
  { name: 'Sunshine',     amount: 1,        message: 'terkkuja aidille' },
  { name: 'Greatorian',   amount: 2000,     message: 'demonizerin puolesta' },
  { name: 'Mackakkonen',  amount: 2222.22,  message: 'go caitline go!' },
  { name: 'Elero',        amount: 1,        message: 'Äiskä lähetä rahaaa!!' },
  { name: 'Sriel',        amount: 1,        message: 'seuraa 11-13v tytoista isokulliselle 12v pojalle pieksamaelta?' },
  { name: 'Hablo',        amount: 0,        message: 'jatkot on rusty shieldissä' },
  { name: 'Durand',       amount: -1000,    message: 'verot' },
  { name: 'Drizzin',      amount: 2000,     message: 'veronpalautus!' },
  { name: 'Copkiller',    amount: 10,       message: 'myykaa mulle 2x axe/lblade!!!!!' },
  { name: 'Gideon',       amount: 1,        message: 'durand on ilkeä' },
  { name: 'Durand',       amount: -4000,    message: 'lisäverot' },
  { name: 'Pehtoori',     amount: 1500,     message: 'riittääx?!?!1' },
  { name: 'Blashyrkh',    amount: 1000,     message: 'veronpalautus returns!' },
  { name: 'Hampuusi',     amount: 20000,    message: 'kuka on kingi?' },
  { name: 'Mardraum',     amount: 6969,     message: '13-16-wee tyzkyi hesast??' },
  { name: 'Nepnep',       amount: 2000,     message: 'vihthulu kupee tpaa hjalnja noudee psshhan.... myva meinjinki' },
  { name: 'Copkiller',    amount: 10,       message: 'paljonko on kasassa? halei valvojille!' },
  { name: 'Greatorian',   amount: 10000,    message: 'koska rahaa on' },
  { name: 'Nixon',        amount: 100,      message: 'antakaa mulle rahaa jotta voitan tan lahjoittamiskilpailun!' },
  { name: 'Ymmi',         amount: 1000,     message: '' },
  { name: 'Nepnep',       amount: 100,      message: 'taa oli kilpailu? montaks sharee mul jo on ku ei tuu mitaan infoo ku donaa??? nim:nyypa' },
  { name: 'Ymmi',         amount: 2000,     message: '' },
  { name: 'Nepnep',       amount: 100,      message: 'nepnep "logo sydan" caitline' },
  { name: 'Graxrah',      amount: 2000,     message: 'viikkorahat!' },
  { name: 'Blackhand',    amount: 20000,    message: 'kanniaalio+!' },
  { name: 'Dunlop',       amount: 10000,    message: 'aa-kerho' },
  { name: 'Demo',         amount: 10000,    message: 'uni transsut' },
  { name: 'Anrak',        amount: 10000,    message: 'kaikki donaan, että saadaan känniäälit pois spammaamasta suomi-channua... siis muutkin, kuin mää...' },
  { name: 'Cyberlahko',   amount: 20000,    message: 'no vittu jos chaoslordi ni kyl mäki' },
  { name: 'Lim',          amount: 30000,    message: 'parempihan tää kuitenki on ku joku hikinen spr keräys' },
  { name: 'Shadizar',     amount: 47800,    message: '' },
  { name: 'Walor',        amount: 1000,     message: 'kaikki transsit logataan ja transsijat tapetaan =)' },
  { name: 'Walor',        amount: 1000,     message: 'ja muuten mafia verottaa puolet tulleist rahoist... nih!' },
  { name: 'Baal',         amount: 666,      message: 'no mutta kuitenkin,yksi opiskelija helvettiin kiitos.' },
  { name: 'Arachon',      amount: 50000,    message: '' },
  { name: 'Harza',        amount: 100000,   message: 'eihan tama paljo oo mut jos silla paasis alkuun' },
  { name: 'Beyond',       amount: 20000,    message: 'siina on jo .5%' },
  { name: 'Farliss',      amount: 123,      message: 'hupsistupsisvittupimpelipompeli' },
  { name: 'Acidia',       amount: 666,      message: 'from acidia of 666.00 gold: from acidia of 666.00 gold: from acidia of 666.00 gold: from tuska inc!' },
  { name: 'Sunshine',     amount: 50000,    message: 'no siina o' },
  { name: 'Hardagon',     amount: 20000,    message: 'ja hop' },
  { name: 'Dagel',        amount: 20000,    message: 'näin.' },
  { name: 'Dagel',        amount: 50000,    message: '100k' },
  { name: 'Wan',          amount: 45000,    message: '' },
  { name: 'Juggelo',      amount: 55000,    message: '*mystic*' },
  { name: 'Lim',          amount: 50000,    message: '' },
  { name: 'Harza',        amount: 100000,   message: 'noppeesti kanava' },
  { name: 'Juggelo',      amount: 50000,    message: 'niijjoo nimellislahjoitus viel' },
  { name: 'Pehtoori',     amount: 35000,    message: 'elämä risaseks' },
  { name: 'Calath',       amount: 50000,    message: 'kyllhan se pitaa kanava saada. oon muuten humalassa =)' },
  { name: 'Heze',         amount: 40000,    message: '' },
  { name: 'Kiro',         amount: 20000,    message: "'tana. mua tiputeta pois sielta." },
  { name: 'Calath',       amount: 55000,    message: 'tuhkatkin pesasta prkl!' },
  { name: 'Kiro',         amount: 20000,    message: 'taytyy se nyt vaan saada :p' },
  { name: 'Nalle',        amount: 30000,    message: 'channu' },
  { name: 'Chizra',       amount: 666,      message: 'you got owned!!' },
  { name: 'Henri',        amount: 15000,    message: 'kanniaalio!' },
  { name: 'Lim',          amount: 25000,    message: '' },
  { name: 'Igor',         amount: 90000,    message: 'kanniaalio sossusta :d' },
  { name: 'Kalarobotti',  amount: 1500000,  message: '' },
  { name: '(kolikkoina)', amount: 100000,   message: '+100k kolikkoina' },
  { name: 'Ikira',        amount: 75000,    message: '' },
  { name: 'Balthas',      amount: 300000,   message: 'rahaa näköjään on ni kyl tähä voi sijottaa' },
  { name: 'Coran',        amount: 300000,   message: 'annas ne kanniaalioinvitet' },
  { name: 'Coran',        amount: 50000,    message: 'plussaa!' },
  { name: 'Pahvi',        amount: 70000,    message: 'rarara' },
  { name: 'Facekiller',   amount: 30000,    message: 'zorru känniäälioks' },
  { name: 'Kiro',         amount: 40000,    message: 'wheeeh' },
  { name: 'Azatoth',      amount: 10000,    message: 'ma oon aito puliaalio' },
]

import { ref, computed } from 'vue'

type SortKey = 'original' | 'name' | 'amount'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey>('original')
const sortDir = ref<SortDir>('asc')

function sortBy(key: 'name' | 'amount') {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'amount' ? 'desc' : 'asc'
  }
}

function sortIcon(key: 'name' | 'amount'): string {
  if (sortKey.value !== key) return ' ⇅'
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

const indexedDonations = donations.map((d, i) => ({ ...d, _orig: i }))

const sortedDonations = computed(() => {
  const arr = [...indexedDonations]
  if (sortKey.value === 'original') return arr
  arr.sort((a, b) => {
    if (sortKey.value === 'name') {
      return sortDir.value === 'asc'
        ? a.name.localeCompare(b.name, 'fi')
        : b.name.localeCompare(a.name, 'fi')
    }
    return sortDir.value === 'asc' ? a.amount - b.amount : b.amount - a.amount
  })
  return arr
})

const total = donations.reduce((sum, d) => sum + d.amount, 0)

// Per-player totals for top-donor badges
const donorTotals = computed(() => {
  const map = new Map<string, number>()
  for (const d of donations) {
    map.set(d.name, (map.get(d.name) ?? 0) + d.amount)
  }
  return map
})

const topFiveNames = computed(() =>
  [...donorTotals.value.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)
)

function donorBadge(name: string): string {
  const rank = topFiveNames.value.indexOf(name)
  if (rank === 0) return '👑'
  if (rank === 1) return '🥈'
  if (rank === 2) return '🥉'
  if (rank >= 3) return '⭐'
  return ''
}

function formatAmount(n: number): string {
  return n.toLocaleString('fi-FI', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-8">Historiikki</h1>
    <div class="space-y-4 mb-12">
      <div class="rounded-xl border border-dpurple-800/60 bg-dpurple-950/40 px-5 py-4 text-gray-300 leading-relaxed shadow-sm">
        Kanniaalio+ on vuonna 2003 perustettu epävirallinen yhteisö, jonka jäsenet yhdistivät aikanaan
        BatMUD-pelin pelaajat.
      </div>
      <div class="rounded-xl border border-dpurple-800/60 bg-dpurple-950/40 px-5 py-4 text-gray-300 leading-relaxed shadow-sm">
        Sivusto perustettiin alun perin Tripodiin, ja sen sisältö kertoo 2000-luvun alun internet-kulttuurista BatMudissa.
        Tämä on päivitetty versio alkuperäisestä sivustosta. Koko sisältö on säilytetty, mutta se on uudelleenformatoitu ja päivitetty nykyaikaiseksi.
        Uuden sivuston tarkoituksena on säilyttää ja kunnioittaa alkuperäistä sisältöä, mutta samalla tehdä siitä helpommin luettavaa ja navigoitavaa nykyaikaisille käyttäjille.
        Uudelle sivustolle on lisätty myös uusia ominaisuuksia, kuten lahjoitusten lajittelu ja yhteenveto, mutta kaikki alkuperäiset viestit ja lahjoitukset on säilytetty ennallaan.
      </div>
    </div>

    <section class="mt-12">
      <div class="rounded-xl border border-dpurple-700/50 bg-dpurple-950/40 px-5 py-4 mb-5 shadow-sm">
        <h2 class="text-2xl font-bold text-purple-300 mb-1">Perustamiskeräys 2003</h2>
        <p class="text-gray-500 text-sm">
          BatMUD:n kanniaalio+ kanavan ostoa ja killan perustamista varten kerätyt lahjoitukset.
          Yhteensä {{ donations.length }} transaktiota.
        </p>
      </div>

      <!-- Mobiili: korttilistaus -->
      <div class="sm:hidden overflow-y-auto max-h-[70vh] rounded-xl border border-dpurple-800/50 shadow-lg">
        <!-- Lajittelunapit mobiilissa -->
        <div class="flex gap-2 px-3 py-2 bg-dpurple-900 border-b border-dpurple-800/60">
          <button @click="sortBy('name')"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border-0 bg-transparent
                   text-dpurple-400 hover:text-dpurple-300 transition-colors">
            Pelaaja<span class="opacity-50">{{ sortIcon('name') }}</span>
          </button>
          <button @click="sortBy('amount')"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border-0 bg-transparent
                   text-dpurple-400 hover:text-dpurple-300 transition-colors">
            Kulta<span class="opacity-50">{{ sortIcon('amount') }}</span>
          </button>
        </div>
        <div
          v-for="(d, i) in sortedDonations"
          :key="d._orig"
          class="flex gap-3 px-3 py-2.5 border-t border-dpurple-900/40"
          :class="i % 2 === 0 ? 'bg-dpurple-950/50' : ''"
        >
          <!-- Järjestysnumero-pallukka -->
          <div class="shrink-0 w-7 h-7 rounded-full bg-dpurple-900/80 border border-dpurple-800/60
                      flex items-center justify-center text-[10px] font-bold text-gray-500 tabular-nums mt-0.5">
            {{ i + 1 }}
          </div>
          <!-- Tiedot -->
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm leading-snug" :class="donorBadge(d.name) ? 'text-amber-200' : 'text-dpurple-400'">
              <span v-if="donorBadge(d.name)" class="mr-1"
                :title="`Yhteensä ${formatAmount(donorTotals.get(d.name) ?? 0)} kultaa`"
              >{{ donorBadge(d.name) }}</span>{{ d.name }}
            </div>
            <div v-if="d.message" class="text-gray-400 text-xs mt-0.5 leading-snug">{{ d.message }}</div>
            <div class="text-xs font-mono mt-1" :class="d.amount < 0 ? 'text-red-400' : 'text-amber-300'">
              {{ formatAmount(d.amount) }} kultaa
            </div>
          </div>
        </div>
        <!-- Yhteensä -->
        <div class="flex gap-3 px-3 py-2.5 bg-dpurple-900 border-t-2 border-dpurple-700/60 sticky bottom-0">
          <div class="shrink-0 w-7" />
          <div class="flex-1 flex items-center justify-between">
            <span class="text-sm font-bold text-dpurple-400">Yhteensä</span>
            <span class="text-sm font-bold font-mono text-amber-300">{{ formatAmount(total) }}</span>
          </div>
        </div>
      </div>

      <!-- Desktop: taulukko -->
      <div class="hidden sm:block overflow-y-auto max-h-[70vh] rounded-xl border border-dpurple-800/50 shadow-lg">
        <table class="w-full text-sm border-collapse">
          <thead class="sticky top-0 z-10">
            <tr class="bg-dpurple-900 text-dpurple-400 text-left">
              <th class="px-2 py-2.5 font-semibold border-b border-dpurple-800/60 text-right w-8 tabular-nums">#</th>
              <th
                class="px-3 py-2.5 font-semibold border-b border-dpurple-800/60 cursor-pointer select-none hover:text-dpurple-300"
                @click="sortBy('name')"
              >Pelaaja<span class="text-xs opacity-50">{{ sortIcon('name') }}</span></th>
              <th
                class="px-3 py-2.5 font-semibold border-b border-dpurple-800/60 text-right cursor-pointer select-none hover:text-dpurple-300 whitespace-nowrap"
                @click="sortBy('amount')"
              >Kulta<span class="text-xs opacity-50">{{ sortIcon('amount') }}</span></th>
              <th class="px-3 py-2.5 font-semibold border-b border-dpurple-800/60">Viesti</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(d, i) in sortedDonations"
              :key="d._orig"
              class="border-t border-dpurple-900/40 transition-colors hover:bg-dpurple-900/25"
              :class="i % 2 === 0 ? 'bg-dpurple-950/50' : ''"
            >
              <td class="px-2 py-1.5 text-gray-500 text-xs tabular-nums text-right align-top">{{ i + 1 }}</td>
              <td class="px-3 py-1.5 align-top">
                <div class="font-medium" :class="donorBadge(d.name) ? 'text-amber-200' : 'text-dpurple-400'">
                  <span
                    v-if="donorBadge(d.name)"
                    class="mr-1"
                    :title="`Yhteensä ${formatAmount(donorTotals.get(d.name) ?? 0)} kultaa`"
                  >{{ donorBadge(d.name) }}</span>{{ d.name }}
                </div>
              </td>
              <td
                class="px-3 py-1.5 text-right font-mono whitespace-nowrap align-top"
                :class="d.amount < 0 ? 'text-red-400' : 'text-amber-300'"
              >
                {{ formatAmount(d.amount) }}
              </td>
              <td class="px-3 py-1.5 text-gray-400 text-xs leading-relaxed align-top">{{ d.message }}</td>
            </tr>
          </tbody>
          <tfoot class="sticky bottom-0 z-10">
            <tr class="bg-dpurple-900 border-t-2 border-dpurple-700/60">
              <td class="px-2 py-2.5"></td>
              <td class="px-3 py-2.5 font-bold text-dpurple-400">Yhteensä</td>
              <td class="px-3 py-2.5 text-right font-bold font-mono text-amber-300 whitespace-nowrap">
                {{ formatAmount(total) }}
              </td>
              <td class="px-3 py-2.5 text-gray-400 text-xs">kultaa</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  </div>
</template>

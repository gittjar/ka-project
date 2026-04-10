<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-12">

    <!-- Otsikko -->
    <div class="mb-10">
      <h1 class="text-3xl font-extrabold text-white mb-2">Rekisteriseloste</h1>
      <p class="text-gray-500 text-sm">Kanniaalio+ · Päivitetty {{ year }}</p>
      <div class="mt-4 h-px bg-gradient-to-r from-dpurple-700/60 via-dgreen-700/40 to-transparent" />
    </div>

    <!-- Kohdat -->
    <div class="flex flex-col gap-7">

      <!-- 1 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">1</span>
        <div>
          <h2 class="text-white font-bold mb-1">Rekisterinpitäjä</h2>
          <p class="text-gray-400 text-sm leading-relaxed">
            Kanniaalio+ on BatMUD-peliin liittyvä yksityinen jäsenyhteisö.
            Rekisterinpitäjä on sivuston ylläpito. Yhteystietoihin pääset
            <a href="/hakemus" class="text-dgreen-400 hover:text-dgreen-300 underline underline-offset-2">yhteydenottolomakkeen</a>
            kautta — emme julkaise henkilökohtaisia osoitteita tai puhelinnumeroita verkossa.
          </p>
        </div>
      </div>

      <!-- 2 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">2</span>
        <div>
          <h2 class="text-white font-bold mb-1">Mitä tietoja kerätään</h2>
          <ul class="text-gray-400 text-sm leading-relaxed space-y-1 list-none">
            <li class="flex items-start gap-2"><span class="text-dgreen-600 mt-1">▸</span>Rekisteröitymislomakkeella annetut tiedot: käyttäjänimi ja salattu salasana</li>
            <li class="flex items-start gap-2"><span class="text-dgreen-600 mt-1">▸</span>Jäsenprofiiliin vapaaehtoisesti lisätyt tiedot: syntymävuosi (Batmudissa), pelipaikkakunta, lempijuoma, kotisivu, sähköpostiosoite (defaulttina mallia pelaajanimi@batmud.bat.org)</li>
            <li class="flex items-start gap-2"><span class="text-dgreen-600 mt-1">▸</span>Hakemuksella lähetetyt tiedot: nimi, sähköposti, paikkakunta, motivaatioteksti</li>
            <li class="flex items-start gap-2"><span class="text-dgreen-600 mt-1">▸</span>Sisällöt jotka käyttäjä itse lataa: tarinat, kuvat, videot</li>
          </ul>
        </div>
      </div>

      <!-- 3 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">3</span>
        <div>
          <h2 class="text-white font-bold mb-1">Evästeet</h2>
          <p class="text-gray-400 text-sm leading-relaxed">
            Sivusto <span class="text-white font-medium">ei käytä evästeitä</span> (cookies).
            Kirjautuminen perustuu JWT-tokeniin, joka tallennetaan selaimen
            <span class="font-mono text-xs text-gray-300">localStorage</span>-muistiin eikä välity kolmansille osapuolille.
            Mitään seurantatietoja ei kerätä, adminit näkevät kirjautumiset vain hallintapaneelissa.
          </p>
        </div>
      </div>

      <!-- 4 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">4</span>
        <div>
          <h2 class="text-white font-bold mb-1">Missä data sijaitsee</h2>
          <div class="text-gray-400 text-sm leading-relaxed space-y-2">
            <div class="flex items-start gap-2">
              <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-dpurple-900/60 border border-dpurple-700/40 text-dpurple-300 mt-0.5">DB</span>
              <span><span class="text-white font-medium">MongoDB Atlas</span> — käyttäjätunnukset, jäsentiedot, tarinat, hakemukset ja muut tietokantatiedot tallennetaan MongoDB Atlasin pilvitietokantaan. Klusterin sijainti on Euroopassa (Frankfurt, EU-West) käytännössä tietojesi lähetessä EU:n tietosuoja-asetuksen piirissä.</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 border border-blue-700/40 text-blue-300 mt-0.5">IMG</span>
              <span><span class="text-white font-medium">Azure Blob Storage</span> — kuvat ja videot tallennetaan Microsoftin Azure-pilveen. Palvelun alue on valittu Euroopan sisäisesti (North Europe / West Europe).</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-900/60 border border-orange-700/40 text-orange-300 mt-0.5">API</span>
              <span><span class="text-white font-medium">Render.com</span> — backend-palvelin pyörii Renderin infrastruktuurissa (Frankfurt) ja käsittelee pyyntöjä, mutta <em>ei tallenna</em> tietoja pysyvästi.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 5 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">5</span>
        <div>
          <h2 class="text-white font-bold mb-1">Tietoturva</h2>
          <p class="text-gray-400 text-sm leading-relaxed">
            Käyttäjien salasanat tallennetaan ainoastaan bcrypt-hajautettuna — pelkää salasanaa ei missään
            vaiheessa tallenneta eikä ylläpidolla ole pääsyä siihen.
            Kaikki liikenne kulkee HTTPS-salatun yhteyden yli.
            Gallerian kuvat vaativat aina kirjautumisen — linkit kuviin ovat julkisia Azure Blob tiedostoja, mutta niiden nimeäminen on satunnaista eikä paljasta kokonaisen kansion sisältöä, vaikka joku saisi yhden kuvalinkin haltuunsa.
            Ylläpidolla on erilliset admin-oikeudet, joilla pääsee käsiksi vain palvelun hallintaan.
            Palvelun taustajärjestelmät (Render, Azure, MongoDB Atlas) on suojattu
            kaksivaiheisella tunnistautumisella (2FA) ylläpidon tasolla — tämä ei koske
            käyttäjien omaa kirjautumista Kanniaalio+-palveluun.
          </p>
        </div>
      </div>

      <!-- 6 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">6</span>
        <div>
          <h2 class="text-white font-bold mb-1">Palvelun saatavuus ja tietokatkokset</h2>
          <p class="text-gray-400 text-sm leading-relaxed">
            Kanniaalio+ on harrastuspohjainen yhteisöpalvelu ilman virallista SLA-sitoumusta. Palvelu on ilmainen jäsenille.
            Palvelu pyörii kolmansien osapuolten infrastruktuurilla (Render, MongoDB Atlas, Azure), ja
            lyhyet käyttökatkot ovat mahdollisia huolto- tai päivitysikkunoiden aikana.
            Tietoja ei pääsääntöisesti poisteta katkosten aikana — datan säilyvyys
            nojautuu käytettyjen palveluntarjoajien omiin varmuuskopiointikäytäntöihin.
          </p>
        </div>
      </div>

      <!-- 7 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">7</span>
        <div>
          <h2 class="text-white font-bold mb-1">Tietojen käyttötarkoitus</h2>
          <p class="text-gray-400 text-sm leading-relaxed">
            Kerättyjä tietoja käytetään <em>ainoastaan</em> Kanniaalio+-palvelun tarjoamiseen jäsenille.
            Tietoja ei myydä, luovuteta eikä käytetä markkinointiin tai mainontaan.
            Profiilitietoja näytetään muille kirjautuneille jäsenille jäsenluettelossa —
            vain tiedot jotka olet itse lisännyt näkyvät muille.
          </p>
        </div>
      </div>

      <!-- 8 -->
      <div class="flex gap-4 items-start">
        <span class="shrink-0 w-7 h-7 rounded-full bg-dgreen-600 flex items-center justify-center
                     text-black text-xs font-black mt-0.5">8</span>
        <div>
          <h2 class="text-white font-bold mb-1">Oikeutesi</h2>
          <p class="text-gray-400 text-sm leading-relaxed">
            Voit muokata profiilitietojasi itse omalla profiilisivullasi.
            Tilin poistoa tai muita pyyntöjä varten ota yhteyttä ylläpitoon
            <a href="/hakemus" class="text-dgreen-400 hover:text-dgreen-300 underline underline-offset-2">yhteydenottolomakkeen</a>
            kautta.
          </p>
        </div>
      </div>

    </div>

    <!-- Alaosa -->
    <div class="mt-12 pt-6 border-t border-gray-800/60 text-xs text-gray-700 text-center space-y-3">
      <p>Kanniaalio+ · BatMUD-kilta vuodesta 2003 · Tämä seloste on laadittu hyvän tavan mukaisesti harrastusyhteisölle.
      Kuvien ja tarinoiden tekijänoikeudet säilyvät tekijöillä, ja niitä ei käytetä muuhun kuin palvelun tarjoamiseen.</p>
      <div>
        <a href="https://github.com/gittjar/ka-project" target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                 border border-gray-800 hover:border-gray-700
                 bg-gray-900/60 hover:bg-gray-800/60
                 text-gray-400 hover:text-white
                 transition-all text-xs font-medium">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
                     0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466
                     -.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832
                     .092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951
                     0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65
                     0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337
                     c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651
                     .64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943
                     .359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747
                     0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          gittjar/ka-project
        </a>
      </div>
    </div>

  </div>
</template>

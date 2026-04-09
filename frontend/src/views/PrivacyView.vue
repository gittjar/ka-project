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
            Rekisterinpitäjä on killan ylläpito. Yhteystietoihin pääset
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
            <li class="flex items-start gap-2"><span class="text-dgreen-600 mt-1">▸</span>Jäsenprofiiliin vapaaehtoisesti lisätyt tiedot: syntymävuosi, paikkakunta, lempijuoma, kotisivu, sähköpostiosoite</li>
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
            Mitään seurantatietoja ei kerätä.
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
            Gallerion kuvat vaativat aina kirjautumisen — ne eivät ole julkisia linkkejä.
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
            Kanniaalio+ on harrastuspohjainen yhteisöpalvelu ilman virallista SLA-sitoumusta.
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
            Tietoja ei myydä, luovuteta eikä käytetä markkinointiin.
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
            Sinulla on oikeus pyytää omien tietojesi tarkistamista, korjausta tai poistamista.
            Voit muokata profiilitietojasi itse omalla profiilisivullasi.
            Tilin poistoa tai muita tietopyyntöjä varten ota yhteyttä ylläpitoon
            <a href="/hakemus" class="text-dgreen-400 hover:text-dgreen-300 underline underline-offset-2">yhteydenottolomakkeen</a>
            kautta.
          </p>
        </div>
      </div>

    </div>

    <!-- Alaosa -->
    <div class="mt-12 pt-6 border-t border-gray-800/60 text-xs text-gray-700 text-center">
      Kanniaalio+ · BatMUD-kilta vuodesta 2003 · Tämä seloste on laadittu hyvän tavan mukaisesti harrastusyhteisölle, ei korvaa virallista lakimiehen kautta laadittua tietosuojaselostetta.
    </div>

  </div>
</template>

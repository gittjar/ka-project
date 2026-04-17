import express from 'express';

const router = express.Router();

const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.iconBackgroundColor',
  // Lisätiedot
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.priceLevel',
  'places.editorialSummary',
  'places.servesBeer',
  'places.servesWine',
  'places.servesCocktails',
  'places.outdoorSeating',
  'places.liveMusic',
  'places.goodForWatchingSports',
  'places.reservable',
  'places.delivery',
  'places.takeout',
  'places.dineIn',
  'places.goodForGroups',
].join(',');

// Places API (New) type → our category
// Neljä erillistä kutsua jotta jokaisella ryhmällä on oma 20 tuloksen kiintiö.
// kiosk ja kebab_restaurant ovat API:n kannalta virheellisiä tyyppejä (testattu).
// liquor_store (Alko) saa oman batchin — muuten se hukkuu baarien tai kauppojen sekaan.
const TYPE_BATCH_BARS = [
  'bar', 'pub', 'night_club', 'karaoke', 'casino',
];
const TYPE_BATCH_ALKO = ['liquor_store'];
const TYPE_BATCH_STORES = [
  'convenience_store', 'grocery_store', 'supermarket',
  'hypermarket', 'market', 'department_store', 'gas_station', 'store',
];

// Whitelist: mitkä primaryType-arvot hyväksytään kaupat-batchista.
// store-tyyppi hyväksytään vain jos nimi vastaa kioski-patternia.
// department_store hyväksytään vain tunnetuilla ketjunimillä.
const ALLOWED_STORE_PRIMARY_TYPES = new Set([
  'liquor_store', 'convenience_store', 'grocery_store', 'supermarket',
  'hypermarket', 'market', 'food_store',
  'department_store',   // suodatetaan erillisellä nimipatterilla (ks. alla)
  'gas_station',        // Shell, ABC, Neste (myy alkoholia)
  'discount_store',
  'store',              // hyväksytään vain kioski-nimellä (ks. alla)
]);
const KIOSK_PATTERN = /r-?kioski|kioski|kiosk/i;
// department_store: sallitaan vain tunnetut yleistavara/päivittäistavara-ketjut
const ALLOWED_DEPT_STORE_PATTERN = /tokmanni|sokos|stockmann|prisma|euromarket|k-citymarket|citymarket|s-market|sale|abc/i;
// Nimiin perustuva blocklist: suljetaan aina pois riippumatta primaryTypestä
const NAME_BLOCKLIST = /hankkija|k-rauta|rusta|bauhaus|baumax|würth|motonet(?!.*alko)|kodin terra|expert|gigantti|power\b|clas ohlson|biltema|kukka|florist|puutarha|garden center|laser|optikko|silmä|apteekki|pharmacy|kirjakauppa|kirjasto|museo|museum/i;

const TYPE_BATCH_FOOD = [
  'restaurant', 'fast_food_restaurant', 'pizza_restaurant',
  'sandwich_shop', 'hamburger_restaurant', 'meal_takeaway', 'meal_delivery',
  'italian_restaurant', 'korean_restaurant', 'sushi_restaurant', 'thai_restaurant',
  'chinese_restaurant', 'middle_eastern_restaurant', 'indian_restaurant',
  'turkish_restaurant', 'vietnamese_restaurant', 'japanese_restaurant',
  'mediterranean_restaurant', 'greek_restaurant', 'mexican_restaurant',
];

function classifyType(primaryType, displayName) {
  const pt = (primaryType || '').toLowerCase();
  const dn = (displayName || '').toLowerCase();
  const combined = pt + ' ' + dn;

  if (['bar','night_club','pub','karaoke','casino'].some(t => pt.includes(t))) return 'bar';
  if (combined.includes('bar') || combined.includes('pub') || combined.includes('yökerho') ||
      combined.includes('night') || combined.includes('karaoke')) return 'bar';
  if (pt === 'liquor_store' || dn.includes('alko') || dn.includes('viina')) return 'alko';
  if (pt === 'gas_station') return 'kauppa';
  if (['convenience_store','grocery_store','supermarket','hypermarket','market',
       'food_store','department_store','discount_store','store'].some(t => pt === t)) return 'kauppa';
  if (['fast_food','pizza','sandwich','hamburger','kebab','döner'].some(t => combined.includes(t)) ||
      dn.includes('kebab') || dn.includes('pizza') || dn.includes('burger') ||
      dn.includes('mcdonalds') || dn.includes('hesburger') || dn.includes('pikaruoka')) return 'pikaruoka';
  return 'ravintola';
}

async function fetchBatch(key, types, lat, lng, radius) {
  const r = await fetch(NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    }),
  });
  if (!r.ok) return [];
  const json = await r.json();

  return json.places || [];
}

// GET /api/places/nearby?lat=X&lng=Y&radius=1000
router.get('/nearby', async (req, res) => {
  const lat    = parseFloat(req.query.lat);
  const lng    = parseFloat(req.query.lng);
  const radius = Math.min(5000, Math.max(100, parseFloat(req.query.radius) || 1500));

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ message: 'Virheelliset koordinaatit' });
  }

  const key = process.env.PLACES_API_KEY;
  if (!key) return res.status(503).json({ message: 'Places-avain puuttuu' });

  try {
    const [batch1, batchAlko, batch2, batch3] = await Promise.all([
      fetchBatch(key, TYPE_BATCH_BARS,   lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_ALKO,   lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_STORES, lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_FOOD,   lat, lng, radius),
    ]);

    // Yhdistä ja poista duplikaatit id:n perusteella
    // Kaupat-batchista hyväksytään vain whitelisted primaryType-arvot,
    // ja store-primaryType vain kioski-nimellä.
    const storeIds = new Set(batch2.map(p => p.id));
    const seen = new Set();
    const all = [...batch1, ...batchAlko, ...batch2, ...batch3].filter(p => {
      if (!p.id || seen.has(p.id)) return false;
      const pt = p.primaryType || '';
      const name = p.displayName?.text || '';
      // Blocklist ohittaa kaiken
      if (NAME_BLOCKLIST.test(name)) return false;
      if (storeIds.has(p.id)) {
        if (!ALLOWED_STORE_PRIMARY_TYPES.has(pt)) return false;
        if (pt === 'store' && !KIOSK_PATTERN.test(name)) return false;
        if (pt === 'department_store' && !ALLOWED_DEPT_STORE_PATTERN.test(name)) return false;
      }
      seen.add(p.id);
      return true;
    });

    const places = all.map(p => {
      const hours = p.currentOpeningHours;
      // Etsi tämän hetken sulkemisaika periods[]-taulukosta
      // Periods: { open: {day,hour,minute}, close: {day,hour,minute} }
      let closesAt = null;
      if (hours?.openNow && Array.isArray(hours.periods)) {
        const now = new Date();
        const nowDay = now.getDay(); // 0=su
        const nowMin = now.getHours() * 60 + now.getMinutes();
        // Etsi jakso joka kattaa nykyhetken
        for (const period of hours.periods) {
          if (!period.close) continue;
          const openDay  = period.open?.day  ?? -1;
          const closeDay = period.close.day;
          const closeMin = period.close.hour * 60 + period.close.minute;
          // Jakso alkaa tänään tai yön yli (closeDay != openDay)
          if (openDay === nowDay || (closeDay === nowDay && closeMin > nowMin)) {
            if (closeDay === nowDay) {
              closesAt = `${String(period.close.hour).padStart(2,'0')}:${String(period.close.minute).padStart(2,'0')}`;
              break;
            }
          }
        }
      }
      const PRICE = { FREE: '', INEXPENSIVE: '€', MODERATE: '€€', EXPENSIVE: '€€€', VERY_EXPENSIVE: '€€€€' };

      // Kootaan palvelutagit (vain true-arvot)
      const tags = [];
      if (p.servesBeer)            tags.push('olut');
      if (p.servesWine)            tags.push('viini');
      if (p.servesCocktails)       tags.push('cocktailit');
      if (p.outdoorSeating)        tags.push('terassi');
      if (p.liveMusic)             tags.push('livemusiikki');
      if (p.goodForWatchingSports) tags.push('urheilubaari');
      if (p.reservable)            tags.push('pöytävaraus');
      if (p.delivery)              tags.push('toimitus');
      if (p.takeout)               tags.push('nouto');
      if (p.goodForGroups)         tags.push('ryhmät');

      return {
        id:           p.id,
        name:         p.displayName?.text || '—',
        address:      p.formattedAddress || '',
        lat:          p.location?.latitude,
        lng:          p.location?.longitude,
        rating:       p.rating ?? null,
        ratingCount:  p.userRatingCount ?? 0,
        open:         hours?.openNow ?? null,
        closesAt,
        type:         classifyType(p.primaryType, p.displayName?.text),
        iconColor:    p.iconBackgroundColor || '#555',
        // Lisätiedot
        phone:        p.nationalPhoneNumber || null,
        website:      p.websiteUri || null,
        mapsUri:      p.googleMapsUri || null,
        priceLevel:   PRICE[p.priceLevel] || null,
        description:  p.editorialSummary?.text || null,
        weeklyHours:  p.regularOpeningHours?.weekdayDescriptions || null,
        tags,
      };
    });

    res.json(places);
  } catch (err) {
    res.status(502).json({ message: 'Places-haku epäonnistui' });
  }
});

export default router;

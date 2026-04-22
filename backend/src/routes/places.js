import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  classifyType,
  ALLOWED_STORE_PRIMARY_TYPES,
  KIOSK_PATTERN,
  ALLOWED_DEPT_STORE_PATTERN,
  NAME_BLOCKLIST,
} from '../utils/placesUtils.js';

const router = express.Router();

// Max 100 hakua per IP per 24h — suojaa Places API-avainta väärinkäytöltä
const nearbyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Liikaa hakuja, yritä huomenna uudelleen' },
});

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
  'places.photos',
].join(',');

// Places API (New) type → our category
// Viisi erillistä kutsua jotta jokaisella ryhmällä on oma 20 tuloksen kiintiö.
// kiosk ja kebab_restaurant ovat API:n kannalta virheellisiä tyyppejä (testattu).
// liquor_store (Alko) saa oman batchin — muuten se hukkuu baarien tai kauppojen sekaan.
const TYPE_BATCH_BARS = [
  'bar', 'pub', 'night_club', 'karaoke', 'casino',
];
const TYPE_BATCH_BREWERY = ['brewery'];
const TYPE_BATCH_ALKO = ['liquor_store'];
const TYPE_BATCH_STORES = [
  'convenience_store', 'grocery_store', 'supermarket',
  'hypermarket', 'market', 'department_store', 'gas_station', 'store',
];

const TYPE_BATCH_FOOD = [
  'restaurant', 'fast_food_restaurant', 'pizza_restaurant',
  'sandwich_shop', 'hamburger_restaurant', 'meal_takeaway', 'meal_delivery',
  'italian_restaurant', 'korean_restaurant', 'sushi_restaurant', 'thai_restaurant',
  'chinese_restaurant', 'middle_eastern_restaurant', 'indian_restaurant',
  'turkish_restaurant', 'vietnamese_restaurant', 'japanese_restaurant',
  'mediterranean_restaurant', 'greek_restaurant', 'mexican_restaurant',
];

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
router.get('/nearby', nearbyLimiter, async (req, res) => {
  const lat    = parseFloat(req.query.lat);
  const lng    = parseFloat(req.query.lng);
  const radius = Math.min(5000, Math.max(100, parseFloat(req.query.radius) || 1500));

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ message: 'Virheelliset koordinaatit' });
  }

  const key = process.env.PLACES_API_KEY;
  if (!key) return res.status(503).json({ message: 'Places-avain puuttuu' });

  try {
    const [batch1, batchAlko, batch2, batch3, batchBrewery] = await Promise.all([
      fetchBatch(key, TYPE_BATCH_BARS,    lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_ALKO,    lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_STORES,  lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_FOOD,    lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_BREWERY, lat, lng, radius),
    ]);

    // Yhdistä ja poista duplikaatit id:n perusteella
    // Kaupat-batchista hyväksytään vain whitelisted primaryType-arvot,
    // ja store-primaryType vain kioski-nimellä.
    const storeIds = new Set(batch2.map(p => p.id));
    const seen = new Set();
    const all = [...batch1, ...batchAlko, ...batch2, ...batch3, ...batchBrewery].filter(p => {
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
        photos:       (p.photos || []).slice(0, 3).map(ph => ph.name).filter(Boolean),
      };
    });

    res.json(places);
  } catch (err) {
    res.status(502).json({ message: 'Places-haku epäonnistui' });
  }
});

// GET /api/places/photo?ref=places/ChIJ.../photos/AXCi2y...&maxw=600
// Proxy Google Places Photo API jotta avain pysyy backendissä
router.get('/photo', async (req, res) => {
  const { ref, maxw = '600' } = req.query;
  if (!ref || typeof ref !== 'string' || !ref.startsWith('places/')) {
    return res.status(400).json({ message: 'Virheellinen photo ref' });
  }
  const key = process.env.PLACES_API_KEY;
  if (!key) return res.status(503).end();

  const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${maxw}&skipHttpRedirect=true&key=${key}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).end();
    const json = await r.json();
    const photoUri = json.photoUri;
    if (!photoUri) return res.status(404).end();
    // Haetaan varsinainen kuva ja proxataan se
    const imgR = await fetch(photoUri);
    if (!imgR.ok) return res.status(imgR.status).end();
    const ct = imgR.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Salli cross-origin lataus — kuvia käytetään toiselta domainilta (frontend ≠ backend)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buf = await imgR.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

export default router;

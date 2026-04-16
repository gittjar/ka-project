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
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.iconBackgroundColor',
].join(',');

// Places API (New) type → our category
// Kaksi ryhmää koska API sallii max 50 tyyppiä per kutsu
const TYPE_BATCH_1 = [
  'bar', 'night_club', 'pub',
  'liquor_store',
  'convenience_store', 'grocery_store', 'supermarket',
  'fast_food_restaurant', 'pizza_restaurant',
  'sandwich_shop', 'hamburger_restaurant',
];
const TYPE_BATCH_2 = [
  'restaurant', 'meal_takeaway', 'meal_delivery',
  'karaoke', 'casino',
  'korean_restaurant', 'sushi_restaurant', 'thai_restaurant',
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
  if (pt.includes('liquor') || dn.includes('alko') || dn.includes('viina')) return 'alko';
  if (['convenience_store','grocery_store','supermarket'].some(t => pt.includes(t))) return 'kauppa';
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
    const [batch1, batch2] = await Promise.all([
      fetchBatch(key, TYPE_BATCH_1, lat, lng, radius),
      fetchBatch(key, TYPE_BATCH_2, lat, lng, radius),
    ]);

    // Yhdistä ja poista duplikaatit id:n perusteella
    const seen = new Set();
    const all = [...batch1, ...batch2].filter(p => {
      if (!p.id || seen.has(p.id)) return false;
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
      return {
        id:          p.id,
        name:        p.displayName?.text || '—',
        address:     p.formattedAddress || '',
        lat:         p.location?.latitude,
        lng:         p.location?.longitude,
        rating:      p.rating ?? null,
        ratingCount: p.userRatingCount ?? 0,
        open:        hours?.openNow ?? null,
        closesAt,
        type:        classifyType(p.primaryType, p.displayName?.text),
        iconColor:   p.iconBackgroundColor || '#555',
      };
    });

    res.json(places);
  } catch (err) {
    res.status(502).json({ message: 'Places-haku epäonnistui' });
  }
});

export default router;

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
  'places.primaryTypeDisplayName',
  'places.iconBackgroundColor',
].join(',');

const TYPE_GROUPS = {
  bar:     ['bar', 'night_club', 'pub'],
  alko:    ['liquor_store'],
  kauppa:  ['convenience_store', 'grocery_store', 'supermarket'],
};

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

  const allTypes = [...TYPE_GROUPS.bar, ...TYPE_GROUPS.alko, ...TYPE_GROUPS.kauppa];

  try {
    const body = {
      includedTypes: allTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
    };

    const r = await fetch(NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ message: err.error?.message || 'Places-haku epäonnistui' });
    }

    const json = await r.json();
    const places = (json.places || []).map(p => ({
      id:            p.id,
      name:          p.displayName?.text || '—',
      address:       p.formattedAddress || '',
      lat:           p.location?.latitude,
      lng:           p.location?.longitude,
      rating:        p.rating ?? null,
      ratingCount:   p.userRatingCount ?? 0,
      open:          p.currentOpeningHours?.openNow ?? null,
      type:          classifyType(p.primaryTypeDisplayName?.text, getFirstType(p)),
      iconColor:     p.iconBackgroundColor || '#555',
    }));

    res.json(places);
  } catch (err) {
    res.status(502).json({ message: 'Places-haku epäonnistui' });
  }
});

function getFirstType(p) {
  // primaryTypeDisplayName is localized; use iconBackgroundColor as fallback signal
  const name = (p.displayName?.text || '').toLowerCase();
  if (TYPE_GROUPS.alko.some(t => name.includes('alko'))) return 'liquor_store';
  return null;
}

function classifyType(displayName, fallback) {
  const n = (displayName || '').toLowerCase();
  if (n.includes('baari') || n.includes('bar') || n.includes('pub') || n.includes('yökerho')) return 'bar';
  if (n.includes('alko') || n.includes('viina') || n.includes('liquor')) return 'alko';
  return 'kauppa';
}

export default router;

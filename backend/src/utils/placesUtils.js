// Testattavat apufunktiot ja vakiot lähipaikkojen luokitteluun.
// Eriytetty routes/places.js:stä yksikkötestauksen mahdollistamiseksi.

export const ALLOWED_STORE_PRIMARY_TYPES = new Set([
  'liquor_store', 'convenience_store', 'grocery_store', 'supermarket',
  'hypermarket', 'market', 'food_store',
  'department_store',
  'gas_station',
  'discount_store',
  'store',
]);

export const KIOSK_PATTERN = /r-?kioski|kioski|kiosk/i;

export const ALLOWED_DEPT_STORE_PATTERN =
  /tokmanni|sokos|stockmann|prisma|euromarket|k-citymarket|citymarket|s-market|sale|abc/i;

export const NAME_BLOCKLIST =
  /hankkija|k-rauta|rusta|bauhaus|baumax|würth|motonet(?!.*alko)|kodin terra|expert|gigantti|power\b|clas ohlson|biltema|kukka|florist|puutarha|garden center|laser|optikko|silmä|apteekki|pharmacy|kirjakauppa|kirjasto|museo|museum/i;

/**
 * Luokittelee Google Places -paikan omaan kategoriaan.
 * @param {string} primaryType  - Google Places primaryType
 * @param {string} displayName  - Paikan näyttönimi
 * @returns {'bar'|'alko'|'panimo'|'kauppa'|'ravintola'|'pikaruoka'}
 */
export function classifyType(primaryType, displayName) {
  const pt = (primaryType || '').toLowerCase();
  const dn = (displayName || '').toLowerCase();
  const combined = pt + ' ' + dn;

  if (pt === 'brewery' || dn.includes('panimo') || dn.includes('brewery') || dn.includes('brewing')) return 'panimo';
  if (['bar', 'night_club', 'pub', 'karaoke', 'casino'].some(t => pt.includes(t))) return 'bar';
  if (combined.includes('bar') || combined.includes('pub') || combined.includes('yökerho') ||
      combined.includes('night') || combined.includes('karaoke')) return 'bar';
  if (pt === 'liquor_store' || dn.includes('alko') || dn.includes('viina')) return 'alko';
  if (pt === 'gas_station') return 'kauppa';
  if (['convenience_store', 'grocery_store', 'supermarket', 'hypermarket', 'market',
       'food_store', 'department_store', 'discount_store', 'store'].some(t => pt === t)) return 'kauppa';
  if (['fast_food', 'pizza', 'sandwich', 'hamburger', 'kebab', 'döner'].some(t => combined.includes(t)) ||
      dn.includes('kebab') || dn.includes('pizza') || dn.includes('burger') ||
      dn.includes('mcdonalds') || dn.includes('hesburger') || dn.includes('pikaruoka')) return 'pikaruoka';
  return 'ravintola';
}

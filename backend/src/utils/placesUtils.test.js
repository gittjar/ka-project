import { describe, it, expect } from 'vitest';
import {
  classifyType,
  KIOSK_PATTERN,
  NAME_BLOCKLIST,
  ALLOWED_STORE_PRIMARY_TYPES,
  ALLOWED_DEPT_STORE_PATTERN,
} from './placesUtils.js';

// ─── classifyType ─────────────────────────────────────────────────────────────

describe('classifyType — baarit', () => {
  it('tunnistaa baarit primaryTypen perusteella', () => {
    expect(classifyType('bar', 'Kulmabaari')).toBe('bar');
    expect(classifyType('pub', 'Old Pub')).toBe('bar');
    expect(classifyType('night_club', 'Club 500')).toBe('bar');
    expect(classifyType('karaoke', 'Karaoke Night')).toBe('bar');
    expect(classifyType('casino', 'Casino Palace')).toBe('bar');
  });

  it('tunnistaa baarit nimen perusteella, vaikka primaryType olisi muu', () => {
    expect(classifyType('restaurant', 'Rautalahti Bar & Grill')).toBe('bar');
    expect(classifyType('restaurant', 'Pub Ankka')).toBe('bar');
    expect(classifyType('restaurant', 'Yökerho Vinkki')).toBe('bar');
  });
});

describe('classifyType — alko', () => {
  it('tunnistaa alkot primaryTypen perusteella', () => {
    expect(classifyType('liquor_store', 'Alko')).toBe('alko');
    expect(classifyType('liquor_store', 'Mikä tahansa')).toBe('alko');
  });

  it('tunnistaa alkot nimen perusteella', () => {
    expect(classifyType('store', 'Alko Lahti')).toBe('alko');
    expect(classifyType('store', 'Viinaliike')).toBe('alko');
  });
});

describe('classifyType — panimot', () => {
  it('tunnistaa panimot primaryTypen perusteella', () => {
    expect(classifyType('brewery', 'Laitilan Wirvoitusjuomatehdas')).toBe('panimo');
  });

  it('tunnistaa panimot nimen perusteella', () => {
    expect(classifyType('restaurant', 'Panimoravintola Koulu')).toBe('panimo');
    expect(classifyType('bar', 'Helsinki Brewing Company')).toBe('panimo');
    expect(classifyType('restaurant', 'Tampere Brewing Co')).toBe('panimo');
  });
});

describe('classifyType — kaupat', () => {
  it('tunnistaa tyypilliset kaupat', () => {
    expect(classifyType('convenience_store', 'K-Market')).toBe('kauppa');
    expect(classifyType('supermarket', 'Prisma')).toBe('kauppa');
    expect(classifyType('grocery_store', 'Sale')).toBe('kauppa');
    expect(classifyType('hypermarket', 'Citymarket')).toBe('kauppa');
    expect(classifyType('market', 'Tori')).toBe('kauppa');
  });

  it('tunnistaa huoltoasemat kaupaksi', () => {
    expect(classifyType('gas_station', 'Shell')).toBe('kauppa');
    expect(classifyType('gas_station', 'ABC')).toBe('kauppa');
    expect(classifyType('gas_station', 'Neste')).toBe('kauppa');
  });
});

describe('classifyType — pikaruoka', () => {
  it('tunnistaa pikaruokapaikat', () => {
    expect(classifyType('fast_food_restaurant', 'Hesburger')).toBe('pikaruoka');
    expect(classifyType('hamburger_restaurant', 'McDonald\'s')).toBe('pikaruoka');
    expect(classifyType('restaurant', 'Kebab Palace')).toBe('pikaruoka');
    expect(classifyType('pizza_restaurant', 'Kotipizza')).toBe('pikaruoka');
  });
});

describe('classifyType — ravintolat (fallback)', () => {
  it('luokittelee tuntemattoman ravintolaksi', () => {
    expect(classifyType('restaurant', 'Ravintola Siilinpesä')).toBe('ravintola');
    expect(classifyType('italian_restaurant', 'Trattoria Bella')).toBe('ravintola');
  });

  it('palauttaa ravintolan tyhjillä arvoilla', () => {
    expect(classifyType('', '')).toBe('ravintola');
    expect(classifyType(null, null)).toBe('ravintola');
  });
});

// ─── NAME_BLOCKLIST ───────────────────────────────────────────────────────────

describe('NAME_BLOCKLIST', () => {
  it('suodattaa rautakaupat ja kodinkoneet', () => {
    expect(NAME_BLOCKLIST.test('K-Rauta Tampere')).toBe(true);
    expect(NAME_BLOCKLIST.test('Bauhaus Pirkkala')).toBe(true);
    expect(NAME_BLOCKLIST.test('Biltema')).toBe(true);
    expect(NAME_BLOCKLIST.test('Clas Ohlson')).toBe(true);
    expect(NAME_BLOCKLIST.test('Expert elektroniikka')).toBe(true);
    expect(NAME_BLOCKLIST.test('Gigantti')).toBe(true);
  });

  it('suodattaa apteekit ja terveys', () => {
    expect(NAME_BLOCKLIST.test('Apteekki Tampere')).toBe(true);
    expect(NAME_BLOCKLIST.test('Silmäasema')).toBe(true);
  });

  it('ei suodata normaalia Motonettia (ei alko-yhteyttä)', () => {
    expect(NAME_BLOCKLIST.test('Motonet Tampere')).toBe(true);
  });

  it('ei suodata "Motonet Alko"-yhdistelmää', () => {
    expect(NAME_BLOCKLIST.test('Motonet Alko')).toBe(false);
  });

  it('ei suodata ravintoloita tai baareja', () => {
    expect(NAME_BLOCKLIST.test('Ravintola Siilinpesä')).toBe(false);
    expect(NAME_BLOCKLIST.test('Bar & Grill')).toBe(false);
    expect(NAME_BLOCKLIST.test('K-Market')).toBe(false);
  });
});

// ─── KIOSK_PATTERN ────────────────────────────────────────────────────────────

describe('KIOSK_PATTERN', () => {
  it('tunnistaa kioskit', () => {
    expect(KIOSK_PATTERN.test('R-kioski')).toBe(true);
    expect(KIOSK_PATTERN.test('R Kioski')).toBe(true);
    expect(KIOSK_PATTERN.test('Rikioski')).toBe(true);
    expect(KIOSK_PATTERN.test('Kioski Helsinki')).toBe(true);
    expect(KIOSK_PATTERN.test('Kiosk')).toBe(true);
  });

  it('ei tunnista muita kauppoja kioskiksi', () => {
    expect(KIOSK_PATTERN.test('K-Market')).toBe(false);
    expect(KIOSK_PATTERN.test('Prisma')).toBe(false);
    expect(KIOSK_PATTERN.test('Shell')).toBe(false);
  });
});

// ─── ALLOWED_STORE_PRIMARY_TYPES ─────────────────────────────────────────────

describe('ALLOWED_STORE_PRIMARY_TYPES', () => {
  it('sallii päivittäistavarakaupat', () => {
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('supermarket')).toBe(true);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('grocery_store')).toBe(true);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('convenience_store')).toBe(true);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('hypermarket')).toBe(true);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('market')).toBe(true);
  });

  it('sallii huoltoasemat ja alkon', () => {
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('gas_station')).toBe(true);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('liquor_store')).toBe(true);
  });

  it('ei salli rautakauppoja tai huonekaluliikkeitä', () => {
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('hardware_store')).toBe(false);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('furniture_store')).toBe(false);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('clothing_store')).toBe(false);
    expect(ALLOWED_STORE_PRIMARY_TYPES.has('electronics_store')).toBe(false);
  });
});

// ─── ALLOWED_DEPT_STORE_PATTERN ───────────────────────────────────────────────

describe('ALLOWED_DEPT_STORE_PATTERN', () => {
  it('sallii tunnetut päivittäistavara-ketjut', () => {
    expect(ALLOWED_DEPT_STORE_PATTERN.test('Prisma Tampere')).toBe(true);
    expect(ALLOWED_DEPT_STORE_PATTERN.test('Tokmanni')).toBe(true);
    expect(ALLOWED_DEPT_STORE_PATTERN.test('Stockmann Helsinki')).toBe(true);
    expect(ALLOWED_DEPT_STORE_PATTERN.test('K-Citymarket')).toBe(true);
    expect(ALLOWED_DEPT_STORE_PATTERN.test('S-market')).toBe(true);
  });

  it('ei salli tuntemattomia tavarataloja', () => {
    expect(ALLOWED_DEPT_STORE_PATTERN.test('MuotiMyymälä')).toBe(false);
    expect(ALLOWED_DEPT_STORE_PATTERN.test('Outlet Center')).toBe(false);
  });
});

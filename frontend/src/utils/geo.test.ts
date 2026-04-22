import { describe, it, expect } from 'vitest';
import { haversineDistance, formatDistance } from './geo';

// ─── haversineDistance ────────────────────────────────────────────────────────

describe('haversineDistance', () => {
  it('palauttaa 0 kun koordinaatit ovat samat', () => {
    expect(haversineDistance(60.169, 24.938, 60.169, 24.938)).toBe(0);
  });

  it('laskee etäisyyden Helsingistä Tampereelle (~166 km)', () => {
    const d = haversineDistance(60.1699, 24.9384, 61.4978, 23.7610);
    expect(d).toBeGreaterThan(160_000);
    expect(d).toBeLessThan(175_000);
  });

  it('etäisyys on symmetrinen (A→B = B→A)', () => {
    const d1 = haversineDistance(60.169, 24.938, 61.498, 23.761);
    const d2 = haversineDistance(61.498, 23.761, 60.169, 24.938);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it('lyhyt matka (muutama sata metriä) on järkevä', () => {
    // ~150 m (noin 0.001° leveys- ja pituusasteessa)
    const d = haversineDistance(60.169, 24.938, 60.170, 24.939);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(300);
  });

  it('Oksjärven leirikeskus Helsingistä on ~89 km', () => {
    const d = haversineDistance(60.1699, 24.9384, 60.8029, 23.9426);
    expect(d).toBeGreaterThan(80_000);
    expect(d).toBeLessThan(100_000);
  });
});

// ─── formatDistance ───────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('näyttää metrit alle 1 km', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('näyttää kilometrit 1 km ja yli', () => {
    expect(formatDistance(1000)).toBe('1,0 km');
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatDistance(2500)).toBe('2,5 km');
    expect(formatDistance(10000)).toBe('10,0 km');
  });

  it('pyöristää desimaalit oikein kilometreissä', () => {
    expect(formatDistance(1049)).toBe('1,0 km');
    expect(formatDistance(1050)).toBe('1,1 km');
  });

  it('pyöristää metrit kokonaisluvuksi', () => {
    expect(formatDistance(123.4)).toBe('123 m');
    expect(formatDistance(123.6)).toBe('124 m');
  });

  it('käyttää pilkkua desimaalierottimena', () => {
    expect(formatDistance(1500)).toContain(',');
    expect(formatDistance(1500)).not.toContain('.');
  });
});

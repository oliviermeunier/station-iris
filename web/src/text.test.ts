import { describe, expect, it } from 'vitest';
import { headline } from './synthesis';
import { depth, litres, mm, positionLabel } from './text';

describe('text', () => {
  it('depth is explicit', () => {
    expect(depth(4.62)).toBe('4,62 m sous le sol');
    expect(depth(-0.1)).toBe('0,10 m au-dessus du sol');
  });
  it('litres', () => {
    expect(litres(7.7)).toBe('7,7 L/m²');
    expect(litres(41)).toBe('41 L/m²');
  });
  it('mm', () => {
    expect(mm(11.4)).toBe('11 mm');
    expect(mm(6.5)).toBe('6,5 mm');
  });
  it('positionLabel', () => {
    expect(positionLabel('low', 'nappe')).toBe('basse');
    expect(positionLabel('aboveAll', 'debit')).toMatch(/plus fort que toutes/);
  });
});

describe('headline', () => {
  it('dry week, no groundwater', () => {
    expect(headline({ rainTotal: 0 })).toBe('Pas de pluie notable prévue cette semaine.');
  });
  it('rain then low groundwater uses "mais"', () => {
    const h = headline({ rainTotal: 6.5, rainiest: { date: '2026-10-21', mm: 6.5 }, nappe: 'low' });
    expect(h).toBe('Un peu de pluie attendue mercredi, mais la nappe est <em>basse</em> pour la saison.');
  });
  it('adds frost', () => {
    const h = headline({ rainTotal: 0, frost: '2026-10-22' });
    expect(h).toMatch(/Gel possible jeudi\.$/);
  });
});

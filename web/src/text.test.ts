import { describe, expect, it } from 'vitest';
import { headline } from './synthesis';
import { depth, litres, mm, placePhrase, positionLabel, stationParts } from './text';

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

describe('placePhrase', () => {
  it('avoids "autour de Près de …"', () => {
    expect(placePhrase('Tiercé (49125)', 'autour de')).toEqual(['autour de', 'Tiercé (49125)']);
    expect(placePhrase('Tiercé (49125)', 'à')).toEqual(['à', 'Tiercé (49125)']);
    expect(placePhrase('Près de Cheffes', 'autour de')).toEqual(['près de', 'Cheffes']);
    expect(placePhrase('Près de Cheffes', 'à')).toEqual(['près de', 'Cheffes']);
    expect(placePhrase('Ma position', 'à')).toEqual(['autour de', 'votre position']);
  });
});

describe('stationParts', () => {
  it('splits a station label into place and detail', () => {
    expect(stationParts('La Sarthe à Spay [Ecluse de Prélandon] - Amont')).toEqual({ place: 'Spay', detail: 'Ecluse de Prélandon, amont' });
    expect(stationParts('La Sarthe au Mans [Yssoir]')).toEqual({ place: 'Le Mans', detail: 'Yssoir' });
    expect(stationParts('La Sarthe à Saint-Céneri-le-Gérei - Moulin-du-Désert')).toEqual({ place: 'Saint-Céneri-le-Gérei', detail: 'Moulin-du-Désert' });
    expect(stationParts('La Sarthe à Cheffes')).toEqual({ place: 'Cheffes', detail: '' });
    expect(stationParts('[La Voutonne] à Précigné')).toEqual({ place: 'Précigné', detail: '' });
  });
});

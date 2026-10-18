import { describe, expect, it } from 'vitest';
import { cumulativeByYear, groupRivers, points, riverLevel, riverName, rollingBalance, withinOrNearest } from './store';

const flat = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot(a.lat - b.lat, a.lon - b.lon) * 100;

describe('withinOrNearest', () => {
  it('nearestBeyondRadius when nothing is close', () => {
    const r = withinOrNearest([{ lat: 1, lon: 0 }, { lat: 0.5, lon: 0 }], { lat: 0, lon: 0 }, 10, flat);
    expect(r.inRadius).toEqual([]);
    expect(r.nearestBeyond?.km).toBe(50);
  });
  it('returns stations in radius nearest first', () => {
    const r = withinOrNearest([{ lat: 0.08, lon: 0 }, { lat: 0.02, lon: 0 }, { lat: 1, lon: 0 }], { lat: 0, lon: 0 }, 10, flat);
    expect(r.inRadius.map((l) => l.item.lat)).toEqual([0.02, 0.08]);
    expect(r.nearestBeyond).toBeNull();
  });
});

describe('rollingBalance', () => {
  it('sums complete windows only', () => {
    const days: [string, number | null, number | null][] = [
      ['d1', 1, 2],
      ['d2', 3, 1],
      ['d3', null, 1],
      ['d4', 0, 1],
      ['d5', 2, 0],
    ];
    expect(rollingBalance(days, 2)).toEqual([
      ['d2', 1],
      ['d5', 1],
    ]);
  });
});

describe('series helpers', () => {
  it('points drops nulls', () => {
    expect(points(['a', 'b'], [1, null])).toEqual([['a', 1]]);
  });
  it('cumulativeByYear restarts on 1 January', () => {
    expect(
      cumulativeByYear([
        ['2025-12-31', 2],
        ['2026-01-01', 1],
        ['2026-01-02', 1.5],
      ]),
    ).toEqual([
      ['2025-12-31', 2],
      ['2026-01-01', 1],
      ['2026-01-02', 2.5],
    ]);
  });
});

describe('rivers', () => {
  const flat = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.hypot(a.lat - b.lat, a.lon - b.lon) * 100;
  const st = (code: string, river: string, lat: number) => ({ code, name: code, river, lat, lon: 0 });

  it('names rivers', () => {
    expect(riverName('La Sarthe à Cheffes', null)).toBe('La Sarthe');
    expect(riverName('x', 'le Loir')).toBe('Le Loir');
    expect(riverName('[La Voutonne] à Précigné', null)).toBe('La Voutonne');
  });

  it('groups stations by river, merging Sandre codes, nearest river first', () => {
    const rivers = groupRivers(
      [
        { station: st('M072', 'sarthe', 0.08), name: 'La Sarthe', riverCode: 'M---0060' },
        { station: st('M073', 'sarthe', 0.05), name: 'La Sarthe', riverCode: 'M---0061' },
        { station: st('M156', 'loir', 0.03), name: 'Le Loir', riverCode: 'M1--0160' },
        { station: st('M410', 'maine', 0.5), name: 'La Maine', riverCode: 'M4--0190' },
      ],
      { lat: 0, lon: 0 },
      10,
      flat,
    );
    expect(rivers.map((r) => r.name)).toEqual(['Le Loir', 'La Sarthe']);
    expect(rivers[1]!.codes).toEqual(['M---0060', 'M---0061']);
    expect(rivers[1]!.stations.map((l) => l.item.code)).toEqual(['M073', 'M072']);
  });

  it('falls back to the nearest river', () => {
    const rivers = groupRivers([{ station: st('M410', 'maine', 0.5), name: 'La Maine', riverCode: null }], { lat: 0, lon: 0 }, 10, flat);
    expect(rivers.map((r) => r.name)).toEqual(['La Maine']);
  });

  it('computes an overall river level', () => {
    expect(riverLevel([]).position).toBeNull();
    expect(riverLevel(['low', 'low', 'normal']).position).toBe('low');
    expect(riverLevel(['low', 'normal']).position).toBe('low');
    expect(riverLevel(['belowAll', 'aboveAll']).position).toBe('normal');
    expect(riverLevel(['low', 'normal', 'normal']).counts.normal).toBe(2);
  });
});

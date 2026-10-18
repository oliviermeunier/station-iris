import { describe, expect, it } from 'vitest';
import { cumulativeByYear, points, rollingBalance, withinOrNearest } from './store';

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

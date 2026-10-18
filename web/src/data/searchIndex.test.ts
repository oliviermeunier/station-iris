import { describe, expect, it } from 'vitest';
import { normalise, rank, type IndexEntry } from './searchIndex';

const rivers: IndexEntry[] = [
  { code: 'A', name: 'La Sarthe', stations: 13 },
  { code: 'B', name: 'La Petite Sarthe', stations: 2 },
  { code: 'C', name: 'La Loire', stations: 62 },
  { code: 'D', name: 'Le Loir', stations: 9 },
];

describe('search index', () => {
  it('normalises accents and apostrophes', () => {
    expect(normalise("Nappe d’Alsace, Pliocène")).toBe('nappe d alsace, pliocene');
  });
  it('puts names starting with the query first', () => {
    expect(rank(rivers, 'sarthe').map((e) => e.code)).toEqual(['A', 'B']);
  });
  it('ranks by station count among equal matches', () => {
    expect(rank(rivers, 'loir').map((e) => e.code)).toEqual(['C', 'D']);
  });
  it('needs two characters', () => {
    expect(rank(rivers, 'l')).toEqual([]);
  });
});

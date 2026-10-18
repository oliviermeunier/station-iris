import type { Position } from './core';
import { dayName } from './text';

export interface HeadlineInput {
  /** Mean total rain over the next 7 days (mm). */
  rainTotal: number;
  /** Rainiest upcoming day, if any reaches 1 mm. */
  rainiest?: { date: string; mm: number };
  nappe?: Position;
  /** First day with a frost risk. */
  frost?: string;
}

function rainPart(i: HeadlineInput): string {
  if (!i.rainiest || i.rainTotal < 1) return 'Pas de pluie notable prévue cette semaine';
  const day = dayName(i.rainiest.date, 'long');
  if (i.rainTotal < 10) return `Un peu de pluie attendue ${day}`;
  if (i.rainTotal < 30) return `De la pluie attendue, surtout ${day}`;
  return `Une semaine pluvieuse, surtout ${day}`;
}

function nappePart(p: Position | undefined, wet: boolean): string | null {
  if (!p) return null;
  const low = p === 'low' || p === 'belowAll';
  const word = { belowAll: 'très basse', low: 'basse', normal: 'dans la normale', high: 'haute', aboveAll: 'très haute' }[p];
  const link = wet && low ? 'mais' : 'et';
  return `${link} la nappe est <em>${word}</em> pour la saison`;
}

/** One sentence summarising the week; may contain <em> for the key word. */
export function headline(i: HeadlineInput): string {
  const wet = Boolean(i.rainiest) && i.rainTotal >= 1;
  const parts = [rainPart(i)];
  const n = nappePart(i.nappe, wet);
  if (n) parts.push(n);
  let s = parts.join(', ');
  if (i.frost) s += `. Gel possible ${dayName(i.frost, 'long')}`;
  return `${s}.`;
}

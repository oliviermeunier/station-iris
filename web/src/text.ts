import type { Position } from './core';

const nf = (digits: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function num(x: number, digits = 1): string {
  return nf(digits).format(x).replace(/ /g, ' ');
}

/** Depth to water, always explicit; a negative depth means the water stands above ground. */
export function depth(m: number): string {
  return m < 0 ? `${num(-m, 2)} m au-dessus du sol` : `${num(m, 2)} m sous le sol`;
}

export function mm(x: number): string {
  return `${num(x, x >= 10 ? 0 : 1)} mm`;
}

/** Same quantity as mm of rain, expressed per square metre. */
export function litres(x: number): string {
  return `${num(x, x >= 10 ? 0 : 1)} L/m²`;
}

export function deg(x: number): string {
  return `${Math.round(x)}°`;
}

type Subject = 'nappe' | 'debit' | 'temp' | 'sol';

const LABELS: Record<Subject, Record<Position, string>> = {
  nappe: {
    belowAll: 'plus basse que toutes les années connues à cette date',
    low: 'basse',
    normal: 'dans la normale',
    high: 'haute',
    aboveAll: 'plus haute que toutes les années connues à cette date',
  },
  debit: {
    belowAll: 'plus faible que toutes les années connues à cette date',
    low: 'faible',
    normal: 'dans la normale',
    high: 'fort',
    aboveAll: 'plus fort que toutes les années connues à cette date',
  },
  sol: {
    belowAll: 'plus sec que toutes les années connues à cette date',
    low: 'plus sec que d’habitude à cette date',
    normal: 'comme d’habitude à cette date',
    high: 'plus humide que d’habitude à cette date',
    aboveAll: 'plus humide que toutes les années connues à cette date',
  },
  temp: {
    belowAll: 'plus froid que toutes les années connues à cette date',
    low: 'plus frais que d’habitude',
    normal: 'de saison',
    high: 'plus doux que d’habitude',
    aboveAll: 'plus chaud que toutes les années connues à cette date',
  },
};

export function positionLabel(p: Position, subject: Subject): string {
  return LABELS[subject][p];
}

/** Short word for tiles: basse / normale / haute… */
export function positionShort(p: Position, subject: 'nappe' | 'debit'): string {
  const short: Record<Position, string> =
    subject === 'nappe'
      ? { belowAll: 'Très basse', low: 'Basse', normal: 'Normale', high: 'Haute', aboveAll: 'Très haute' }
      : { belowAll: 'Très faible', low: 'Faible', normal: 'Normal', high: 'Fort', aboveAll: 'Très fort' };
  return short[p];
}

export function dayName(iso: string, style: 'short' | 'long' = 'short'): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { weekday: style }).format(d).replace('.', '');
}

export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric' }).format(d);
}

export function dateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
}

export function km(x: number): string {
  return `${num(x, x < 10 ? 1 : 0)} km`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

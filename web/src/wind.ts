// Wind helpers. Directions are where the wind blows FROM, in degrees (0 = north).

const POINTS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
const SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

function point(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) / 45) % 8;
}

/** "sud-ouest" — for "vent de sud-ouest". */
export function compass(deg: number): string {
  return POINTS[point(deg)]!;
}

export function compassShort(deg: number): string {
  return SHORT[point(deg)]!;
}

/**
 * Mean of directions on the circle (350° and 10° average to 0°, not 180°).
 * Null when there is nothing to average or the sources disagree too much to name a direction.
 */
export function meanDirection(values: (number | null | undefined)[]): number | null {
  const ok = values.filter((v): v is number => typeof v === 'number');
  if (ok.length === 0) return null;
  const x = ok.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0) / ok.length;
  const y = ok.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0) / ok.length;
  if (Math.hypot(x, y) < 0.3) return null;
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/** Plain words for a day's strongest gust (empty below 50 km/h). */
export function gustWord(kmh: number): string {
  if (kmh >= 90) return 'tempête';
  if (kmh >= 70) return 'vent très fort';
  if (kmh >= 50) return 'vent fort';
  return '';
}

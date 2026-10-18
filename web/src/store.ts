// Loads and combines data for a place. Every loader is memoised per place / station so
// that switching pages does not refetch.
import { PROFILE_DOWN_KM, PROFILE_UP_KM, RADIUS_KM } from './config';
import {
  bbox,
  classify,
  dayOfYearEnvelopes,
  distanceKm,
  envelopeAt,
  fillRatio,
  riverKey,
  riverProfile,
  type Envelope,
  type Point,
  type Position,
  type RiverStation,
} from './core';
import { hydroLatest, hydroSeries, hydroStations, piezoSeries, piezoStations, type Grandeur, type PiezoStation } from './data/hubeau';
import { forecast, history, mergeDaily, recent, type DailySeries, type Forecast } from './data/openmeteo';
import type { Place } from './location';

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    memo.set(key, p);
    // A failed load must be retryable on the next visit.
    p.catch(() => memo.delete(key));
  }
  return p;
}
const placeKey = (p: Place) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

export interface Located<T> {
  item: T;
  km: number;
}

/** Items within `radiusKm`, nearest first; or, if none, the nearest one beyond. */
export function withinOrNearest<T extends { lat: number; lon: number }>(
  items: T[],
  center: { lat: number; lon: number },
  radiusKm: number,
  dist: (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => number = distanceKm,
): { inRadius: Located<T>[]; nearestBeyond: Located<T> | null } {
  const located = items.map((item) => ({ item, km: dist(center, item) })).sort((a, b) => a.km - b.km);
  const inRadius = located.filter((l) => l.km <= radiusKm);
  return { inRadius, nearestBeyond: inRadius.length === 0 ? (located[0] ?? null) : null };
}

// ---------- weather ----------

export interface Weather {
  forecast: Forecast;
  /** Archive (30 years) + recent days. */
  daily: DailySeries;
}

export function loadWeather(place: Place): Promise<Weather> {
  return once(`w:${placeKey(place)}`, async () => {
    const [f, archive, latest] = await Promise.all([
      forecast(place.lat, place.lon),
      history(place.lat, place.lon),
      recent(place.lat, place.lon),
    ]);
    return { forecast: f, daily: mergeDaily(archive, latest) };
  });
}

export function points(dates: string[], values: (number | null)[]): Point[] {
  const out: Point[] = [];
  dates.forEach((d, i) => {
    const v = values[i];
    if (typeof v === 'number') out.push([d, v]);
  });
  return out;
}

/** Rain accumulated since 1 January, restarting each year. */
export function cumulativeByYear(series: Point[]): Point[] {
  let year = '';
  let total = 0;
  return series.map(([d, v]) => {
    if (d.slice(0, 4) !== year) {
      year = d.slice(0, 4);
      total = 0;
    }
    total += v;
    return [d, Math.round(total * 10) / 10];
  });
}

/** `halfWindowDays: 0` for year-to-date totals, whose window must not cross 1 January. */
export function bandFor(series: Point[], halfWindowDays?: number, now = new Date()): (Envelope | null)[] {
  return dayOfYearEnvelopes(series, now.getFullYear(), halfWindowDays);
}

// ---------- groundwater ----------

export interface PiezoDetail {
  station: PiezoStation;
  km: number;
  series: Point[];
  latest: Point | null;
  env: Envelope | null;
  position: Position | null;
  /** 0 = driest known at this date, 1 = wettest. */
  fill: number | null;
  meanFill: number | null;
}

export function loadPiezoStations(place: Place) {
  return once(`ps:${placeKey(place)}`, async () => {
    let stations = await piezoStations(bbox(place.lat, place.lon, RADIUS_KM));
    if (!stations.some((s) => distanceKm(place, s) <= RADIUS_KM)) {
      stations = await piezoStations(bbox(place.lat, place.lon, 60));
    }
    return withinOrNearest(stations, place, RADIUS_KM);
  });
}

/** Depths are "bigger = drier": negate to classify on a "bigger = more water" scale. */
export function piezoVerdict(depthM: number, env: Envelope) {
  const neg: Envelope = { min: -env.max, max: -env.min, mean: -env.mean, years: env.years };
  return {
    position: classify(-depthM, neg),
    fill: fillRatio(-depthM, neg),
    meanFill: fillRatio(-env.mean, neg),
  };
}

export function loadPiezoDetail(station: PiezoStation, km: number): Promise<PiezoDetail> {
  return once(`pd:${station.code}`, async () => {
    const series = await piezoSeries(station.code);
    const latest = series[series.length - 1] ?? null;
    const env = latest ? envelopeAt(series, latest[0]) : null;
    const v = latest && env ? piezoVerdict(latest[1], env) : null;
    return { station, km, series, latest, env, position: v?.position ?? null, fill: v?.fill ?? null, meanFill: v?.meanFill ?? null };
  });
}

// ---------- rivers ----------

export interface RiverSet {
  /** Stations within the radius, nearest first. */
  inRadius: Located<RiverStation>[];
  nearestBeyond: Located<RiverStation> | null;
  /** Nearest river, upstream to downstream. */
  profile: RiverStation[];
  profileRiverLabel: string;
}

export function loadRivers(place: Place): Promise<RiverSet> {
  return once(`rs:${placeKey(place)}`, async () => {
    const raw = await hydroStations(bbox(place.lat, place.lon, PROFILE_UP_KM + RADIUS_KM));
    const stations: RiverStation[] = raw.map((s) => ({
      code: s.code,
      name: s.name,
      river: riverKey(s.name, s.riverLabel),
      lat: s.lat,
      lon: s.lon,
    }));
    const { inRadius, nearestBeyond } = withinOrNearest(stations, place, RADIUS_KM);
    const profile = riverProfile(stations, place.lat, place.lon, PROFILE_UP_KM, PROFILE_DOWN_KM);
    const label = raw.find((s) => s.code === profile[0]?.code);
    return {
      inRadius,
      nearestBeyond,
      profile,
      profileRiverLabel: label?.riverLabel ?? profile[0]?.river ?? '',
    };
  });
}

export interface RiverLatest {
  grandeur: Grandeur;
  latest: Point | null;
}

/** Flow when the station publishes it, otherwise stage. */
export function loadRiverLatest(code: string): Promise<RiverLatest> {
  return once(`rl:${code}`, async () => {
    const q = await hydroLatest(code, 'QmnJ');
    if (q.length > 0) return { grandeur: 'QmnJ' as const, latest: q[q.length - 1]! };
    const hgt = await hydroLatest(code, 'HIXnJ');
    return { grandeur: 'HIXnJ' as const, latest: hgt[hgt.length - 1] ?? null };
  });
}

export interface RiverDetail extends RiverLatest {
  series: Point[];
  env: Envelope | null;
  position: Position | null;
  fill: number | null;
  meanFill: number | null;
}

export function loadRiverDetail(code: string): Promise<RiverDetail> {
  return once(`rd:${code}`, async () => {
    const { grandeur } = await loadRiverLatest(code);
    const series = await hydroSeries(code, grandeur);
    const latest = series[series.length - 1] ?? null;
    // Stage at a managed reach says nothing about drought: no envelope, no verdict.
    const env = grandeur === 'QmnJ' && latest ? envelopeAt(series, latest[0]) : null;
    return {
      grandeur,
      latest,
      series,
      env,
      position: env && latest ? classify(latest[1], env) : null,
      fill: env && latest ? fillRatio(latest[1], env) : null,
      meanFill: env ? fillRatio(env.mean, env) : null,
    };
  });
}

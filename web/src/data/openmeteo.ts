import { DAY, HOUR, daysAgo, fetchJson, isoDate, query } from './http';

export interface Model {
  id: string;
  label: string;
}

export const MODELS: Model[] = [
  { id: 'meteofrance_seamless', label: 'Météo-France' },
  { id: 'ecmwf_ifs025', label: 'ECMWF (européen)' },
  { id: 'icon_seamless', label: 'ICON (allemand)' },
  { id: 'gfs_seamless', label: 'GFS (américain)' },
];

export interface ModelDays {
  tmax: (number | null)[];
  tmin: (number | null)[];
  rain: (number | null)[];
  /** Daily maximum of the mean wind, km/h. */
  wind: (number | null)[];
  /** Daily maximum gust, km/h. */
  gust: (number | null)[];
  /** Dominant direction the wind blows from, degrees. */
  windDir: (number | null)[];
}

export interface Forecast {
  dates: string[];
  byModel: Record<string, ModelDays>;
}

/** Daily observed/re-analysed series. Values may be null. */
export interface DailySeries {
  dates: string[];
  tmax: (number | null)[];
  tmin: (number | null)[];
  rain: (number | null)[];
  et0: (number | null)[];
  wind: (number | null)[];
  gust: (number | null)[];
}

const SERIES_KEYS = ['tmax', 'tmin', 'rain', 'et0', 'wind', 'gust'] as const;

type RawDaily = Record<string, (number | null)[] | string[]>;
interface RawResponse {
  daily: RawDaily;
}

// Up to 10 variables cost no more than one with Open-Meteo's request weighting.
const OBSERVED = 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max,wind_gusts_10m_max';

// Two decimals ≈ 1 km: enough for weather, and the exact position never leaves the device.
const coord = (x: number) => x.toFixed(2);

export function parseForecast(raw: RawResponse, models: Model[] = MODELS): Forecast {
  const dates = (raw.daily.time as string[]) ?? [];
  const pick = (key: string) =>
    ((raw.daily[key] as (number | null)[] | undefined) ?? dates.map(() => null)).map((v) =>
      typeof v === 'number' && Number.isFinite(v) ? v : null,
    );
  const byModel: Record<string, ModelDays> = {};
  for (const m of models) {
    byModel[m.id] = {
      tmax: pick(`temperature_2m_max_${m.id}`),
      tmin: pick(`temperature_2m_min_${m.id}`),
      rain: pick(`precipitation_sum_${m.id}`),
      wind: pick(`wind_speed_10m_max_${m.id}`),
      gust: pick(`wind_gusts_10m_max_${m.id}`),
      windDir: pick(`wind_direction_10m_dominant_${m.id}`),
    };
  }
  return { dates, byModel };
}

export function parseDaily(raw: RawResponse): DailySeries {
  const dates = (raw.daily.time as string[]) ?? [];
  const pick = (key: string) =>
    ((raw.daily[key] as (number | null)[] | undefined) ?? dates.map(() => null)).map((v) =>
      typeof v === 'number' && Number.isFinite(v) ? v : null,
    );
  return {
    dates,
    tmax: pick('temperature_2m_max'),
    tmin: pick('temperature_2m_min'),
    rain: pick('precipitation_sum'),
    et0: pick('et0_fao_evapotranspiration'),
    wind: pick('wind_speed_10m_max'),
    gust: pick('wind_gusts_10m_max'),
  };
}

export async function forecast(lat: number, lon: number): Promise<Forecast> {
  const url = `https://api.open-meteo.com/v1/forecast?${query({
    latitude: coord(lat),
    longitude: coord(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
    models: MODELS.map((m) => m.id).join(','),
    timezone: 'Europe/Paris',
    forecast_days: 7,
  })}`;
  return parseForecast(await fetchJson<RawResponse>(url, 3 * HOUR));
}

/** Last 31 days before today (best-match model analysis) — fills the archive's ~5-day lag. */
export async function recent(lat: number, lon: number, now = new Date()): Promise<DailySeries> {
  const url = `https://api.open-meteo.com/v1/forecast?${query({
    latitude: coord(lat),
    longitude: coord(lon),
    daily: OBSERVED,
    timezone: 'Europe/Paris',
    past_days: 31,
    forecast_days: 1,
  })}`;
  // Today is still a forecast: keep observed days only.
  return keepBefore(parseDaily(await fetchJson<RawResponse>(url, 3 * HOUR)), isoDate(now));
}

export function keepBefore(s: DailySeries, day: string): DailySeries {
  const n = s.dates.findIndex((d) => d >= day);
  if (n < 0) return s;
  const out = { dates: s.dates.slice(0, n) } as DailySeries;
  for (const k of SERIES_KEYS) out[k] = s[k].slice(0, n);
  return out;
}

/**
 * Complete reference years. Open-Meteo weighs a request by its time span (≈ one call per
 * two weeks), so 30 years would cost ~780 calls — more than the free 600/minute. Ten
 * years (~260) is the affordable compromise; completed years are cached for a month.
 */
export const REFERENCE_YEARS = 10;

function archiveUrl(lat: number, lon: number, start: string, end: string): string {
  return `https://archive-api.open-meteo.com/v1/archive?${query({
    latitude: coord(lat),
    longitude: coord(lon),
    start_date: start,
    end_date: end,
    daily: OBSERVED,
    timezone: 'Europe/Paris',
  })}`;
}

/** Reference years plus the current year to date (archive lags by a few days). */
export async function history(lat: number, lon: number, now = new Date()): Promise<DailySeries> {
  const year = now.getFullYear();
  const end = isoDate(daysAgo(6, now));
  const start = `${year}-01-01`;
  const [past, current] = await Promise.all([
    fetchJson<RawResponse>(archiveUrl(lat, lon, `${year - REFERENCE_YEARS}-01-01`, `${year - 1}-12-31`), 30 * DAY),
    // In the first days of January the archive has nothing for this year yet (end < start → HTTP 400).
    end >= start ? fetchJson<RawResponse>(archiveUrl(lat, lon, start, end), DAY) : Promise.resolve(null),
  ]);
  return current ? mergeDaily(parseDaily(past), parseDaily(current)) : parseDaily(past);
}

/** Archive first, then recent days for dates the archive does not have yet. */
export function mergeDaily(archive: DailySeries, latest: DailySeries): DailySeries {
  const last = archive.dates[archive.dates.length - 1] ?? '';
  const out = { dates: [...archive.dates] } as DailySeries;
  // Every series stays aligned on the dates, even if one came back shorter.
  for (const k of SERIES_KEYS) out[k] = archive.dates.map((_, i) => archive[k]?.[i] ?? null);
  latest.dates.forEach((d, i) => {
    if (d <= last) return;
    out.dates.push(d);
    for (const k of SERIES_KEYS) out[k].push(latest[k]?.[i] ?? null);
  });
  return out;
}

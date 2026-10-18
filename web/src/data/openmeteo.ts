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
}

type RawDaily = Record<string, (number | null)[] | string[]>;
interface RawResponse {
  daily: RawDaily;
}

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
  };
}

export async function forecast(lat: number, lon: number): Promise<Forecast> {
  const url = `https://api.open-meteo.com/v1/forecast?${query({
    latitude: coord(lat),
    longitude: coord(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    models: MODELS.map((m) => m.id).join(','),
    timezone: 'Europe/Paris',
    forecast_days: 7,
  })}`;
  return parseForecast(await fetchJson<RawResponse>(url, 3 * HOUR));
}

/** Last 31 days up to today (best-match model analysis) — fills the archive's ~5-day lag. */
export async function recent(lat: number, lon: number): Promise<DailySeries> {
  const url = `https://api.open-meteo.com/v1/forecast?${query({
    latitude: coord(lat),
    longitude: coord(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
    timezone: 'Europe/Paris',
    past_days: 31,
    forecast_days: 1,
  })}`;
  return parseDaily(await fetchJson<RawResponse>(url, 3 * HOUR));
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
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
    timezone: 'Europe/Paris',
  })}`;
}

/** Reference years plus the current year to date (archive lags by a few days). */
export async function history(lat: number, lon: number, now = new Date()): Promise<DailySeries> {
  const year = now.getFullYear();
  const [past, current] = await Promise.all([
    fetchJson<RawResponse>(archiveUrl(lat, lon, `${year - REFERENCE_YEARS}-01-01`, `${year - 1}-12-31`), 30 * DAY),
    fetchJson<RawResponse>(archiveUrl(lat, lon, `${year}-01-01`, isoDate(daysAgo(6, now))), DAY),
  ]);
  return mergeDaily(parseDaily(past), parseDaily(current));
}

/** Archive first, then recent days for dates the archive does not have yet. */
export function mergeDaily(archive: DailySeries, latest: DailySeries): DailySeries {
  const last = archive.dates[archive.dates.length - 1] ?? '';
  const out: DailySeries = {
    dates: [...archive.dates],
    tmax: [...archive.tmax],
    tmin: [...archive.tmin],
    rain: [...archive.rain],
    et0: [...archive.et0],
  };
  latest.dates.forEach((d, i) => {
    if (d <= last) return;
    out.dates.push(d);
    out.tmax.push(latest.tmax[i] ?? null);
    out.tmin.push(latest.tmin[i] ?? null);
    out.rain.push(latest.rain[i] ?? null);
    out.et0.push(latest.et0[i] ?? null);
  });
  return out;
}

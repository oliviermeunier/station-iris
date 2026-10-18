import { DAY, daysAgo, fetchJson, isoDate, query } from './http';

const BASE = 'https://hubeau.eaufrance.fr/api';
const PAGE_SIZE = 5000;
const MAX_PAGES = 10;
/** A piezometer that has not reported for this long is considered out of service. */
const INACTIVE_AFTER_DAYS = 60;

export type Point = [date: string, value: number];

export interface PiezoStation {
  code: string;
  commune: string;
  lat: number;
  lon: number;
  /** Groundwater body measured, when Hub'Eau names it. */
  nappe: string | null;
  lastDate: string | null;
}

export interface HydroStation {
  code: string;
  name: string;
  riverLabel: string | null;
  lat: number;
  lon: number;
}

export type Grandeur = 'QmnJ' | 'HIXnJ';

interface Page<T> {
  data: T[];
  next: string | null;
}

interface RawPiezo {
  code_bss: string;
  nom_commune?: string | null;
  x: number;
  y: number;
  date_fin_mesure?: string | null;
  noms_masse_eau_edl?: string[] | null;
}

interface RawHydro {
  code_station: string;
  libelle_station: string;
  libelle_cours_eau?: string | null;
  longitude_station: number;
  latitude_station: number;
}

/** Follows Hub'Eau's `next` links; stops after MAX_PAGES. */
async function allPages<T>(firstUrl: string, ttlMs: number): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = firstUrl;
  for (let i = 0; url && i < MAX_PAGES; i++) {
    const page: Page<T> = await fetchJson<Page<T>>(url, ttlMs);
    out.push(...(page.data ?? []));
    url = page.next;
  }
  return out;
}

export function parsePiezoStations(raw: RawPiezo[], now = new Date()): PiezoStation[] {
  const cutoff = isoDate(daysAgo(INACTIVE_AFTER_DAYS, now));
  return raw
    .filter((s) => (s.date_fin_mesure ?? '') >= cutoff)
    .map((s) => ({
      code: s.code_bss,
      commune: s.nom_commune ?? '',
      lat: s.y,
      lon: s.x,
      nappe: s.noms_masse_eau_edl?.[0] ?? null,
      lastDate: s.date_fin_mesure ?? null,
    }));
}

export function parseHydroStations(raw: RawHydro[]): HydroStation[] {
  return raw.map((s) => ({
    code: s.code_station,
    name: s.libelle_station.replace(/ /g, ' '),
    riverLabel: s.libelle_cours_eau ?? null,
    lat: s.latitude_station,
    lon: s.longitude_station,
  }));
}

/** QmnJ is in L/s, HIXnJ in mm: return m³/s and m. */
export function convertHydro(raw: { date_obs_elab: string; resultat_obs_elab: number | null }[]): Point[] {
  return raw
    .filter((r) => typeof r.resultat_obs_elab === 'number' && Number.isFinite(r.resultat_obs_elab))
    .map((r) => [r.date_obs_elab.slice(0, 10), (r.resultat_obs_elab as number) / 1000]);
}

const bboxParam = (b: number[]) => b.map((x) => x.toFixed(4)).join(',');

export async function piezoStations(bbox: number[]): Promise<PiezoStation[]> {
  const url = `${BASE}/v1/niveaux_nappes/stations?${query({
    bbox: bboxParam(bbox),
    size: 200,
    fields: 'code_bss,nom_commune,x,y,date_fin_mesure,noms_masse_eau_edl',
  })}`;
  return parsePiezoStations(await allPages<RawPiezo>(url, 7 * DAY));
}

/** Depth to water (m below ground), oldest first, over the last 31 years. */
export async function piezoSeries(code: string, now = new Date()): Promise<Point[]> {
  const url = `${BASE}/v1/niveaux_nappes/chroniques?${query({
    code_bss: code,
    date_debut_mesure: `${now.getFullYear() - 31}-01-01`,
    fields: 'date_mesure,profondeur_nappe',
    size: PAGE_SIZE,
    sort: 'asc',
  })}`;
  const rows = await allPages<{ date_mesure: string; profondeur_nappe: number | null }>(url, DAY / 2);
  return rows
    .filter((r) => typeof r.profondeur_nappe === 'number')
    .map((r) => [r.date_mesure, r.profondeur_nappe as number]);
}

export async function hydroStations(bbox: number[]): Promise<HydroStation[]> {
  const url = `${BASE}/v2/hydrometrie/referentiel/stations?${query({
    bbox: bboxParam(bbox),
    en_service: true,
    size: 500,
    fields: 'code_station,libelle_station,libelle_cours_eau,longitude_station,latitude_station',
  })}`;
  return parseHydroStations(await allPages<RawHydro>(url, 7 * DAY));
}

export async function hydroSeries(code: string, grandeur: Grandeur, now = new Date()): Promise<Point[]> {
  const url = `${BASE}/v2/hydrometrie/obs_elab?${query({
    code_entite: code,
    grandeur_hydro_elab: grandeur,
    date_debut_obs_elab: `${now.getFullYear() - 30}-01-01`,
    fields: 'date_obs_elab,resultat_obs_elab',
    size: 20000,
  })}`;
  return convertHydro(
    await allPages<{ date_obs_elab: string; resultat_obs_elab: number | null }>(url, DAY / 2),
  );
}

/** Latest few days only — enough to show a value on the river profile. */
export async function hydroLatest(code: string, grandeur: Grandeur, now = new Date()): Promise<Point[]> {
  const url = `${BASE}/v2/hydrometrie/obs_elab?${query({
    code_entite: code,
    grandeur_hydro_elab: grandeur,
    date_debut_obs_elab: isoDate(daysAgo(15, now)),
    fields: 'date_obs_elab,resultat_obs_elab',
    size: 50,
  })}`;
  return convertHydro((await fetchJson<Page<{ date_obs_elab: string; resultat_obs_elab: number | null }>>(url, DAY / 4)).data ?? []);
}

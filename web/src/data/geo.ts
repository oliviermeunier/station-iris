import { DAY, fetchJson, query } from './http';

const API = 'https://geo.api.gouv.fr/communes';
const FIELDS = 'nom,code,codesPostaux,centre';

export interface Commune {
  code: string;
  nom: string;
  codesPostaux: string[];
  lat: number;
  lon: number;
}

interface RawCommune {
  code: string;
  nom: string;
  codesPostaux?: string[];
  centre?: { coordinates: [number, number] };
}

export function parseCommunes(raw: RawCommune[]): Commune[] {
  return raw
    .filter((c) => c.centre)
    .map((c) => ({
      code: c.code,
      nom: c.nom,
      codesPostaux: c.codesPostaux ?? [],
      lon: c.centre!.coordinates[0],
      lat: c.centre!.coordinates[1],
    }));
}

/** Name or postal code. */
export async function searchCommunes(q: string): Promise<Commune[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const params = /^\d{5}$/.test(term)
    ? { codePostal: term, fields: FIELDS, limit: 8 }
    : { nom: term, fields: FIELDS, boost: 'population', limit: 8 };
  return parseCommunes(await fetchJson<RawCommune[]>(`${API}?${query(params)}`, 30 * DAY));
}

export async function communeAt(lat: number, lon: number): Promise<Commune | null> {
  const url = `${API}?${query({ lat: lat.toFixed(3), lon: lon.toFixed(3), fields: FIELDS })}`;
  return parseCommunes(await fetchJson<RawCommune[]>(url, 30 * DAY))[0] ?? null;
}

export async function communeByCode(code: string): Promise<Commune | null> {
  if (!/^[0-9AB]{5}$/i.test(code)) return null;
  const raw = await fetchJson<RawCommune>(`${API}/${code}?${query({ fields: FIELDS })}`, 30 * DAY);
  return parseCommunes([raw])[0] ?? null;
}

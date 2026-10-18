import { communeAt, communeByCode, type Commune } from './data/geo';

export interface Place {
  label: string;
  lat: number;
  lon: number;
  insee?: string;
}

export type UrlPlace = { insee: string } | { lat: number; lon: number } | null;

let current: Place | null = null;

/** Two decimals ≈ 1 km: precise enough, and the exact position is never shared. */
export const round2 = (x: number) => Math.round(x * 100) / 100;

export function fromUrl(search: string): UrlPlace {
  const p = new URLSearchParams(search);
  const c = p.get('c');
  if (c && /^[0-9AB]{5}$/i.test(c)) return { insee: c.toUpperCase() };
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  if (p.has('lat') && p.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat: round2(lat), lon: round2(lon) };
  }
  return null;
}

export function placeFromCommune(c: Commune): Place {
  const cp = c.codesPostaux[0];
  return { label: cp ? `${c.nom} (${cp})` : c.nom, lat: c.lat, lon: c.lon, insee: c.code };
}

export async function resolveUrlPlace(u: UrlPlace): Promise<Place | null> {
  if (!u) return null;
  if ('insee' in u) {
    const c = await communeByCode(u.insee);
    return c ? placeFromCommune(c) : null;
  }
  const c = await communeAt(u.lat, u.lon).catch(() => null);
  return { label: c ? `Près de ${c.nom}` : 'Ma position', lat: u.lat, lon: u.lon, insee: undefined };
}

export function currentPlace(): Place | null {
  return current;
}

export function setPlace(place: Place, updateUrl = true): void {
  current = place;
  if (updateUrl) {
    const params = new URLSearchParams();
    if (place.insee) params.set('c', place.insee);
    else {
      params.set('lat', String(round2(place.lat)));
      params.set('lon', String(round2(place.lon)));
    }
    history.replaceState(null, '', `?${params}${location.hash}`);
  }
  window.dispatchEvent(new CustomEvent('iris:place', { detail: place }));
}

export class LocateError extends Error {}

/** Browser geolocation → rounded position + nearest commune name. Rejects with a readable message. */
export function locate(geo: Geolocation | undefined = globalThis.navigator?.geolocation): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!geo) {
      reject(new LocateError('La géolocalisation n’est pas disponible sur cet appareil.'));
      return;
    }
    geo.getCurrentPosition(
      async (pos) => {
        const lat = round2(pos.coords.latitude);
        const lon = round2(pos.coords.longitude);
        const c = await communeAt(lat, lon).catch(() => null);
        resolve({ label: c ? `Près de ${c.nom}` : 'Ma position', lat, lon });
      },
      (err) =>
        reject(
          new LocateError(
            err.code === 1
              ? 'Localisation refusée : cherchez plutôt votre commune.'
              : 'Position introuvable pour le moment : cherchez votre commune.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 },
    );
  });
}

import { MODELS } from './data/openmeteo';

const KEY = 'iris.sources';
const ALL = MODELS.map((m) => m.id);

/** Keeps known ids only; an empty selection falls back to every source. */
export function sanitize(ids: unknown): string[] {
  const list = Array.isArray(ids) ? ids.filter((x): x is string => ALL.includes(x as string)) : [];
  return list.length > 0 ? list : [...ALL];
}

export function selectedSources(): string[] {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return [...ALL];
  }
}

export function setSelectedSources(ids: string[]): string[] {
  const clean = sanitize(ids);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // Storage blocked: the selection lasts for this visit only.
  }
  window.dispatchEvent(new CustomEvent('iris:sources', { detail: clean }));
  return clean;
}

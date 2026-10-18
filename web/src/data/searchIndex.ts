// Search over the bundled indexes of groundwater bodies and rivers (see scripts/build-indexes.mjs).
// Loaded on demand so that the home page does not pay for them.

export interface IndexEntry {
  code: string;
  name: string;
  /** Active piezometers (aquifers) or stations in service (rivers). */
  stations: number;
}

export type IndexKind = 'nappe' | 'riviere';

const cache = new Map<IndexKind, Promise<IndexEntry[]>>();

function load(kind: IndexKind): Promise<IndexEntry[]> {
  let p = cache.get(kind);
  if (!p) {
    p = (kind === 'nappe' ? import('./index-nappes.json') : import('./index-rivieres.json')).then(
      (m) => m.default as IndexEntry[],
    );
    cache.set(kind, p);
  }
  return p;
}

/** Lower case, no accents, apostrophes and dashes as spaces. */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every word of the query must appear; names starting with the query come first. */
export function rank(entries: IndexEntry[], query: string, limit = 10): IndexEntry[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  const words = q.split(' ');
  const article = /^(la|le|les|l) /;
  return entries
    .map((e) => ({ e, n: normalise(e.name) }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort((a, b) => {
      const sa = a.n.replace(article, '').startsWith(q) ? 0 : 1;
      const sb = b.n.replace(article, '').startsWith(q) ? 0 : 1;
      return sa - sb || b.e.stations - a.e.stations;
    })
    .slice(0, limit)
    .map(({ e }) => e);
}

export async function searchIndex(kind: IndexKind, query: string): Promise<IndexEntry[]> {
  return rank(await load(kind), query);
}

export async function byCode(kind: IndexKind, code: string): Promise<IndexEntry | null> {
  return (await load(kind)).find((e) => e.code === code) ?? null;
}

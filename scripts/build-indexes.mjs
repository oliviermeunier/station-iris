// Builds the search indexes bundled with the site: groundwater bodies (from active
// piezometers) and rivers (from stations in service). Hub'Eau cannot search either by
// name, so we list them once here. Run: node scripts/build-indexes.mjs
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../web/src/data/', import.meta.url);
const ACTIVE_SINCE = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

async function allPages(url) {
  const out = [];
  let next = url;
  while (next) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(next);
      if (res.ok) {
        const page = await res.json();
        out.push(...(page.data ?? []));
        next = page.next;
        break;
      }
      if (attempt >= 3) throw new Error(`HTTP ${res.status} for ${next}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
    process.stdout.write('.');
  }
  return out;
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Hub'Eau refuses to page past 20 000 results: query department by department.
const DEPARTMENTS = [
  ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')).filter((d) => d !== '20'),
  '2A', '2B', '971', '972', '973', '974', '976',
];
const piezos = [];
for (let i = 0; i < DEPARTMENTS.length; i += 6) {
  const batch = await Promise.all(
    DEPARTMENTS.slice(i, i + 6).map((dep) =>
      allPages(
        `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations?code_departement=${dep}&size=5000&fields=code_bss,date_fin_mesure,codes_masse_eau_edl,noms_masse_eau_edl`,
      ),
    ),
  );
  piezos.push(...batch.flat());
}
const nappes = new Map();
for (const s of piezos) {
  if ((s.date_fin_mesure ?? '') < ACTIVE_SINCE) continue;
  (s.codes_masse_eau_edl ?? []).forEach((code, i) => {
    const name = s.noms_masse_eau_edl?.[i];
    if (!code || !name) return;
    const e = nappes.get(code) ?? { code, name, stations: 0 };
    e.stations += 1;
    nappes.set(code, e);
  });
}

const hydros = await allPages(
  'https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?size=5000&en_service=true&fields=code_station,code_cours_eau,libelle_cours_eau',
);
const rivers = new Map();
for (const s of hydros) {
  if (!s.code_cours_eau || !s.libelle_cours_eau) continue;
  const e = rivers.get(s.code_cours_eau) ?? { code: s.code_cours_eau, name: capitalise(s.libelle_cours_eau.trim()), stations: 0 };
  e.stations += 1;
  rivers.set(s.code_cours_eau, e);
}

const sorted = (m) => [...m.values()].sort((a, b) => b.stations - a.stations || a.name.localeCompare(b.name, 'fr'));
await writeFile(new URL('index-nappes.json', OUT), JSON.stringify(sorted(nappes)));
await writeFile(new URL('index-rivieres.json', OUT), JSON.stringify(sorted(rivers)));
console.log(`\n${nappes.size} nappes (${piezos.length} piézomètres), ${rivers.size} rivières (${hydros.length} stations)`);

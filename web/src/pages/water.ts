import { RADIUS_KM } from '../config';
import { distanceKm, type Position, type RiverStation } from '../core';
import { byCode } from '../data/searchIndex';
import { routeHref } from '../router';
import type { PiezoStation } from '../data/hubeau';
import type { Place } from '../location';
import {
  bandFor,
  loadPiezoDetail,
  loadPiezoStations,
  loadRiverDetail,
  loadRiverLatest,
  loadRivers,
  loadWholeRiver,
  riverLevel,
  type NearbyRiver,
  type RiverLevel,
  loadNappe,
  loadRiverStations,
  type Located,
  type PiezoDetail,
  type RiverDetail,
  type RiverLatest,
} from '../store';
import { dateLabel, depth, escapeHtml, km, num, placePhrase, positionLabel, positionShort, stationParts } from '../text';
import { h, section } from '../ui/dom';
import { envelopeChart } from '../ui/envelopeChart';
import { stationMap } from '../ui/map';
import { waterSearch } from '../ui/waterSearch';
import { tube } from '../ui/tube';
import { pageTitle, sectionShell } from './common';

const MAX_PIEZOS = 6;

/** Groundwater page: piezometers around the place, or every piezometer of a searched aquifer. */
export function renderNappes(main: HTMLElement, place: Place | null, params: URLSearchParams): void {
  const search = waterSearch('nappe');
  const code = params.get('nappe');
  if (code) return void renderNappeView(main, search, code, place);
  if (!place) return void main.replaceChildren(pageTitle('nappes', 'Nappes'), search);
  const body = h('div');
  main.replaceChildren(
    pageTitle('nappes', `Nappes ${placeHtml(place)}`),
    search,
    sectionShell('Piézomètres proches', '--earth', body),
  );
  void section(body, 'Recherche des piézomètres…', () => nappeSection(place));
}

/** River page: stations around the place, or the whole profile of a searched river. */
export function renderRivers(main: HTMLElement, place: Place | null, params: URLSearchParams): void {
  const search = waterSearch('riviere');
  const code = params.get('riviere');
  if (code) return void renderRiverView(main, search, code, place);
  if (!place) return void main.replaceChildren(pageTitle('rivieres', 'Rivières'), search);
  const body = h('div');
  main.replaceChildren(pageTitle('rivieres', `Rivières ${placeHtml(place)}`), search, body);
  void section(body, 'Recherche des rivières proches…', () => riverSection(place));
}

function placeHtml(place: Place): string {
  const [prep, name] = placePhrase(place.label, 'autour de');
  return `${prep} <em>${escapeHtml(name)}</em>`;
}

function backLink(place: Place | null, route: 'nappes' | 'rivieres'): HTMLElement | null {
  return place ? h('p.note', {}, h('a', { href: routeHref(route) }, `← Revenir ${placePhrase(place.label, 'autour de').join(' ')}`)) : null;
}

async function renderNappeView(main: HTMLElement, search: HTMLElement, code: string, place: Place | null): Promise<void> {
  const body = h('div');
  const entry = await byCode('nappe', code).catch(() => null);
  const title = entry?.name ?? code;
  main.replaceChildren(
    pageTitle('nappes', `Nappe : <em>${escapeHtml(title)}</em>`),
    backLink(place, 'nappes') ?? '',
    search,
    sectionShell('Piézomètres de cette nappe', '--earth', body),
  );
  void section(body, 'Recherche des piézomètres de cette nappe…', async () => {
    const stations = await loadNappe(code);
    if (stations.length === 0) return [h('p.empty', {}, 'Aucun piézomètre en service ne mesure cette nappe aujourd’hui.')];
    const list = stations
      .map((item) => ({ item, km: place ? distanceKm(place, item) : null }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.item.commune.localeCompare(b.item.commune, 'fr'));
    const many = stations.length > MAX_FILLED;
    const intro = h(
      'p.note',
      {},
      `${stations.length} piézomètre${stations.length > 1 ? 's' : ''} en service ${stations.length > 1 ? 'mesurent' : 'mesure'} cette nappe. ` +
        (many ? `Les réservoirs des ${MAX_FILLED} premiers se remplissent automatiquement ; cliquez sur un autre pour l’afficher.` : 'Cliquez sur un réservoir pour voir son historique.'),
    );
    return piezoExplorer(null, list, intro);
  });
}

async function renderRiverView(main: HTMLElement, search: HTMLElement, code: string, place: Place | null): Promise<void> {
  const body = h('div');
  const entry = await byCode('riviere', code).catch(() => null);
  const title = entry?.name ?? code;
  main.replaceChildren(
    pageTitle('rivieres', `Rivière : <em>${escapeHtml(title)}</em>`),
    backLink(place, 'rivieres') ?? '',
    search,
    sectionShell('Stations de mesure, de l’amont vers l’aval', '--river', body),
  );
  void section(body, 'Recherche des stations de cette rivière…', async () => {
    const stations = await loadRiverStations(code);
    if (stations.length === 0) return [h('p.empty', {}, 'Aucune station en service sur cette rivière.')];
    const near = place ? [...stations].sort((a, b) => distanceKm(place, a) - distanceKm(place, b))[0]! : stations[0]!;
    return riverExplorer(null, stations, title, near.code);
  });
}

// ---------- groundwater ----------

function piezoLabel(s: PiezoStation): string {
  return s.commune ? `${s.commune}` : s.code;
}

async function nappeSection(place: Place): Promise<(Node | null)[]> {
  const { inRadius, nearestBeyond } = await loadPiezoStations(place);
  const list: Located<PiezoStation>[] = inRadius.length ? inRadius.slice(0, MAX_PIEZOS) : nearestBeyond ? [nearestBeyond] : [];
  if (list.length === 0) return [h('p.empty', {}, 'Aucun piézomètre en service trouvé à proximité.')];
  const intro = h(
    'p.note',
    {},
    inRadius.length
      ? `${inRadius.length} piézomètre${inRadius.length > 1 ? 's' : ''} en service à moins de ${RADIUS_KM} km. Cliquez sur un réservoir de la carte pour l’afficher.`
      : `Aucun piézomètre en service à moins de ${RADIUS_KM} km. Le plus proche est à ${km(nearestBeyond!.km)} : il mesure peut-être une autre nappe que celle sous vos pieds.`,
  );
  return piezoExplorer(place, list, intro);
}

/** Reservoirs filled automatically on a map; the others load when clicked. */
const MAX_FILLED = 25;

/** Map of piezometers (mini reservoirs fill in as data arrives) + detail of the selected one. */
function piezoExplorer(place: Place | null, list: { item: PiezoStation; km: number | null }[], intro: Node): (Node | null)[] {
  const detailBox = h('div');
  const markerEls = new Map<string, HTMLElement>();
  const markers = list.map((l) => {
    const html = h('div', {}, h('div.marker-label', {}, piezoLabel(l.item)), tube({ fill: null, size: 'mini' }));
    markerEls.set(l.item.code, html);
    return { id: l.item.code, lat: l.item.lat, lon: l.item.lon, html, title: l.item.nappe ?? l.item.code };
  });
  const fillMarker = (item: PiezoStation) =>
    loadPiezoDetail(item)
      .then((d) => {
        const label = d.position ? positionShort(d.position, 'nappe') : '—';
        markerEls.get(item.code)?.replaceChildren(h('div.marker-label', {}, `${piezoLabel(item)} · ${label}`), tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }));
      })
      .catch(() => undefined);

  const show = (code: string) => {
    const l = list.find((x) => x.item.code === code);
    if (!l) return;
    map.highlight(code);
    void fillMarker(l.item);
    void section(detailBox, 'Chargement des mesures…', async () => piezoDetail(await loadPiezoDetail(l.item), l.km));
  };
  const map = stationMap(place, markers, { onSelect: show });

  // Fill the first reservoirs three at a time, to stay gentle with Hub'Eau.
  const queue = list.slice(0, MAX_FILLED).map((l) => l.item);
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await fillMarker(item);
  };
  void Promise.all([worker(), worker(), worker()]);

  show(list[0]!.item.code);
  return [intro, h('div.grid-2', {}, map.el, detailBox)];
}

function piezoDetail(d: PiezoDetail, distance: number | null): (Node | null)[] {
  const s = d.station;
  if (!d.latest) return [h('p.empty', {}, 'Pas de mesure récente pour ce piézomètre.')];
  const where = `${s.commune || s.code}${s.nappe ? ` — ${s.nappe}` : ''}`;
  const verdict = d.position
    ? `Nappe <strong>${positionLabel(d.position, 'nappe')}</strong> pour la mi-${monthName(d.latest[0])} : l’eau est à <strong>${depth(d.latest[1])}</strong>.`
    : `L’eau est à <strong>${depth(d.latest[1])}</strong> (pas assez d’années pour comparer).`;
  return [
    h('p.verdict', { html: verdict }),
    h(
      'div.reservoir',
      {},
      tube({ fill: d.fill, mean: d.meanFill, size: 'full' }),
      h(
        'div.tube-legend',
        {},
        h('div', {}, h('b', {}, where)),
        h('div', {}, `${distance !== null ? `à ${km(distance)} · ` : ''}mesure du ${dateLabel(d.latest[0])}`),
        d.env ? h('div', {}, `le plus haut connu : ${depth(d.env.min)}`) : null,
        h('div', {}, h('b', {}, `aujourd’hui : ${depth(d.latest[1])}`)),
        d.env ? h('div', {}, `moyenne : ${depth(d.env.mean)} (pointillés)`) : null,
        d.env ? h('div', {}, `le plus bas connu : ${depth(d.env.max)}`) : null,
        d.env ? h('div.note', {}, `à cette date (±3 jours), sur ${d.env.years} an${d.env.years > 1 ? 's' : ''}`) : null,
      ),
    ),
    h('h3', {}, 'Historique'),
    envelopeChart({
      series: d.series,
      band: bandFor(d.series),
      unit: 'm sous le sol',
      digits: 2,
      color: '--water',
      bandColor: '--band',
      invert: true,
      seriesName: 'mesures',
      initialDays: 366,
    }),
  ];
}

function monthName(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long' });
}

// ---------- rivers ----------

function riverValue(r: RiverLatest | RiverDetail | undefined): string {
  if (!r?.latest) return '—';
  return r.grandeur === 'QmnJ' ? `${num(r.latest[1], r.latest[1] < 10 ? 2 : 1)} m³/s` : `${num(r.latest[1], 2)} m`;
}

function shortName(s: RiverStation): string {
  return stationParts(s.name).place;
}

/** Hover card of a station on the river map. */
function stationTip(s: RiverStation, riverLabel: string, r: RiverLatest | RiverDetail | null, position: Position | null): string {
  const { place, detail } = stationParts(s.name);
  const value = !r ? 'chargement…' : !r.latest ? 'pas de mesure récente' : `${r.grandeur === 'QmnJ' ? 'débit' : 'hauteur'} <b>${riverValue(r)}</b>`;
  const level = position ? ` · ${positionShort(position, 'debit').toLowerCase()}` : '';
  return `<b>${escapeHtml(place)}</b>${detail ? `<br><span class="note">${escapeHtml(detail)}</span>` : ''}<br>${escapeHtml(riverLabel)}<br>${value}${level}`;
}

async function riverSection(place: Place): Promise<(Node | null)[]> {
  const rivers = await loadRivers(place);
  if (rivers.length === 0) return [h('p.empty', {}, 'Aucune station de mesure des rivières trouvée à proximité.')];
  const chosen = h('div');
  const cards = rivers.map((r) => {
    const card = riverCard(r, () => choose(r, card));
    return card;
  });
  const choose = (r: NearbyRiver, card: HTMLElement) => {
    for (const c of cards) c.setAttribute('aria-pressed', String(c === card));
    void section(chosen, 'Recherche des stations de cette rivière…', async () => {
      const stations = await loadWholeRiver(r);
      return [sectionShell(r.name, '--river', ...riverExplorer(place, stations, r.name, r.stations[0]!.item.code))];
    });
  };
  choose(rivers[0]!, cards[0]!);
  return [
    sectionShell(
      rivers.length > 1 ? `${rivers.length} rivières près de chez vous` : 'La rivière la plus proche',
      '--river',
      h('p.note', {}, 'Choisissez une rivière pour voir toutes ses stations de mesure, de la source vers l’aval.'),
      h('div.river-cards', {}, cards),
    ),
    chosen,
  ];
}

/** Nearby river, with its level from the flow stations closest to the place. */
function riverCard(r: NearbyRiver, onPick: () => void): HTMLElement {
  const near = r.stations.filter((l) => l.km <= RADIUS_KM).length;
  const level = h('div.river-card-level', {}, h('span.loading', {}, 'niveau…'));
  const card = h(
    'button.river-card',
    { type: 'button', 'aria-pressed': false, onclick: onPick },
    h('b', {}, r.name),
    h('span.note', {}, near ? `${near} station${near > 1 ? 's' : ''} à moins de ${RADIUS_KM} km` : `station la plus proche à ${km(r.stations[0]!.km)}`),
    level,
  );
  const positions: Position[] = [];
  const nearest = r.stations.slice(0, 6).map((l) => l.item.code);
  void Promise.all(
    nearest.map(async (code) => {
      const latest = await loadRiverLatest(code).catch(() => null);
      if (latest?.grandeur !== 'QmnJ') return;
      const d = await loadRiverDetail(code).catch(() => null);
      if (d?.position) positions.push(d.position);
    }),
  ).then(() => {
    const lv = riverLevel(positions);
    level.replaceChildren(
      lv.position
        ? h('span', {}, h('span', { class: `lv-dot lv-${lv.position}` }), `Débit ${positionShort(lv.position, 'debit').toLowerCase()}`)
        : h('span.note', {}, 'hauteur seulement'),
    );
  });
  return card;
}

/** Overall level of a river, from all its flow stations. */
function levelView(lv: RiverLevel, done: number, of: number): Node {
  const loading = done < of ? ` (calcul : ${done} stations sur ${of})` : '';
  if (!lv.position) {
    return done < of
      ? h('p.note', {}, `Calcul du niveau de la rivière${loading}…`)
      : h('p.note', {}, 'Pas de niveau d’ensemble : les stations de cette rivière ne publient que la hauteur d’eau, qui ne se compare pas d’une année à l’autre.');
  }
  const order: Position[] = ['belowAll', 'low', 'normal', 'high', 'aboveAll'];
  const shown = order.filter((p) => lv.counts[p] > 0);
  return h(
    'div.river-level',
    {},
    h('div', { html: `Niveau d’ensemble de la rivière : <strong>débit ${positionShort(lv.position, 'debit').toLowerCase()}</strong> pour la saison${loading}.` }),
    h('div.lv-bar', {}, shown.map((p) => h('span', { class: `lv-${p}`, style: `flex:${lv.counts[p]}`, title: `${positionShort(p, 'debit')} : ${lv.counts[p]}` }))),
    h(
      'div.note',
      {},
      `D’après ${lv.total} station${lv.total > 1 ? 's' : ''} qui mesure${lv.total > 1 ? 'nt' : ''} le débit : ` +
        shown.map((p) => `${positionShort(p, 'debit').toLowerCase()} ${lv.counts[p]}`).join(' · '),
    ),
  );
}

/** One river: upstream→downstream profile, its overall level, a map of its stations and the selected one's detail. */
function riverExplorer(place: Place | null, stations: RiverStation[], riverLabel: string, firstCode: string): (Node | null)[] {
  const shown = new Map(stations.map((s) => [s.code, s]));
  const gaugeEls = new Map<string, HTMLElement>();
  const detailBox = h('div');

  let selected: string | null = null;
  const highlight = (code: string | null) => {
    map.highlight(code ?? selected);
    for (const [c, g] of gaugeEls) g.classList.toggle('hl', c === (code ?? selected));
  };
  const select = (code: string) => {
    selected = code;
    highlight(code);
    const s = shown.get(code)!;
    void section(detailBox, 'Chargement de l’historique…', async () => riverDetail(s, riverLabel, await loadRiverDetail(code)));
  };

  const markers = stations.map((s) => ({ id: s.code, lat: s.lat, lon: s.lon, title: s.name, tip: stationTip(s, riverLabel, null, null) }));
  const map = stationMap(place, markers, { onHover: highlight, onSelect: select }, { zoomIn: 1 });

  const gauges = stations.map((s) => {
    const g = h(
      'div.gauge',
      { tabindex: 0, onmouseenter: () => highlight(s.code), onmouseleave: () => highlight(null), onclick: () => select(s.code) },
      h('div.gauge-top', {}, h('span.loading', {}, '…')),
      h('div.flow-line'),
      h('div.gauge-label', { title: s.name }, shortName(s)),
      h('div.gauge-detail', { title: s.name }, stationParts(s.name).detail),
      h('div.day-sub', {}, '…'),
    );
    gaugeEls.set(s.code, g);
    return g;
  });

  const levelBox = h('div');
  const positions: Position[] = [];
  let done = 0;
  const drawLevel = () => levelBox.replaceChildren(levelView(riverLevel(positions), done, stations.length));
  drawLevel();

  const loadOne = async (s: RiverStation) => {
    try {
      await loadStation(s);
    } finally {
      done += 1;
      drawLevel();
    }
  };
  const loadStation = async (s: RiverStation) => {
    const g = gaugeEls.get(s.code);
    try {
      const r = await loadRiverLatest(s.code);
      map.update(s.code, stationTip(s, riverLabel, r, null), r.grandeur === 'QmnJ' ? 'flow' : 'stage');
      if (g) {
        g.children[0]!.replaceChildren(h('b', {}, riverValue(r)));
        g.children[4]!.textContent = r.grandeur === 'QmnJ' ? 'débit' : 'hauteur';
      }
      if (r.grandeur !== 'QmnJ') return;
      // Flow stations get a mini reservoir and a coloured dot once their history is known.
      const d = await loadRiverDetail(s.code);
      if (d.position) positions.push(d.position);
      map.update(s.code, stationTip(s, riverLabel, d, d.position), d.position ? `flow lv-${d.position}` : 'flow');
      if (d.fill === null) return;
      g?.children[0]!.replaceChildren(tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }), h('b', {}, riverValue(d)));
    } catch {
      map.update(s.code, stationTip(s, riverLabel, { grandeur: 'HIXnJ', latest: null }, null), 'stage');
    }
  };
  // A few stations at a time: a whole river can have dozens.
  const queue = [...stations];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) await loadOne(s);
  };
  void Promise.all([worker(), worker(), worker()]);

  select(firstCode);
  return [
    levelBox,
    h('div', {}, h('div.profile-river', {}, `${riverLabel}, de l’amont (à gauche) vers l’aval`), h('div.profile', {}, gauges)),
    h('div.grid-2', {}, map.el, detailBox),
  ];
}

function riverDetail(s: RiverStation, riverLabel: string, d: RiverDetail): (Node | null)[] {
  if (!d.latest) return [h('p.verdict', {}, `${s.name} (${riverLabel}) : pas de mesure récente.`)];
  const isFlow = d.grandeur === 'QmnJ';
  const head = isFlow
    ? d.position
      ? `Débit <strong>${positionLabel(d.position, 'debit')}</strong> pour la saison : <strong>${riverValue(d)}</strong> le ${dateLabel(d.latest[0])}.`
      : `Débit : <strong>${riverValue(d)}</strong> le ${dateLabel(d.latest[0])}.`
    : `Hauteur : <strong>${riverValue(d)}</strong> le ${dateLabel(d.latest[0])}.`;
  return [
    h('p.verdict', { html: `<b>${escapeHtml(s.name)}</b><br><span class="note">Rivière : ${escapeHtml(riverLabel)}</span><br>${head}` }),
    isFlow && d.env
      ? h(
          'div.reservoir',
          {},
          tube({ fill: d.fill, mean: d.meanFill, size: 'full' }),
          h(
            'div.tube-legend',
            {},
            h('div', {}, `le plus fort connu : ${num(d.env.max, 2)} m³/s`),
            h('div', {}, h('b', {}, `aujourd’hui : ${riverValue(d)}`)),
            h('div', {}, `moyenne : ${num(d.env.mean, 2)} m³/s (pointillés)`),
            h('div', {}, `le plus faible connu : ${num(d.env.min, 2)} m³/s`),
            h('div.note', {}, `à cette date (±3 jours), sur ${d.env.years} ans`),
          ),
        )
      : isFlow
        ? h('p.note', {}, 'Pas assez d’années de mesures à cette date pour comparer ce débit aux années précédentes.')
        : h('p.note', {}, 'Cette station ne publie que la hauteur d’eau. Elle peut être réglée par un barrage ou une écluse : c’est un repère, pas un indicateur de sécheresse, donc pas de comparaison aux années précédentes.'),
    h('h3', {}, 'Historique'),
    envelopeChart({
      series: d.series,
      band: isFlow ? bandFor(d.series) : [],
      unit: isFlow ? 'm³/s' : 'm',
      digits: 2,
      color: '--river',
      bandColor: '--band',
      seriesName: isFlow ? 'débit' : 'hauteur',
      initialDays: 366,
    }),
  ];
}

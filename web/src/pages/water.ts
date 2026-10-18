import { RADIUS_KM } from '../config';
import { distanceKm, type RiverStation } from '../core';
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
  loadNappe,
  loadRiverStations,
  type Located,
  type PiezoDetail,
  type RiverDetail,
  type RiverLatest,
} from '../store';
import { dateLabel, depth, escapeHtml, km, num, positionLabel, positionShort } from '../text';
import { h, section } from '../ui/dom';
import { envelopeChart } from '../ui/envelopeChart';
import { stationMap } from '../ui/map';
import { waterSearch } from '../ui/waterSearch';
import { tube } from '../ui/tube';
import { sectionShell } from './common';

const MAX_PIEZOS = 6;

/** Groundwater page: piezometers around the place, or every piezometer of a searched aquifer. */
export function renderNappes(main: HTMLElement, place: Place | null, params: URLSearchParams): void {
  const search = waterSearch('nappe');
  const code = params.get('nappe');
  if (code) return void renderNappeView(main, search, code, place);
  if (!place) return void main.replaceChildren(h('h1.headline', {}, 'Nappes'), search);
  const body = h('div');
  main.replaceChildren(
    h('h1.headline', { html: `Nappes autour de <em>${escapeHtml(place.label)}</em>` }),
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
  if (!place) return void main.replaceChildren(h('h1.headline', {}, 'Rivières'), search);
  const body = h('div');
  main.replaceChildren(
    h('h1.headline', { html: `Rivières autour de <em>${escapeHtml(place.label)}</em>` }),
    search,
    sectionShell('Stations de mesure', '--river', body),
  );
  void section(body, 'Recherche des stations de rivière…', () => riverSection(place));
}

function backLink(place: Place | null, route: 'nappes' | 'rivieres'): HTMLElement | null {
  return place ? h('p.note', {}, h('a', { href: routeHref(route) }, `← Revenir autour de ${place.label}`)) : null;
}

async function renderNappeView(main: HTMLElement, search: HTMLElement, code: string, place: Place | null): Promise<void> {
  const body = h('div');
  const entry = await byCode('nappe', code).catch(() => null);
  const title = entry?.name ?? code;
  main.replaceChildren(
    h('h1.headline', { html: `Nappe : <em>${escapeHtml(title)}</em>` }),
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
    h('h1.headline', { html: `Rivière : <em>${escapeHtml(title)}</em>` }),
    backLink(place, 'rivieres') ?? '',
    search,
    sectionShell('Stations de mesure, de l’amont vers l’aval', '--river', body),
  );
  void section(body, 'Recherche des stations de cette rivière…', async () => {
    const stations = await loadRiverStations(code);
    if (stations.length === 0) return [h('p.empty', {}, 'Aucune station en service sur cette rivière.')];
    const near = place ? [...stations].sort((a, b) => distanceKm(place, a) - distanceKm(place, b))[0]! : stations[0]!;
    return riverExplorer(null, stations, stations, title, near.code);
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
  const i = s.name.search(/\s(à|au|aux)\s/);
  return i > 0 ? s.name.slice(i).replace(/^\s(à|au|aux)\s/, '') : s.name;
}

async function riverSection(place: Place): Promise<(Node | null)[]> {
  const rivers = await loadRivers(place);
  const shown = new Map<string, RiverStation>();
  for (const s of rivers.profile) shown.set(s.code, s);
  for (const l of rivers.inRadius) shown.set(l.item.code, l.item);
  if (shown.size === 0 && rivers.nearestBeyond) shown.set(rivers.nearestBeyond.item.code, rivers.nearestBeyond.item);
  if (shown.size === 0) return [h('p.empty', {}, 'Aucune station de mesure des rivières trouvée à proximité.')];
  const kmOf = (code: string) => rivers.inRadius.find((l) => l.item.code === code)?.km ?? 99;
  const first = rivers.profile.length ? [...rivers.profile].sort((a, b) => kmOf(a.code) - kmOf(b.code))[0]! : [...shown.values()][0]!;
  const label = rivers.profileRiverLabel;
  return riverExplorer(place, [...shown.values()], rivers.profile, label ? label.charAt(0).toUpperCase() + label.slice(1) : 'La rivière la plus proche', first.code);
}

/** Upstream→downstream profile linked to a map of stations, plus the selected station's detail. */
function riverExplorer(
  place: Place | null,
  shownList: RiverStation[],
  profile: RiverStation[],
  profileLabel: string,
  firstCode: string,
): (Node | null)[] {
  const shown = new Map(shownList.map((s) => [s.code, s]));
  const markerEls = new Map<string, HTMLElement>();
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
    void section(detailBox, 'Chargement de l’historique…', async () => riverDetail(s, await loadRiverDetail(code)));
  };

  const markers = shownList.map((s) => {
    const html = h('div', {}, h('div.marker-label', {}, `${shortName(s)} · …`), h('div.marker-dot'));
    markerEls.set(s.code, html);
    return { id: s.code, lat: s.lat, lon: s.lon, html, title: s.name };
  });
  const map = stationMap(place, markers, { onHover: highlight, onSelect: select });

  const gauges = profile.map((s) => {
    const g = h(
      'div.gauge',
      { tabindex: 0, onmouseenter: () => highlight(s.code), onmouseleave: () => highlight(null), onclick: () => select(s.code) },
      h('div', { style: 'height:44px;display:flex;align-items:flex-end;justify-content:center' }, h('span.loading', {}, '…')),
      h('div.flow-line'),
      h('div.gauge-label', { title: s.name }, shortName(s)),
      h('div.day-sub', {}, '…'),
    );
    gaugeEls.set(s.code, g);
    return g;
  });

  const loadOne = async (s: RiverStation) => {
    const m = markerEls.get(s.code);
    const g = gaugeEls.get(s.code);
    try {
      const r = await loadRiverLatest(s.code);
      m?.replaceChildren(h('div.marker-label', {}, `${shortName(s)} · ${riverValue(r)}`), h('div.marker-dot'));
      if (g) {
        g.children[0]!.replaceChildren(h('b', {}, riverValue(r)));
        g.children[3]!.textContent = r.grandeur === 'QmnJ' ? 'débit' : 'hauteur';
      }
      if (r.grandeur !== 'QmnJ') return;
      // Flow stations get a mini reservoir once their history is known.
      const d = await loadRiverDetail(s.code);
      if (d.fill === null) return;
      g?.children[0]!.replaceChildren(h('div', {}, h('b', {}, riverValue(d))), tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }));
      m?.replaceChildren(h('div.marker-label', {}, `${shortName(s)} · ${riverValue(d)}`), tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }));
    } catch {
      m?.replaceChildren(h('div.marker-label', {}, `${shortName(s)} · —`), h('div.marker-dot'));
    }
  };
  // A few stations at a time: a whole river can have dozens.
  const queue = [...shownList];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) await loadOne(s);
  };
  void Promise.all([worker(), worker(), worker()]);

  select(firstCode);
  return [
    profile.length ? h('div', {}, h('div.profile-river', {}, `${profileLabel}, de l’amont (à gauche) vers l’aval`), h('div.profile', {}, gauges)) : null,
    h('div.grid-2', {}, map.el, detailBox),
  ];
}

function riverDetail(s: RiverStation, d: RiverDetail): (Node | null)[] {
  if (!d.latest) return [h('p.verdict', {}, `${s.name} : pas de mesure récente.`)];
  const isFlow = d.grandeur === 'QmnJ';
  const head = isFlow
    ? d.position
      ? `Débit <strong>${positionLabel(d.position, 'debit')}</strong> pour la saison : <strong>${riverValue(d)}</strong> le ${dateLabel(d.latest[0])}.`
      : `Débit : <strong>${riverValue(d)}</strong> le ${dateLabel(d.latest[0])}.`
    : `Hauteur : <strong>${riverValue(d)}</strong> le ${dateLabel(d.latest[0])}.`;
  return [
    h('p.verdict', { html: `<b>${escapeHtml(s.name)}</b><br>${head}` }),
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

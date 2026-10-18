import { RADIUS_KM } from '../config';
import { waterBalance, type RiverStation } from '../core';
import type { PiezoStation } from '../data/hubeau';
import type { Place } from '../location';
import { selectedSources } from '../sources';
import {
  bandFor,
  cumulativeByYear,
  loadPiezoDetail,
  loadPiezoStations,
  loadRiverDetail,
  loadRiverLatest,
  loadRivers,
  loadWeather,
  points,
  type Located,
  type PiezoDetail,
  type RiverDetail,
  type RiverLatest,
} from '../store';
import { dateLabel, dayName, depth, escapeHtml, km, mm, num, positionLabel, positionShort } from '../text';
import { h, section } from '../ui/dom';
import { envelopeChart } from '../ui/envelopeChart';
import { stationMap } from '../ui/map';
import { sourcePicker } from '../ui/sourcePicker';
import { tube } from '../ui/tube';
import { rainWeek, weekData } from '../ui/week';
import { sectionShell } from './common';

const MAX_PIEZOS = 6;

export function renderWater(main: HTMLElement, place: Place): void {
  const rain = h('div');
  const nappe = h('div');
  const river = h('div');
  main.replaceChildren(
    h('h1.headline', { html: `L’eau autour de <em>${escapeHtml(place.label)}</em>` }),
    sectionShell('Pluie', '--rain', rain),
    sectionShell('Nappe', '--earth', nappe),
    sectionShell('Rivière', '--river', river),
  );
  void section(rain, 'Chargement de la pluie…', () => rainSection(place));
  void section(nappe, 'Recherche des piézomètres…', () => nappeSection(place));
  void section(river, 'Recherche des stations de rivière…', () => riverSection(place));
}

// ---------- rain ----------

async function rainSection(place: Place): Promise<Node[]> {
  const w = await loadWeather(place);
  const week = h('div');
  const verdict = h('p.verdict');
  const draw = () => {
    const sel = selectedSources();
    const data = weekData(w.forecast, sel);
    const total = data.rain.reduce((s, d) => s + (d.mean ?? 0), 0);
    const rainiest = [...data.rain].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))[0];
    verdict.innerHTML =
      rainiest && (rainiest.mean ?? 0) >= 1
        ? `<strong>${mm(total)}</strong> attendus sur 7 jours, surtout <strong>${dayName(rainiest.date, 'long')}</strong> (${rainiest.rainy} source${rainiest.rainy > 1 ? 's' : ''} sur ${rainiest.sources} prévoient de la pluie ce jour-là).`
        : `<strong>Pas de pluie notable</strong> prévue sur 7 jours (${mm(total)} au total).`;
    week.replaceChildren(rainWeek(w.forecast, sel));
  };
  draw();
  window.addEventListener('iris:sources', function redraw() {
    if (!week.isConnected) return window.removeEventListener('iris:sources', redraw);
    draw();
  });

  // Drought indicator on observed days.
  const days: [string, number | null, number | null][] = w.daily.dates.map((d, i) => [d, w.daily.rain[i] ?? null, w.daily.et0[i] ?? null]);
  const lastComplete = [...days].reverse().find(([, r, e]) => r !== null && e !== null)?.[0];
  const balances = lastComplete ? [7, 30].map((n) => waterBalance(days, lastComplete, n)) : [];
  const balanceRow = h(
    'div.grid-2',
    {},
    balances.map((b) =>
      h(
        'div.card',
        {},
        h('div.kicker', {}, `Bilan ${b.window_days} derniers jours`),
        h('div.tile-value', {}, `${b.balance > 0 ? '+' : ''}${num(b.balance, 1)} mm`),
        h('div.tile-note', {}, `pluie ${mm(b.rain)} − évaporation ${mm(b.et0)}`),
      ),
    ),
  );

  const daily = points(w.daily.dates, w.daily.rain);
  const cumul = cumulativeByYear(daily);
  return [
    verdict,
    sourcePicker(),
    week,
    h('h3', {}, 'Sécheresse'),
    balanceRow,
    h('p.note', {}, 'Pluie moins évaporation d’un gazon de référence (ETP) : négatif = les sols se dessèchent. C’est un indicateur, pas une mesure de l’eau dans votre sol.'),
    h('h3', {}, 'Pluie cumulée depuis le 1er janvier'),
    envelopeChart({ series: cumul, band: bandFor(cumul, 0), unit: 'mm', digits: 0, color: '--rain', bandColor: '--band', seriesName: 'cette année', initialDays: 366, yearly: true }),
  ];
}

// ---------- groundwater ----------

function piezoLabel(s: PiezoStation): string {
  return s.commune ? `${s.commune}` : s.code;
}

async function nappeSection(place: Place): Promise<(Node | null)[]> {
  const { inRadius, nearestBeyond } = await loadPiezoStations(place);
  const list: Located<PiezoStation>[] = inRadius.length ? inRadius.slice(0, MAX_PIEZOS) : nearestBeyond ? [nearestBeyond] : [];
  if (list.length === 0) return [h('p.empty', {}, 'Aucun piézomètre en service trouvé à proximité.')];

  const intro = inRadius.length
    ? h('p.note', {}, `${inRadius.length} piézomètre${inRadius.length > 1 ? 's' : ''} en service à moins de ${RADIUS_KM} km. Cliquez sur un réservoir de la carte pour l’afficher.`)
    : h('p.note', {}, `Aucun piézomètre en service à moins de ${RADIUS_KM} km. Le plus proche est à ${km(nearestBeyond!.km)} : il mesure peut-être une autre nappe que celle sous vos pieds.`);

  const detailBox = h('div');
  const markerEls = new Map<string, HTMLElement>();
  const markers = list.map((l) => {
    const html = h('div', {}, h('div.marker-label', {}, piezoLabel(l.item)), tube({ fill: null, size: 'mini' }));
    markerEls.set(l.item.code, html);
    return { id: l.item.code, lat: l.item.lat, lon: l.item.lon, html, title: l.item.nappe ?? l.item.code };
  });

  const show = (code: string) => {
    const l = list.find((x) => x.item.code === code);
    if (!l) return;
    map.highlight(code);
    void section(detailBox, 'Chargement des mesures…', async () => piezoDetail(await loadPiezoDetail(l.item, l.km)));
  };
  const map = stationMap(place, markers, { onSelect: show });

  // Fill each mini reservoir as its history arrives.
  for (const l of list) {
    loadPiezoDetail(l.item, l.km)
      .then((d) => {
        const el = markerEls.get(l.item.code);
        if (!el) return;
        const label = d.position ? positionShort(d.position, 'nappe') : '—';
        el.replaceChildren(h('div.marker-label', {}, `${piezoLabel(l.item)} · ${label}`), tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }));
      })
      .catch(() => undefined);
  }
  show(list[0]!.item.code);
  return [intro, h('div.grid-2', {}, map.el, detailBox)];
}

function piezoDetail(d: PiezoDetail): (Node | null)[] {
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
        h('div', {}, `à ${km(d.km)} · mesure du ${dateLabel(d.latest[0])}`),
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

  const latest = new Map<string, RiverLatest>();
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

  const markers = [...shown.values()].map((s) => {
    const html = h('div', {}, h('div.marker-label', {}, `${shortName(s)} · …`));
    markerEls.set(s.code, html);
    return { id: s.code, lat: s.lat, lon: s.lon, html, title: s.name };
  });
  const map = stationMap(place, markers, { onHover: highlight, onSelect: select });

  const gauges = rivers.profile.map((s) => {
    const g = h(
      'div.gauge',
      { tabindex: 0, onmouseenter: () => highlight(s.code), onmouseleave: () => highlight(null), onclick: () => select(s.code) },
      h('div', { style: 'height:44px;display:flex;align-items:flex-end;justify-content:center' }, h('span.loading', {}, '…')),
      h('div.flow-line'),
      h('div.gauge-label', {}, shortName(s)),
      h('div.day-sub', {}, '…'),
    );
    gaugeEls.set(s.code, g);
    return g;
  });

  for (const s of shown.values()) {
    loadRiverLatest(s.code)
      .then((r) => {
        latest.set(s.code, r);
        const m = markerEls.get(s.code);
        m?.replaceChildren(h('div.marker-label', {}, `${shortName(s)} · ${riverValue(r)}`));
        const g = gaugeEls.get(s.code);
        if (g) {
          g.children[0]!.replaceChildren(h('b', {}, riverValue(r)));
          g.children[3]!.textContent = r.grandeur === 'QmnJ' ? 'débit' : 'hauteur';
        }
        if (r.grandeur === 'QmnJ') {
          // Flow stations get a mini reservoir once their history is known.
          loadRiverDetail(s.code)
            .then((d) => {
              if (d.fill === null) return;
              g?.children[0]!.replaceChildren(h('div', {}, h('b', {}, riverValue(d))), tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }));
              m?.replaceChildren(h('div.marker-label', {}, `${shortName(s)} · ${riverValue(d)}`), tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }));
            })
            .catch(() => undefined);
        }
      })
      .catch(() => markerEls.get(s.code)?.replaceChildren(h('div.marker-label', {}, `${shortName(s)} · —`)));
  }

  const first = rivers.profile.length
    ? [...rivers.profile].sort((a, b) => (rivers.inRadius.find((l) => l.item.code === a.code)?.km ?? 99) - (rivers.inRadius.find((l) => l.item.code === b.code)?.km ?? 99))[0]!
    : [...shown.values()][0]!;
  select(first.code);

  const label = rivers.profileRiverLabel;
  return [
    rivers.profile.length
      ? h('div', {}, h('div.profile-river', {}, `${label ? label.charAt(0).toUpperCase() + label.slice(1) : 'La rivière la plus proche'}, de l’amont (à gauche) vers l’aval`), h('div.profile', {}, gauges))
      : null,
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

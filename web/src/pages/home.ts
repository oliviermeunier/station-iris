import type { DayConsensus } from '../core';
import type { Place } from '../location';
import { GUST_THRESHOLD_KMH } from '../config';
import { routeHref, type Route } from '../router';
import { selectedSources } from '../sources';
import { loadPiezoDetail, loadPiezoStations, loadRiverDetail, loadRivers, loadWeather } from '../store';
import { headline } from '../synthesis';
import { dayName, deg, depth, escapeHtml, mm, num, positionShort } from '../text';
import { h } from '../ui/dom';
import { tube } from '../ui/tube';
import { weekData } from '../ui/week';

interface Card {
  el: HTMLAnchorElement;
  fill(value: string, noteHtml: string, side?: Node | null, below?: Node | null): void;
}

/** A large summary card linking to its detail page. */
function card(route: Route, title: string, color: string): Card {
  const value = h('div.hcard-value', {}, '…');
  const note = h('div.hcard-note', {}, 'chargement');
  const side = h('div.hcard-side');
  const below = h('div.hcard-viz');
  const el = h(
    'a.hcard',
    { href: routeHref(route), style: `--c:var(${color})` },
    h('div.hcard-head', {}, h('span.hcard-title', {}, title), h('span', {}, 'détail →')),
    h('div.hcard-main', {}, h('div', {}, value, note), side),
    below,
  );
  return {
    el,
    fill(v, n, s, b) {
      value.textContent = v;
      note.innerHTML = n;
      side.replaceChildren(...(s ? [s] : []));
      below.replaceChildren(...(b ? [b] : []));
    },
  };
}

function dayInitial(iso: string): string {
  return dayName(iso).slice(0, 3);
}

function rainBars(days: DayConsensus[]): HTMLElement {
  const maxMm = Math.max(5, ...days.map((d) => d.mean ?? 0));
  return h(
    'div.mini-week',
    {},
    days.map((d) =>
      h(
        'div.mini-day',
        {},
        h('div.mini-bar-wrap', {}, h('div.bar', { style: `height:${((d.mean ?? 0) / maxMm) * 100}%;width:70%` })),
        h('div.mini-label', {}, dayInitial(d.date)),
        h('div.mini-sub', {}, d.mean === null ? '—' : num(d.mean, d.mean >= 10 ? 0 : 1)),
      ),
    ),
  );
}

function tempStrip(tmax: DayConsensus[], tmin: DayConsensus[]): HTMLElement {
  return h(
    'div.mini-week',
    {},
    tmax.map((d, i) => {
      const lo = tmin[i]?.mean ?? null;
      return h(
        'div.mini-day',
        {},
        h('div.mini-label', {}, dayInitial(d.date)),
        h('div.mini-max', {}, d.mean === null ? '—' : deg(d.mean)),
        h('div.mini-min', {}, lo === null ? '—' : deg(lo)),
        lo !== null && lo <= 0.5 ? h('div.frost', {}, '❄') : null,
      );
    }),
  );
}

export function renderHome(main: HTMLElement, place: Place): void {
  const head = h('h1.headline', {}, `${place.label}…`);
  const rain = card('precipitations', 'Précipitations · 7 jours', '--rain');
  const temp = card('temperatures', 'Températures', '--warm');
  const nappe = card('nappes', 'Nappe', '--earth');
  const river = card('rivieres', 'Rivière', '--river');
  main.replaceChildren(
    head,
    h('p.subline', {}, `Autour de ${place.label}, dans un rayon de 10 km.`),
    h('div.cards4', {}, rain.el, temp.el, nappe.el, river.el),
  );

  const fail = (c: Card) => () => c.fill('—', 'indisponible pour le moment');
  let rainInfo: { total: number; rainiest?: { date: string; mm: number }; frost?: string } | null = null;
  let nappePos: Parameters<typeof headline>[0]['nappe'];
  let nappeDone = false;
  const updateHead = () => {
    if (!rainInfo || !nappeDone) return;
    head.innerHTML = headline({ rainTotal: rainInfo.total, rainiest: rainInfo.rainiest, nappe: nappePos, frost: rainInfo.frost });
  };

  loadWeather(place)
    .then((w) => {
      const data = weekData(w.forecast, selectedSources());
      const total = data.rain.reduce((s, d) => s + (d.mean ?? 0), 0);
      const top = [...data.rain].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))[0];
      const rainiest = top && (top.mean ?? 0) >= 1 ? { date: top.date, mm: top.mean ?? 0 } : undefined;
      const frost = data.tmin.find((d) => d.mean !== null && d.mean <= 0.5)?.date;
      rainInfo = { total, rainiest, frost };
      const windy = [...data.gust].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))[0];
      const windNote =
        windy?.mean != null && windy.mean >= GUST_THRESHOLD_KMH ? `<br>rafales jusqu’à <b>${num(windy.mean, 0)} km/h</b> ${dayName(windy.date, 'long')}` : '';
      rain.fill(mm(total), `${rainiest ? `surtout ${dayName(rainiest.date, 'long')}` : 'pas de pluie notable'}${windNote}`, null, rainBars(data.rain));
      const t0 = data.tmin[0]?.mean;
      const t1 = data.tmax[0]?.mean;
      temp.fill(
        t0 != null && t1 != null ? `${deg(t0)} / ${deg(t1)}` : '—',
        `aujourd’hui · ${frost ? `gel possible ${dayName(frost, 'long')}` : 'pas de gel prévu'}`,
        null,
        tempStrip(data.tmax, data.tmin),
      );
      updateHead();
    })
    .catch(() => {
      fail(rain)();
      fail(temp)();
      head.textContent = place.label;
    });

  loadPiezoStations(place)
    .then(async ({ inRadius, nearestBeyond }) => {
      const l = inRadius[0] ?? nearestBeyond;
      if (!l) {
        nappe.fill('—', 'aucun piézomètre proche');
        return;
      }
      const d = await loadPiezoDetail(l.item);
      nappePos = d.position ?? undefined;
      nappe.fill(
        d.position ? positionShort(d.position, 'nappe') : d.latest ? depth(d.latest[1]) : '—',
        d.latest
          ? `l’eau est à <b>${depth(d.latest[1])}</b><br>${escapeHtml(l.item.commune)} · ${num(l.km, 0)} km${d.env ? `<br><span class="note">comparé à ${d.env.years} ans à cette date</span>` : ''}`
          : 'pas de mesure récente',
        tube({ fill: d.fill, mean: d.meanFill, size: 'card' }),
      );
    })
    .catch(fail(nappe))
    .finally(() => {
      nappeDone = true;
      updateHead();
    });

  loadRivers(place)
    .then(async (r) => {
      const s = r.inRadius[0]?.item ?? r.profile[0] ?? r.nearestBeyond?.item;
      if (!s) {
        river.fill('—', 'aucune station proche');
        return;
      }
      const d = await loadRiverDetail(s.code);
      const name = escapeHtml(s.name);
      if (!d.latest) river.fill('—', `${name} : pas de mesure récente`);
      else if (d.grandeur === 'QmnJ')
        river.fill(
          d.position ? positionShort(d.position, 'debit') : `${num(d.latest[1], 1)} m³/s`,
          `débit <b>${num(d.latest[1], 1)} m³/s</b><br>${name}`,
          d.fill !== null ? tube({ fill: d.fill, mean: d.meanFill, size: 'card' }) : null,
        );
      else river.fill(`${num(d.latest[1], 2)} m`, `hauteur d’eau · ${name}<br><span class="note">niveau pouvant être réglé par un ouvrage : pas de comparaison</span>`);
    })
    .catch(fail(river));
}

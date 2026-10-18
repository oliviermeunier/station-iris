import type { Place } from '../location';
import { routeHref } from '../router';
import { selectedSources } from '../sources';
import { loadPiezoDetail, loadPiezoStations, loadRiverDetail, loadRivers, loadWeather } from '../store';
import { headline } from '../synthesis';
import { dayName, deg, depth, escapeHtml, mm, num, positionShort } from '../text';
import { h } from '../ui/dom';
import { tube } from '../ui/tube';
import { weekData } from '../ui/week';

function tile(route: 'eau' | 'temperatures', kicker: string): { el: HTMLAnchorElement; fill: (value: string, note: string, extra?: Node | null) => void } {
  const value = h('div.tile-value', {}, '…');
  const note = h('div.tile-note', {}, 'chargement');
  const body = h('div', {}, h('div.kicker', {}, kicker), value, note);
  const el = h('a.tile', { href: routeHref(route) }, h('div.tile-flex', {}, body));
  return {
    el,
    fill(v, n, extra) {
      value.textContent = v;
      note.innerHTML = n;
      if (extra) el.firstElementChild!.append(extra);
    },
  };
}

export function renderHome(main: HTMLElement, place: Place): void {
  const head = h('h1.headline', {}, `${place.label}…`);
  const rain = tile('eau', 'Pluie · 7 jours');
  const temp = tile('temperatures', 'Aujourd’hui');
  const nappe = tile('eau', 'Nappe');
  const river = tile('eau', 'Rivière');
  main.replaceChildren(head, h('p.subline', {}, `Autour de ${place.label}, dans un rayon de 10 km.`), h('div.tiles', {}, rain.el, temp.el, nappe.el, river.el));

  const fail = (t: ReturnType<typeof tile>) => () => t.fill('—', 'indisponible pour le moment');
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
      const maxMm = Math.max(5, ...data.rain.map((d) => d.mean ?? 0));
      const bars = h('div', { style: 'display:flex;gap:4px;align-items:flex-end;height:42px;width:96px;flex-shrink:0' }, data.rain.map((d) => h('div.bar', { style: `height:${((d.mean ?? 0) / maxMm) * 100}%;width:100%` })));
      rain.fill(mm(total), rainiest ? `surtout ${dayName(rainiest.date, 'long')}` : 'pas de pluie notable', bars);
      const t0 = data.tmin[0]?.mean;
      const t1 = data.tmax[0]?.mean;
      temp.fill(t0 != null && t1 != null ? `${deg(t0)} / ${deg(t1)}` : '—', frost ? `gel possible ${dayName(frost, 'long')}` : 'pas de gel prévu');
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
      const d = await loadPiezoDetail(l.item, l.km);
      nappePos = d.position ?? undefined;
      nappe.fill(
        d.position ? positionShort(d.position, 'nappe') : d.latest ? depth(d.latest[1]) : '—',
        d.latest ? `${depth(d.latest[1])}<br>${escapeHtml(l.item.commune)} · ${num(l.km, 0)} km` : 'pas de mesure récente',
        tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }),
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
        river.fill(d.position ? positionShort(d.position, 'debit') : `${num(d.latest[1], 1)} m³/s`, `${num(d.latest[1], 1)} m³/s<br>${name}`, d.fill !== null ? tube({ fill: d.fill, mean: d.meanFill, size: 'mini' }) : null);
      else river.fill(`${num(d.latest[1], 2)} m`, `${name}<br>hauteur, niveau pouvant être réglé par un ouvrage`);
    })
    .catch(fail(river));
}

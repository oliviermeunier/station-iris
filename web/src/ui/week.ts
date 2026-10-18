import { consensus, type DayConsensus } from '../core';
import { MODELS, type Forecast, type ModelDays } from '../data/openmeteo';
import { GUST_THRESHOLD_KMH, RAIN_THRESHOLD_MM } from '../config';
import { dayName, deg, mm, num } from '../text';
import { compass, compassShort, gustWord, meanDirection } from '../wind';
import { h } from './dom';

export interface WeekData {
  dates: string[];
  rain: DayConsensus[];
  tmax: DayConsensus[];
  tmin: DayConsensus[];
  wind: DayConsensus[];
  /** `rainy` counts the sources forecasting a gust of at least GUST_THRESHOLD_KMH. */
  gust: DayConsensus[];
  /** Mean direction the wind blows from, or null when the sources disagree. */
  windDir: (number | null)[];
}

/** Consensus of the selected models, day by day. */
export function weekData(f: Forecast, selected: string[]): WeekData {
  const models = MODELS.filter((m) => selected.includes(m.id));
  const series = (k: keyof ModelDays) => models.map((m) => f.byModel[m.id]?.[k] ?? []);
  const dirs = series('windDir');
  return {
    dates: f.dates,
    rain: consensus(series('rain'), f.dates, RAIN_THRESHOLD_MM),
    tmax: consensus(series('tmax'), f.dates),
    tmin: consensus(series('tmin'), f.dates),
    wind: consensus(series('wind'), f.dates),
    gust: consensus(series('gust'), f.dates, GUST_THRESHOLD_KMH),
    windDir: f.dates.map((_, i) => meanDirection(dirs.map((d) => d[i]))),
  };
}

export function rainWeek(f: Forecast, selected: string[]): HTMLElement {
  const w = weekData(f, selected);
  const maxMm = Math.max(5, ...w.rain.map((d) => d.mean ?? 0));
  return h(
    'div.week',
    { role: 'list' },
    w.rain.map((d, i) =>
      h(
        'div.day',
        { role: 'listitem', tabindex: 0 },
        h('div.day-name', {}, dayName(d.date)),
        h('div.bar-wrap', {}, h('div.bar', { style: `height:${((d.mean ?? 0) / maxMm) * 100}%` })),
        h('div', {}, d.mean === null ? '—' : mm(d.mean)),
        h('div.agree', {}, d.sources ? h('span', {}, h('b', {}, `${d.rainy}`), ` sur ${d.sources}`) : '—'),
        detailRows(f, selected, (md) => {
          const v = md.rain[i];
          return v === null || v === undefined ? '—' : mm(v);
        }),
      ),
    ),
  );
}

export function tempWeek(f: Forecast, selected: string[]): HTMLElement {
  const w = weekData(f, selected);
  const values = [...w.tmax, ...w.tmin].flatMap((d) => [d.min, d.max]).filter((v): v is number => v !== null);
  const lo = Math.min(...values) - 1;
  const hi = Math.max(...values) + 1;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return h(
    'div.week',
    { role: 'list' },
    w.tmax.map((dmax, i) => {
      const dmin = w.tmin[i]!;
      const frost = dmin.mean !== null && dmin.mean <= 0.5;
      const range = (d: DayConsensus, cls: 'max' | 'min') =>
        d.min === null || d.max === null || d.mean === null
          ? null
          : [
              h(`div.range.${cls}`, { style: `bottom:${pct(d.min)}%;height:${Math.max(2, pct(d.max) - pct(d.min))}%` }),
              h(`div.tick.${cls}`, { style: `bottom:calc(${pct(d.mean)}% - 1px)` }),
            ];
      return h(
        'div.day',
        { role: 'listitem', tabindex: 0 },
        h('div.day-name', {}, dayName(dmax.date)),
        h('div.range-wrap', {}, range(dmax, 'max'), range(dmin, 'min')),
        h('div.t-max', {}, dmax.mean === null ? '—' : deg(dmax.mean)),
        h('div.t-min', {}, dmin.mean === null ? '—' : deg(dmin.mean)),
        frost ? h('div.frost', {}, '❄ gel') : null,
        detailRows(f, selected, (md) => {
          const a = md.tmin[i];
          const b = md.tmax[i];
          return a === null || b === null || a === undefined || b === undefined ? '—' : `${num(a, 0)}° / ${num(b, 0)}°`;
        }),
      );
    }),
  );
}

export function windWeek(f: Forecast, selected: string[]): HTMLElement {
  const w = weekData(f, selected);
  const maxKmh = Math.max(60, ...w.gust.map((d) => d.mean ?? 0));
  return h(
    'div.week',
    { role: 'list' },
    w.gust.map((g, i) => {
      const dir = w.windDir[i] ?? null;
      const wind = w.wind[i]?.mean ?? null;
      const word = g.mean === null ? '' : gustWord(g.mean);
      return h(
        'div.day',
        { role: 'listitem', tabindex: 0 },
        h('div.day-name', {}, dayName(g.date)),
        // The arrow points where the wind goes, like on a weather map.
        h(
          'div.wind-dir',
          { title: dir === null ? 'direction variable' : `vent de ${compass(dir)}` },
          dir === null ? h('span.wind-var', {}, '~') : h('span.wind-arrow', { style: `transform:rotate(${dir + 180}deg)` }, '↑'),
          h('small', {}, dir === null ? 'variable' : compassShort(dir)),
        ),
        h('div.bar-wrap.short', {}, h('div.bar.gust', { style: `height:${((g.mean ?? 0) / maxKmh) * 100}%` })),
        h('div.gust-value', {}, g.mean === null ? '—' : num(g.mean, 0)),
        h('div.day-sub', {}, wind === null ? '' : `moy. ${num(wind, 0)}`),
        word ? h('div.gust-word', {}, word) : null,
        h('div.agree', {}, g.sources ? h('span', {}, h('b', {}, `${g.rainy}`), ` sur ${g.sources}`) : '—'),
        detailRows(f, selected, (md) => {
          const v = md.gust[i];
          const d = md.windDir[i];
          return v === null || v === undefined ? '—' : `${num(v, 0)} km/h${d === null || d === undefined ? '' : ` · ${compassShort(d)}`}`;
        }),
      );
    }),
  );
}

function detailRows(f: Forecast, selected: string[], pick: (m: ModelDays) => string): HTMLElement {
  return h(
    'div.detail',
    {},
    MODELS.filter((m) => selected.includes(m.id)).map((m) => {
      const md = f.byModel[m.id];
      return h('div', {}, `${m.label} : `, h('b', {}, md ? pick(md) : '—'));
    }),
  );
}

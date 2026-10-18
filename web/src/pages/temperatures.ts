import { classify, envelopeAt } from '../core';
import type { Place } from '../location';
import { selectedSources } from '../sources';
import { bandFor, loadWeather, points } from '../store';
import { deg, escapeHtml, positionLabel } from '../text';
import { h, section } from '../ui/dom';
import { envelopeChart } from '../ui/envelopeChart';
import { sourcePicker } from '../ui/sourcePicker';
import { tempWeek, weekData } from '../ui/week';
import { sectionShell } from './common';
import { rainSection } from './water';

export function renderTemperatures(main: HTMLElement, place: Place): void {
  const head = h('div');
  const rain = h('div');
  const week = h('div');
  const chart = h('div');
  main.replaceChildren(
    head,
    h(
      'div.meteo-layout',
      {},
      // One source picker for the whole page, in a left column: it drives rain and temperatures alike.
      h('aside.meteo-side', {}, h('div.side-title', {}, 'Sources des prévisions'), sourcePicker(true), h('p.note', {}, 'Les prévisions affichées sont la moyenne des modèles cochés. Survolez un jour pour le détail par modèle.')),
      h(
        'div',
        {},
        sectionShell('Précipitations', '--rain', rain),
        sectionShell('Températures des 7 prochains jours', '--warm', h('p.note', {}, 'Pour chaque jour : moyenne des sources, et bande allant de la source la plus basse à la plus haute.'), week),
        sectionShell('Températures comparées aux années précédentes', '--warm', chart),
      ),
    ),
  );
  void section(rain, 'Chargement de la pluie…', () => rainSection(place));

  void section(head, 'Chargement des prévisions…', async () => {
    const w = await loadWeather(place);
    const draw = () => {
      week.replaceChildren(tempWeek(w.forecast, selectedSources()));
    };
    draw();
    window.addEventListener('iris:sources', function redraw() {
      if (!week.isConnected) return window.removeEventListener('iris:sources', redraw);
      draw();
    });

    const today = weekData(w.forecast, selectedSources());
    const tmax = today.tmax[0]?.mean ?? null;
    const tmin = today.tmin[0]?.mean ?? null;
    const series = points(w.daily.dates, w.daily.tmax);
    const env = today.dates[0] ? envelopeAt(series, today.dates[0]) : null;
    const pos = tmax !== null && env ? positionLabel(classify(tmax, env), 'temp') : null;
    const frostDay = today.tmin.find((d) => d.mean !== null && d.mean <= 0.5);
    const lines: string[] = [];
    if (tmin !== null && tmax !== null) lines.push(`Aujourd’hui à ${escapeHtml(place.label)} : <em>${deg(tmin)} / ${deg(tmax)}</em>${pos ? `, ${pos}` : ''}.`);
    if (frostDay) lines.push('Gel possible dans la semaine.');
    return [
      h('h1.headline', { html: lines.join(' ') || `Températures à ${escapeHtml(place.label)}` }),
      env ? h('p.subline', {}, `Comparaison avec les ${env.years} années précédentes à la même date (±3 jours).`) : null,
    ];
  });

  void section(chart, 'Chargement de 10 ans de températures…', async () => {
    const w = await loadWeather(place);
    const make = (kind: 'tmax' | 'tmin') => {
      const series = points(w.daily.dates, w.daily[kind]);
      return envelopeChart({
        series,
        band: bandFor(series),
        unit: '°C',
        digits: 1,
        color: kind === 'tmax' ? '--warm' : '--water',
        bandColor: kind === 'tmax' ? '--warm-band' : '--band',
        seriesName: kind === 'tmax' ? 'maximales' : 'minimales',
        initialDays: 366,
      });
    };
    const holder = h('div', {}, make('tmax'));
    const btn = (kind: 'tmax' | 'tmin', label: string) =>
      h('button', {
        type: 'button',
        'aria-pressed': kind === 'tmax',
        onclick: (e: Event) => {
          for (const b of toggle.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
          holder.replaceChildren(make(kind));
        },
      }, label);
    const toggle = h('div.chart-tools', {}, btn('tmax', 'Maximales'), btn('tmin', 'Minimales'));
    return [toggle, holder];
  });
}

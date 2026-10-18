import { GUST_THRESHOLD_KMH } from '../config';
import { classify, envelopeAt, waterBalance } from '../core';
import type { Place } from '../location';
import { selectedSources } from '../sources';
import { bandFor, cumulativeByYear, loadWeather, points, rollingBalance } from '../store';
import { dayName, escapeHtml, litres, mm, num, positionLabel } from '../text';
import { h, section } from '../ui/dom';
import { envelopeChart } from '../ui/envelopeChart';
import { rainWeek, weekData, windWeek } from '../ui/week';
import { compass } from '../wind';
import { forecastLayout, sectionShell } from './common';

export function renderPrecipitations(main: HTMLElement, place: Place): void {
  const rain = h('div');
  const wind = h('div');
  const windChart = h('div');
  main.replaceChildren(
    h('h1.headline', { html: `Précipitations et vent à <em>${escapeHtml(place.label)}</em>` }),
    forecastLayout(
      sectionShell('Précipitations', '--rain', rain),
      sectionShell('Vent des 7 prochains jours', '--wind', wind),
      sectionShell('Vent comparé aux années précédentes', '--wind', windChart),
    ),
  );
  void section(rain, 'Chargement de la pluie…', () => rainSection(place));
  void section(wind, 'Chargement du vent…', () => windSection(place));
  void section(windChart, 'Chargement de 10 ans de vent…', () => windHistory(place));
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
    balances.map((b) => {
      // Same window on the same dates in previous years: is this drier than usual?
      const env = lastComplete ? envelopeAt(rollingBalance(days, b.window_days), lastComplete) : null;
      const usual = env ? positionLabel(classify(b.balance, env), 'sol') : null;
      const drying = b.balance < 0;
      // Litres per m² is the same number as mm, but easier to picture.
      const scale = Math.max(b.rain, b.et0, 1);
      const flow = (label: string, value: number, cls: string) =>
        h(
          'div.flow',
          {},
          h('div.flow-label', {}, label),
          h('div.flow-track', {}, h(`div.flow-bar.${cls}`, { style: `width:${(value / scale) * 100}%` })),
          h('div.flow-value', {}, `${litres(value)}`),
        );
      return h(
        'div.card',
        {},
        h('div.kicker', {}, `${b.window_days} derniers jours`),
        h('div.balance-value', {}, drying ? 'Les sols s’assèchent' : 'Les sols se rechargent'),
        flow('Reçu par la pluie', b.rain, 'in'),
        flow('Perdu par évaporation', b.et0, 'out'),
        h(
          'p.tile-note',
          { html: `Bilan : <b>${num(Math.abs(b.balance), Math.abs(b.balance) >= 10 ? 0 : 1)} litres d’eau ${drying ? 'perdus' : 'gagnés'}</b> par m² de terrain.` },
        ),
        usual && env ? h('p.balance-usual', {}, `${usual.charAt(0).toUpperCase()}${usual.slice(1)} (sur ${env.years} ans).`) : null,
      );
    }),
  );

  const daily = points(w.daily.dates, w.daily.rain);
  const cumul = cumulativeByYear(daily);
  return [
    verdict,
    week,
    h('h3', {}, 'Les sols se dessèchent-ils ?'),
    balanceRow,
    h('p.note', {}, '1 mm de pluie = 1 litre d’eau par m². L’eau perdue est celle qu’une pelouse bien arrosée évapore et transpire dans les mêmes conditions (évapotranspiration de référence). C’est un indicateur général, pas une mesure de l’eau dans votre terrain.'),
    h('h3', {}, 'Pluie cumulée depuis le 1er janvier'),
    h('p.note', {}, 'Le total repart de zéro chaque 1er janvier. La bande montre les totaux des années précédentes à la même date : au-dessus, l’année est plus arrosée que d’habitude.'),
    envelopeChart({ series: cumul, band: bandFor(cumul, 0), unit: 'mm', digits: 0, color: '--rain', bandColor: '--band', seriesName: 'cette année', initialDays: 366, yearly: true }),
  ];
}

// ---------- wind ----------

async function windSection(place: Place): Promise<Node[]> {
  const w = await loadWeather(place);
  const week = h('div');
  const verdict = h('p.verdict');
  const draw = () => {
    const sel = selectedSources();
    const data = weekData(w.forecast, sel);
    const i = data.gust.reduce((best, d, j) => ((d.mean ?? 0) > (data.gust[best]?.mean ?? 0) ? j : best), 0);
    const top = data.gust[i];
    const dir = data.windDir[i];
    const from = dir === null || dir === undefined ? '' : `, vent de ${compass(dir)}`;
    verdict.innerHTML =
      top && top.mean !== null && top.mean >= GUST_THRESHOLD_KMH
        ? `Rafales jusqu’à <strong>${num(top.mean, 0)} km/h</strong> <strong>${dayName(top.date, 'long')}</strong>${from} (${top.rainy} source${top.rainy > 1 ? 's' : ''} sur ${top.sources} prévoient au moins ${GUST_THRESHOLD_KMH} km/h).`
        : `<strong>Pas de vent fort</strong> prévu sur 7 jours${top?.mean != null ? ` (rafales jusqu’à ${num(top.mean, 0)} km/h)` : ''}.`;
    week.replaceChildren(windWeek(w.forecast, sel));
  };
  draw();
  window.addEventListener('iris:sources', function redraw() {
    if (!week.isConnected) return window.removeEventListener('iris:sources', redraw);
    draw();
  });
  return [
    verdict,
    h('p.note', {}, `Pour chaque jour : la rafale la plus forte en km/h (moyenne des sources), le vent moyen le plus fort, et le nombre de sources qui prévoient des rafales d’au moins ${GUST_THRESHOLD_KMH} km/h. La flèche indique où va le vent.`),
    week,
  ];
}

async function windHistory(place: Place): Promise<Node[]> {
  const w = await loadWeather(place);
  const make = (kind: 'gust' | 'wind') => {
    const series = points(w.daily.dates, w.daily[kind]);
    if (series.length === 0) return h('p.empty', {}, 'Historique du vent indisponible pour le moment.');
    return envelopeChart({
      series,
      band: bandFor(series),
      unit: 'km/h',
      digits: 0,
      color: '--wind',
      bandColor: '--wind-band',
      seriesName: kind === 'gust' ? 'rafale max.' : 'vent moyen max.',
      initialDays: 366,
    });
  };
  const holder = h('div', {}, make('gust'));
  const btn = (kind: 'gust' | 'wind', label: string) =>
    h(
      'button',
      {
        type: 'button',
        'aria-pressed': kind === 'gust',
        onclick: (e: Event) => {
          for (const b of toggle.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
          holder.replaceChildren(make(kind));
        },
      },
      label,
    );
  const toggle = h('div.chart-tools', {}, btn('gust', 'Rafales'), btn('wind', 'Vent moyen'));
  return [h('p.note', {}, 'Chaque jour, la valeur la plus forte observée. La bande va du jour le plus calme au plus venté des années précédentes à la même date.'), toggle, holder];
}

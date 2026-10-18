import { LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { dayIndex, type Envelope, type Point } from '../core';
import { num } from '../text';
import { cssVar, h } from './dom';
import { onLeave } from './lifecycle';

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkPointComponent, CanvasRenderer]);

export interface ChartOptions {
  series: Point[];
  /** 365 envelopes indexed by `dayIndex` (reference years). */
  band: (Envelope | null)[];
  unit: string;
  digits?: number;
  /** Line colour CSS variable, e.g. `--water`. */
  color: string;
  bandColor: string;
  /** Depth-like series: draw the axis upside down so that higher = more water. */
  invert?: boolean;
  seriesName: string;
  /** Range shown first, in days back from the last point. */
  initialDays?: number;
  /** Series restarts every 1 January (year-to-date totals). */
  yearly?: boolean;
}

const PERIODS: [string, number | null][] = [
  ['1 mois', 31],
  ['3 mois', 92],
  ['1 an', 366],
  ['5 ans', 5 * 366],
  ['Tout', null],
];

const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Line for the measured series over a min–max band and a dashed mean, with zoom and pan. */
export function envelopeChart(opts: ChartOptions): HTMLElement {
  const box = h('div.chart');
  const tools = h('div.chart-tools');
  const wrap = h(
    'div',
    {},
    tools,
    box,
    h(
      'div.legend',
      {},
      h('span', {}, h('i', { style: `background:var(${opts.bandColor})` }), 'entre le min et le max connus à cette date'),
      h('span', {}, h('i', { style: 'background:none;border-top:2px dashed var(--soft);height:0' }), 'moyenne'),
      h('span', {}, h('i', { style: `background:var(${opts.color});height:3px` }), opts.seriesName),
    ),
  );
  if (opts.series.length === 0) {
    box.replaceWith(h('p.empty', {}, 'Pas assez de mesures pour tracer un graphique.'));
    return wrap;
  }

  const first = opts.series[0]![0];
  const last = opts.series[opts.series.length - 1]![0];
  // Band and mean for every day of the displayed span (not only measured days).
  const lower: [number, number | null | '-'][] = [];
  const width: [number, number | null | '-'][] = [];
  const mean: [number, number | null | '-'][] = [];
  for (let t = ts(first); t <= ts(last); t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (opts.yearly && iso.endsWith('-01-01') && mean.length > 0) {
      for (const s of [lower, width, mean]) s.push([t - 1, '-']);
    }
    const env = opts.band[dayIndex(iso)] ?? null;
    lower.push([t, env ? env.min : null]);
    width.push([t, env ? env.max - env.min : null]);
    mean.push([t, env ? env.mean : null]);
  }
  const line: [number, number | '-'][] = [];
  for (const [d, v] of opts.series) {
    const prev = line[line.length - 1];
    // Year-to-date totals restart on 1 January: break the line instead of drawing a cliff.
    if (opts.yearly && prev && new Date(prev[0]).getUTCFullYear() !== Number(d.slice(0, 4))) {
      line.push([ts(d) - 1, '-']); // ECharts' marker for a gap
    }
    line.push([ts(d), v]);
  }
  const digits = opts.digits ?? 1;

  let chart: echarts.ECharts | null = null;
  const render = () => {
    const ink = cssVar('--ink');
    const soft = cssVar('--soft');
    const lineColor = cssVar(opts.color);
    const bandColor = cssVar(opts.bandColor);
    const span = opts.initialDays ?? 366;
    chart ??= echarts.init(box, undefined, { renderer: 'canvas' });
    chart.setOption(
      {
        animation: false,
        grid: { left: 52, right: 16, top: 16, bottom: 64 },
        tooltip: {
          trigger: 'axis',
          formatter: (params: { seriesName: string; value: [number, number | null]; axisValue: number }[]) => {
            const p0 = params[0];
            if (!p0) return '';
            const date = new Date(p0.axisValue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            const byName = new Map(params.map((p) => [p.seriesName, p.value[1]]));
            const lo = byName.get('min');
            const w = byName.get('band');
            const rows = [`<b>${date}</b>`];
            const v = byName.get(opts.seriesName);
            if (typeof v === 'number') rows.push(`${opts.seriesName} : <b>${num(v, digits)} ${opts.unit}</b>`);
            const m = byName.get('moyenne');
            if (typeof m === 'number') rows.push(`moyenne : ${num(m, digits)} ${opts.unit}`);
            if (typeof lo === 'number' && typeof w === 'number')
              rows.push(`connu : ${num(lo, digits)} – ${num(lo + w, digits)} ${opts.unit}`);
            return rows.join('<br>');
          },
        },
        xAxis: { type: 'time', axisLine: { lineStyle: { color: soft } }, axisLabel: { color: soft } },
        yAxis: {
          type: 'value',
          scale: true,
          inverse: Boolean(opts.invert),
          axisLabel: { color: soft, formatter: (v: number) => `${num(v, digits === 0 ? 0 : 1)}` },
          splitLine: { lineStyle: { color: cssVar('--line') } },
          name: opts.unit,
          // On an inverted axis the "end" is at the bottom, under the zoom slider.
          nameLocation: opts.invert ? 'start' : 'end',
          nameTextStyle: { color: soft },
        },
        dataZoom: [
          { type: 'inside', startValue: ts(last) - span * 86_400_000, endValue: ts(last) },
          { type: 'slider', height: 22, bottom: 14, borderColor: cssVar('--line'), textStyle: { color: soft } },
        ],
        series: [
          { name: 'min', type: 'line', data: lower, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, connectNulls: false, silent: true },
          { name: 'band', type: 'line', data: width, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: bandColor, opacity: 1 }, silent: true },
          { name: 'moyenne', type: 'line', data: mean, symbol: 'none', lineStyle: { color: soft, type: 'dashed', width: 1.5 } },
          {
            name: opts.seriesName,
            type: 'line',
            data: line,
            symbol: 'none',
            lineStyle: { color: lineColor, width: 2.5 },
            itemStyle: { color: lineColor },
            markPoint: {
              symbol: 'circle',
              symbolSize: 10,
              label: { show: false },
              itemStyle: { color: lineColor, borderColor: ink, borderWidth: 1 },
              data: [{ coord: line[line.length - 1] }],
            },
          },
        ],
      },
      { notMerge: true },
    );
  };

  for (const [label, days] of PERIODS) {
    const b = h('button', { type: 'button', 'aria-pressed': days === (opts.initialDays ?? 366) }, label);
    b.addEventListener('click', () => {
      for (const other of tools.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
      chart?.dispatchAction({
        type: 'dataZoom',
        startValue: days === null ? ts(first) : Math.max(ts(first), ts(last) - days * 86_400_000),
        endValue: ts(last),
      });
    });
    tools.append(b);
  }
  tools.append(h('span.hint', {}, 'molette ou pincer = zoom · glisser = se déplacer'));

  // Init once attached and visible; follow resizes and theme changes.
  const observer = new ResizeObserver(() => {
    if (box.clientWidth === 0) return;
    if (!chart) render();
    else chart.resize();
  });
  observer.observe(box);
  const release = () => {
    window.removeEventListener('iris:theme', onTheme);
    observer.disconnect();
    chart?.dispose();
    chart = null;
  };
  const onTheme = () => {
    // Replaced inside the page (another station picked): release now.
    if (!box.isConnected) release();
    else if (chart) render();
  };
  window.addEventListener('iris:theme', onTheme);
  onLeave(release);
  return wrap;
}

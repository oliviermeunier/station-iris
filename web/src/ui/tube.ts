const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/**
 * Vertical reservoir. `fill` in [0, 1]: 0 = driest known at this date, 1 = wettest.
 * `mean` (optional, [0, 1]) draws a dashed line at the average.
 */
export function tube(opts: { fill: number | null; mean?: number | null; size: 'mini' | 'full' }): SVGSVGElement {
  const w = opts.size === 'mini' ? 22 : 64;
  const hgt = opts.size === 'mini' ? 40 : 190;
  const stroke = opts.size === 'mini' ? 2 : 3;
  const svg = el('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, class: 'tube', role: 'img' });
  const r = opts.size === 'mini' ? 5 : 14;
  const inner = `M${stroke / 2} 0 V${hgt - r} Q${stroke / 2} ${hgt - stroke / 2} ${r} ${hgt - stroke / 2} H${w - r} Q${w - stroke / 2} ${hgt - stroke / 2} ${w - stroke / 2} ${hgt - r} V0`;
  const clipId = `c${Math.random().toString(36).slice(2, 9)}`;
  const clip = el('clipPath', { id: clipId });
  clip.append(el('path', { d: `${inner} Z` }));
  svg.append(clip);
  svg.append(el('path', { d: `${inner} Z`, class: 'tube-frame', 'stroke-width': 0 }));
  if (opts.fill !== null) {
    const level = Math.max(0, Math.min(1, opts.fill));
    const y = hgt - level * hgt;
    svg.append(el('rect', { x: 0, y, width: w, height: hgt - y, class: 'tube-water', 'clip-path': `url(#${clipId})` }));
  }
  if (opts.mean !== null && opts.mean !== undefined) {
    const y = hgt - opts.mean * hgt;
    svg.append(el('line', { x1: 0, x2: w, y1: y, y2: y, class: 'tube-mean', 'stroke-width': 1.5 }));
  }
  svg.append(el('path', { d: inner, fill: 'none', class: 'tube-frame', 'stroke-width': stroke, style: 'fill:none' }));
  return svg;
}

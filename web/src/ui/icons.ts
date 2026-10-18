import type { Route } from '../router';

// Hand-drawn 32×32 icons. Colours come from the theme tokens, so they follow light/dark mode.
export type Page = Exclude<Route, 'home'>;

const SVG: Record<Page, string> = {
  temperatures:
    '<path d="M10.5 19.2V6a3.5 3.5 0 0 1 7 0v13.2a6 6 0 1 1-7 0Z" style="fill:var(--panel);stroke:var(--warm);stroke-width:2"/>' +
    '<circle cx="14" cy="24" r="3.6" style="fill:var(--warm)"/>' +
    '<rect x="12.6" y="10" width="2.8" height="12" rx="1.4" style="fill:var(--warm)"/>' +
    '<path d="M21 8h3M21 12h3M21 16h3" style="stroke:var(--warm);stroke-width:1.6;stroke-linecap:round"/>',
  precipitations:
    '<path d="M16 2.5S6.5 14 6.5 20.5a9.5 9.5 0 0 0 19 0C25.5 14 16 2.5 16 2.5Z" style="fill:var(--rain)"/>' +
    '<path d="M11.5 20.5a4.5 4.5 0 0 0 3 4.3" style="fill:none;stroke:#fff;stroke-opacity:.75;stroke-width:2;stroke-linecap:round"/>',
  nappes:
    '<path d="M11.2 15h9.6v8a3 3 0 0 1-3 3h-3.6a3 3 0 0 1-3-3Z" style="fill:var(--water)"/>' +
    '<path d="M11 11h10" style="stroke:var(--earth);stroke-width:1.4;stroke-dasharray:2 1.6"/>' +
    '<path d="M9 3v20a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5V3" style="fill:none;stroke:var(--earth);stroke-width:2.2;stroke-linecap:round"/>',
  rivieres:
    '<path d="M5 3c0 9 22 6 22 15s-14 6-14 11" style="fill:none;stroke:var(--river);stroke-width:5.5;stroke-linecap:round"/>' +
    '<path d="M5 3c0 9 22 6 22 15s-14 6-14 11" style="fill:none;stroke:#fff;stroke-opacity:.45;stroke-width:1.2;stroke-dasharray:3 4;stroke-linecap:round"/>',
};

export function icon(route: Page): HTMLElement {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 32 32" width="100%" height="100%">${SVG[route]}</svg>`;
  return span;
}

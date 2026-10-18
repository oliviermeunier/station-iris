import { currentPlace, setPlace, type Place } from '../location';
import { h } from '../ui/dom';
import { icon, type Page } from '../ui/icons';
import { createSearch } from '../ui/search';
import { sourcePicker } from '../ui/sourcePicker';

/** Shown when no place is chosen yet. */
export function welcome(): HTMLElement {
  return h(
    'section.welcome',
    {},
    h('h1.headline', { html: 'La météo et l’eau <em>près de chez vous</em>, comparées à ce qui a déjà été observé.' }),
    h('p', {}, 'Températures, pluie et vent des 7 prochains jours selon plusieurs modèles météo, niveau des nappes et des rivières autour de vous. Gratuit, sans publicité, sans cookie : votre position reste sur votre appareil.'),
    createSearch((p) => setPlace(p), true),
  );
}

export function requirePlace(main: HTMLElement): Place | null {
  const place = currentPlace();
  if (!place) main.replaceChildren(welcome());
  return place;
}

export function sectionShell(title: string, color: string, ...children: (Node | null)[]): HTMLElement {
  return h('section.section', { style: `--c:var(${color})` }, h('div.section-head', {}, h('h2.section-title', {}, title)), ...children);
}

/** Forecast pages: the source picker sits in a left column and drives every section. */
export function forecastLayout(...sections: (Node | null)[]): HTMLElement {
  return h(
    'div.meteo-layout',
    {},
    h('aside.meteo-side', {}, h('div.side-title', {}, 'Sources des prévisions'), sourcePicker(true), h('p.note', {}, 'Les prévisions affichées sont la moyenne des modèles cochés. Survolez un jour pour le détail par modèle.')),
    h('div', {}, ...sections),
  );
}

/** Page title with the page's icon; `html` must already be escaped. */
export function pageTitle(route: Page, html: string): HTMLElement {
  return h('h1.headline.with-icon', {}, icon(route), h('span', { html }));
}

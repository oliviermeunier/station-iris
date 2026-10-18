import { currentPlace, setPlace, type Place } from '../location';
import { h } from '../ui/dom';
import { createSearch } from '../ui/search';

/** Shown when no place is chosen yet. */
export function welcome(): HTMLElement {
  return h(
    'section.welcome',
    {},
    h('h1.headline', { html: 'La météo et l’eau <em>près de chez vous</em>, comparées à ce qui a déjà été observé.' }),
    h('p', {}, 'Pluie et températures des 7 prochains jours selon plusieurs modèles météo, niveau des nappes et des rivières autour de vous. Gratuit, sans publicité, sans cookie : votre position reste sur votre appareil.'),
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

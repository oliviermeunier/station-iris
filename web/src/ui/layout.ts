import { COFFEE_URL, REPO_URL } from '../config';
import { currentPlace, setPlace } from '../location';
import { routeHref, type Route } from '../router';
import { currentTheme, toggleTheme } from '../theme';
import { h } from './dom';
import { createSearch } from './search';

const PAGES: [Route, string][] = [
  ['home', 'Accueil'],
  ['meteo', 'Météo'],
  ['nappes', 'Nappes et rivières'],
];

export interface Shell {
  main: HTMLElement;
  setRoute(r: Route): void;
  refreshPlace(): void;
}

export function renderShell(root: HTMLElement): Shell {
  const navLinks = PAGES.map(([r, label]) => h('a', { href: routeHref(r), 'data-route': r }, label));

  const placeLabel = h('span', {}, 'Choisir un lieu');
  const popover = h('div.popover', { hidden: true });
  const chip = h(
    'button.place-chip',
    {
      type: 'button',
      'aria-haspopup': 'dialog',
      onclick: () => {
        popover.hidden = !popover.hidden;
        if (!popover.hidden) {
          popover.replaceChildren(
            createSearch((p) => {
              popover.hidden = true;
              setPlace(p);
            }, true),
          );
        }
      },
    },
    '📍 ',
    placeLabel,
  );
  document.addEventListener('click', (e) => {
    if (!popover.hidden && !chip.parentElement!.contains(e.target as Node)) popover.hidden = true;
  });

  const lightBtn = h('button', { type: 'button', title: 'Mode clair', 'aria-label': 'Mode clair' }, '☀️');
  const darkBtn = h('button', { type: 'button', title: 'Mode sombre', 'aria-label': 'Mode sombre' }, '🌙');
  const syncTheme = () => {
    const dark = currentTheme() === 'dark';
    lightBtn.setAttribute('aria-pressed', String(!dark));
    darkBtn.setAttribute('aria-pressed', String(dark));
  };
  lightBtn.addEventListener('click', () => currentTheme() === 'dark' && (toggleTheme(), syncTheme()));
  darkBtn.addEventListener('click', () => currentTheme() === 'light' && (toggleTheme(), syncTheme()));
  syncTheme();

  const main = h('main');
  root.replaceChildren(
    h(
      'div.shell',
      {},
      h(
        'header.top',
        {},
        h('a.brand', { href: routeHref('home') }, h('img', { src: './favicon.svg', alt: '' }), h('b', {}, 'Station Iris'), h('span.beta', {}, 'bêta')),
        h('nav.nav', { 'aria-label': 'Pages' }, navLinks),
        h('div.top-right', {}, h('div.relative', {}, chip, popover), h('div.theme-toggle', { role: 'group', 'aria-label': 'Thème' }, lightBtn, darkBtn)),
      ),
      main,
      h(
        'footer.footer',
        {},
        h('span', {}, 'Données : ', h('a', { href: 'https://open-meteo.com/' }, 'Open-Meteo'), ' (CC BY 4.0) · ', h('a', { href: 'https://hubeau.eaufrance.fr/' }, 'Hub’Eau'), ' · ', h('a', { href: 'https://geoservices.ign.fr/' }, 'IGN'), ' · ', h('a', { href: 'https://geo.api.gouv.fr/' }, 'API Géo')),
        h('span', {}, 'Sans publicité, sans cookie, votre position reste sur votre appareil.'),
        h('a', { href: REPO_URL }, 'Code source'),
        COFFEE_URL ? h('a.coffee', { href: COFFEE_URL, target: '_blank', rel: 'noopener' }, '☕ Paye-moi un café') : null,
      ),
    ),
  );

  return {
    main,
    setRoute(r) {
      for (const a of navLinks) {
        if (a.dataset.route === r) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
    },
    refreshPlace() {
      placeLabel.textContent = currentPlace()?.label ?? 'Choisir un lieu';
    },
  };
}

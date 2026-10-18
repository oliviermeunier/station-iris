// Fonts are served from this site: no request to a third-party font service.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/inter';
import './styles.css';
import { GOATCOUNTER_URL } from './config';
import { loadCore } from './core';
import { currentPlace, fromUrl, resolveUrlPlace, setPlace } from './location';
import { renderHome } from './pages/home';
import { requirePlace } from './pages/common';
import { renderTemperatures } from './pages/temperatures';
import { renderWater } from './pages/water';
import { parseRoute } from './router';
import { h } from './ui/dom';
import { renderShell } from './ui/layout';
import { leavePage } from './ui/lifecycle';

async function main() {
  const root = document.getElementById('app')!;
  const shell = renderShell(root);
  shell.main.replaceChildren(h('p.loading', {}, 'Chargement…'));

  try {
    await loadCore();
  } catch (err) {
    console.error(err);
    shell.main.replaceChildren(h('p.error', {}, 'Votre navigateur ne peut pas faire tourner ce site (WebAssembly indisponible).'));
    return;
  }

  const render = () => {
    leavePage();
    const route = parseRoute(location.hash);
    shell.setRoute(route);
    shell.refreshPlace();
    const place = requirePlace(shell.main);
    if (!place) return;
    if (route === 'eau') renderWater(shell.main, place);
    else if (route === 'temperatures') renderTemperatures(shell.main, place);
    else renderHome(shell.main, place);
    window.scrollTo({ top: 0 });
  };

  window.addEventListener('hashchange', render);
  window.addEventListener('iris:place', render);

  const fromLink = await resolveUrlPlace(fromUrl(location.search)).catch(() => null);
  if (fromLink) setPlace(fromLink, false);
  if (!currentPlace()) render();

  if (GOATCOUNTER_URL) {
    // Cookie-less audience measurement (no consent banner needed). Count the page only:
    // the query string holds the chosen place and must not reach a third party.
    (window as unknown as { goatcounter: object }).goatcounter = {
      path: () => location.pathname + location.hash,
    };
    const s = document.createElement('script');
    s.async = true;
    s.src = '//gc.zgo.at/count.js';
    s.dataset.goatcounter = GOATCOUNTER_URL;
    document.body.append(s);
  }
}

void main();

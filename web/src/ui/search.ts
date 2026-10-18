import { searchCommunes, type Commune } from '../data/geo';
import { LocateError, locate, placeFromCommune, type Place } from '../location';
import { h } from './dom';

/** Commune search box with keyboard navigation, plus a "locate me" button. */
export function createSearch(onPick: (p: Place) => void, autofocus = false): HTMLElement {
  const input = h('input', {
    type: 'search',
    placeholder: 'Commune ou code postal…',
    'aria-label': 'Rechercher une commune',
    autocomplete: 'off',
  });
  const list = h('ul', { role: 'listbox', hidden: true });
  const status = h('p.note', { 'aria-live': 'polite' });
  let results: Commune[] = [];
  let active = -1;
  let timer: number | undefined;
  let seq = 0;

  const pick = (c: Commune) => {
    list.hidden = true;
    input.value = c.nom;
    onPick(placeFromCommune(c));
  };

  const draw = () => {
    list.replaceChildren(
      ...results.map((c, i) =>
        h(
          'li',
          { role: 'option', 'aria-selected': i === active, onmousedown: (e: Event) => { e.preventDefault(); pick(c); } },
          c.nom,
          h('small', {}, c.codesPostaux.slice(0, 2).join(', ')),
        ),
      ),
    );
    list.hidden = results.length === 0;
  };

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    const q = input.value;
    timer = window.setTimeout(async () => {
      const mine = ++seq;
      try {
        const r = await searchCommunes(q);
        if (mine !== seq) return;
        results = r;
        active = r.length ? 0 : -1;
        status.textContent = q.trim().length >= 2 && r.length === 0 ? 'Aucune commune trouvée.' : '';
        draw();
      } catch {
        status.textContent = 'Recherche indisponible pour le moment.';
      }
    }, 220);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length;
      draw();
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      pick(results[active]!);
    } else if (e.key === 'Escape') {
      list.hidden = true;
    }
  });
  input.addEventListener('blur', () => window.setTimeout(() => (list.hidden = true), 150));

  const locateBtn = h(
    'button.btn.ghost',
    {
      type: 'button',
      onclick: async () => {
        status.textContent = 'Recherche de votre position…';
        try {
          const p = await locate();
          status.textContent = '';
          onPick(p);
        } catch (err) {
          status.textContent = err instanceof LocateError ? err.message : 'Position introuvable.';
        }
      },
    },
    '📍 Me localiser',
  );

  if (autofocus) queueMicrotask(() => input.focus());
  return h('div', {}, h('div.search', {}, input, list), h('div.actions', {}, locateBtn), status);
}

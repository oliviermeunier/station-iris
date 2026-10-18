import { searchIndex, type IndexEntry, type IndexKind } from '../data/searchIndex';
import { h } from './dom';

const PLACEHOLDER: Record<IndexKind, string> = {
  nappe: 'Nom d’une nappe : alluvions de la Loire, craie…',
  riviere: 'Nom d’une rivière : Sarthe, Loire, Lot…',
};

/** "Nappe | Rivière" search; picking a result opens its page through the URL hash. */
export function waterSearch(initial: IndexKind = 'riviere'): HTMLElement {
  let kind: IndexKind = initial;
  const input = h('input', { type: 'search', placeholder: PLACEHOLDER[kind], 'aria-label': 'Rechercher une nappe ou une rivière', autocomplete: 'off' });
  const list = h('ul', { role: 'listbox', hidden: true });
  let results: IndexEntry[] = [];
  let active = -1;
  let seq = 0;

  const open = (e: IndexEntry) => {
    list.hidden = true;
    location.hash = `#/nappes?${kind}=${encodeURIComponent(e.code)}`;
  };
  const draw = () => {
    list.replaceChildren(
      ...results.map((e, i) =>
        h(
          'li',
          { role: 'option', 'aria-selected': i === active, onmousedown: (ev: Event) => { ev.preventDefault(); open(e); } },
          e.name,
          h('small', {}, `${e.stations} ${kind === 'nappe' ? 'piézomètre' : 'station'}${e.stations > 1 ? 's' : ''}`),
        ),
      ),
    );
    list.hidden = results.length === 0;
  };
  const run = async () => {
    const mine = ++seq;
    const r = await searchIndex(kind, input.value);
    if (mine !== seq) return;
    results = r;
    active = r.length ? 0 : -1;
    draw();
  };

  input.addEventListener('input', () => void run());
  input.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && results.length) {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length;
      draw();
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      open(results[active]!);
    } else if (e.key === 'Escape') list.hidden = true;
  });
  input.addEventListener('blur', () => window.setTimeout(() => (list.hidden = true), 150));

  const pill = (k: IndexKind, label: string) => {
    const b = h('button', { type: 'button', 'aria-pressed': k === kind }, label);
    b.addEventListener('click', () => {
      kind = k;
      for (const other of pills.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
      input.placeholder = PLACEHOLDER[k];
      input.focus();
      void run();
    });
    return b;
  };
  const pills = h('div.chart-tools', {}, pill('riviere', 'Rivière'), pill('nappe', 'Nappe'));
  return h('div.water-search', {}, h('div.side-title', {}, 'Rechercher une rivière ou une nappe'), pills, h('div.search', {}, input, list));
}

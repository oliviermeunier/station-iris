/** Minimal DOM helpers: `h('div.card', {…}, children)`. */
type Attrs = Record<string, string | number | boolean | undefined | EventListener>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name as K);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    // ARIA states are strings: true/false must not become "" / omitted.
    if (k.startsWith('aria-')) el.setAttribute(k, String(v));
    else if (v === false) continue;
    else if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Renders an async section: loading text, then content or a readable error. */
export async function section(
  el: HTMLElement,
  loadingText: string,
  render: () => Promise<Node | (Node | null)[]>,
): Promise<void> {
  // Only the latest render of a given element may write to it (a slow earlier one is dropped).
  const seq = String(Number(el.dataset.seq ?? '0') + 1);
  el.dataset.seq = seq;
  el.replaceChildren(h('p.loading', {}, loadingText));
  try {
    const out = await render();
    if (el.dataset.seq !== seq) return;
    el.replaceChildren(...(Array.isArray(out) ? out : [out]).filter((n): n is Node => n !== null));
  } catch (err) {
    console.error(err);
    if (el.dataset.seq !== seq) return;
    el.replaceChildren(
      h('p.error', {}, 'Données indisponibles pour le moment. Réessayez dans quelques minutes.'),
    );
  }
}

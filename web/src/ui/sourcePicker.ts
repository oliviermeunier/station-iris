import { MODELS } from '../data/openmeteo';
import { selectedSources, setSelectedSources } from '../sources';
import { h } from './dom';

/** Checkboxes, one per weather model; at least one stays checked. */
export function sourcePicker(vertical = false): HTMLElement {
  const selected = new Set(selectedSources());
  const boxes = MODELS.map((m) => {
    const box = h('input', { type: 'checkbox', value: m.id, checked: selected.has(m.id) });
    box.addEventListener('change', () => {
      const ids = boxes.filter((b) => b.checked).map((b) => b.value);
      if (ids.length === 0) {
        box.checked = true;
        return;
      }
      setSelectedSources(ids);
    });
    return box;
  });
  return h(
    vertical ? 'div.sources.vertical' : 'div.sources',
    {},
    vertical ? null : h('span.note', {}, 'Sources :'),
    MODELS.map((m, i) => h('label', {}, boxes[i]!, m.label)),
  );
}

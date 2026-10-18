// Page-scoped cleanup: charts and maps register their teardown here, and the router runs
// it before drawing the next page, so navigating does not leak canvases or listeners.

let cleanups: (() => void)[] = [];

export function onLeave(fn: () => void): void {
  cleanups.push(fn);
}

export function leavePage(): void {
  const pending = cleanups;
  cleanups = [];
  for (const fn of pending) {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }
}

export type Route = 'home' | 'meteo' | 'nappes';

/** Older links (#/eau, #/temperatures) keep working. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path === 'nappes' || path === 'eau') return 'nappes';
  if (path === 'meteo' || path === 'temperatures') return 'meteo';
  return 'home';
}

/** Parameters after `?` in the hash, e.g. `#/nappes?riviere=M---0060`. */
export function hashParams(hash: string): URLSearchParams {
  const i = hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}

export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

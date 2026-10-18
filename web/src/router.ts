export type Route = 'home' | 'temperatures' | 'precipitations' | 'nappes' | 'rivieres';

/** Older links (#/eau, #/meteo, #/nappes?riviere=…) keep working. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path === 'nappes' && hashParams(hash).has('riviere')) return 'rivieres';
  if (path === 'nappes' || path === 'eau') return 'nappes';
  if (path === 'rivieres') return 'rivieres';
  if (path === 'temperatures') return 'temperatures';
  if (path === 'precipitations' || path === 'meteo') return 'precipitations';
  return 'home';
}

/** Parameters after `?` in the hash, e.g. `#/rivieres?riviere=M---0060`. */
export function hashParams(hash: string): URLSearchParams {
  const i = hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}

export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

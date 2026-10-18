export type Route = 'home' | 'meteo' | 'nappes';

/** Older links (#/eau, #/temperatures) keep working. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path === 'nappes' || path === 'eau') return 'nappes';
  if (path === 'meteo' || path === 'temperatures') return 'meteo';
  return 'home';
}

export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

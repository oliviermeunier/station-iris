export type Route = 'home' | 'eau' | 'temperatures';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path === 'eau') return 'eau';
  if (path === 'temperatures') return 'temperatures';
  return 'home';
}

export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

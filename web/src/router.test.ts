import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from './router';

describe('parseRoute', () => {
  it('reads the three pages', () => {
    expect(parseRoute('#/eau')).toBe('eau');
    expect(parseRoute('#/temperatures')).toBe('temperatures');
    expect(parseRoute('#/')).toBe('home');
  });
  it('defaults to home', () => {
    expect(parseRoute('')).toBe('home');
    expect(parseRoute('#/nimporte')).toBe('home');
  });
  it('round-trips hrefs', () => {
    expect(parseRoute(routeHref('eau'))).toBe('eau');
  });
});

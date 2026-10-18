import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from './router';

describe('parseRoute', () => {
  it('reads the three pages', () => {
    expect(parseRoute('#/nappes')).toBe('nappes');
    expect(parseRoute('#/meteo')).toBe('meteo');
    expect(parseRoute('#/')).toBe('home');
  });
  it('keeps old links working', () => {
    expect(parseRoute('#/eau')).toBe('nappes');
    expect(parseRoute('#/temperatures')).toBe('meteo');
  });
  it('defaults to home', () => {
    expect(parseRoute('')).toBe('home');
    expect(parseRoute('#/nimporte')).toBe('home');
  });
  it('round-trips hrefs', () => {
    expect(parseRoute(routeHref('nappes'))).toBe('nappes');
  });
});

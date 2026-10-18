import { describe, expect, it } from 'vitest';
import { hashParams, parseRoute, routeHref } from './router';

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
  it('reads hash parameters', () => {
    expect(parseRoute('#/nappes?riviere=M---0060')).toBe('nappes');
    expect(hashParams('#/nappes?riviere=M---0060').get('riviere')).toBe('M---0060');
    expect(hashParams('#/').get('nappe')).toBeNull();
  });
  it('round-trips hrefs', () => {
    expect(parseRoute(routeHref('nappes'))).toBe('nappes');
  });
});

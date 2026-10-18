import { describe, expect, it } from 'vitest';
import { hashParams, parseRoute, routeHref, type Route } from './router';

describe('parseRoute', () => {
  it('reads the pages', () => {
    expect(parseRoute('#/temperatures')).toBe('temperatures');
    expect(parseRoute('#/precipitations')).toBe('precipitations');
    expect(parseRoute('#/nappes')).toBe('nappes');
    expect(parseRoute('#/rivieres')).toBe('rivieres');
    expect(parseRoute('#/')).toBe('home');
  });
  it('keeps old links working', () => {
    expect(parseRoute('#/eau')).toBe('nappes');
    expect(parseRoute('#/meteo')).toBe('precipitations');
    // River links shared before rivers got their own page.
    expect(parseRoute('#/nappes?riviere=----0000')).toBe('rivieres');
    expect(parseRoute('#/nappes?nappe=GG113')).toBe('nappes');
  });
  it('defaults to home', () => {
    expect(parseRoute('')).toBe('home');
    expect(parseRoute('#/nimporte')).toBe('home');
  });
  it('reads hash parameters', () => {
    expect(parseRoute('#/rivieres?riviere=M---0060')).toBe('rivieres');
    expect(hashParams('#/rivieres?riviere=M---0060').get('riviere')).toBe('M---0060');
    expect(hashParams('#/').get('nappe')).toBeNull();
  });
  it('round-trips hrefs', () => {
    for (const r of ['home', 'temperatures', 'precipitations', 'nappes', 'rivieres'] as Route[]) expect(parseRoute(routeHref(r))).toBe(r);
  });
});

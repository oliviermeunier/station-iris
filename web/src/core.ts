// Typed facade over the Rust core compiled to WebAssembly (see core/src/wasm.rs).
import init, * as wasm from './wasm-pkg/iris_core.js';

export interface Envelope {
  min: number;
  max: number;
  mean: number;
  years: number;
}
export type Position = 'belowAll' | 'low' | 'normal' | 'high' | 'aboveAll';
export interface DayConsensus {
  date: string;
  mean: number | null;
  min: number | null;
  max: number | null;
  sources: number;
  rainy: number;
}
export interface Balance {
  rain: number;
  et0: number;
  balance: number;
  days_covered: number;
  window_days: number;
}
export interface RiverStation {
  code: string;
  name: string;
  river: string;
  lat: number;
  lon: number;
}
export type Point = [date: string, value: number];

let ready: Promise<unknown> | null = null;

/** Loads the WebAssembly module once; every other function requires it. */
export function loadCore(): Promise<unknown> {
  ready ??= init();
  return ready;
}

export const HALF_WINDOW_DAYS = 3;

export function envelopeAt(history: Point[], target: string): Envelope | null {
  return JSON.parse(wasm.envelopeAt(JSON.stringify(history), target, HALF_WINDOW_DAYS));
}

/** 365 entries indexed by `dayIndex`, reference = all years except `excludeYear`. */
export function dayOfYearEnvelopes(
  history: Point[],
  excludeYear: number,
  halfWindowDays = HALF_WINDOW_DAYS,
): (Envelope | null)[] {
  return JSON.parse(wasm.dayOfYearEnvelopes(JSON.stringify(history), excludeYear, halfWindowDays));
}

export function dayIndex(date: string): number {
  return wasm.dayIndex(date);
}

export function classify(value: number, env: Envelope): Position {
  return wasm.classify(value, JSON.stringify(env)) as Position;
}

export function fillRatio(value: number, env: Envelope): number {
  return wasm.fillRatio(value, env.min, env.max);
}

export function consensus(
  series: (number | null)[][],
  dates: string[],
  rainThreshold?: number,
): DayConsensus[] {
  return JSON.parse(wasm.consensus(JSON.stringify(series), JSON.stringify(dates), rainThreshold));
}

export function waterBalance(
  days: [string, number | null, number | null][],
  end: string,
  windowDays: number,
): Balance {
  return JSON.parse(wasm.waterBalance(JSON.stringify(days), end, windowDays));
}

export function riverProfile(
  stations: RiverStation[],
  lat: number,
  lon: number,
  upKm: number,
  downKm: number,
): RiverStation[] {
  return JSON.parse(wasm.riverProfile(JSON.stringify(stations), lat, lon, upKm, downKm));
}

export function riverKey(stationLabel: string, riverLabel?: string | null): string {
  return wasm.riverKey(stationLabel, riverLabel ?? undefined);
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return wasm.distanceKm(a.lat, a.lon, b.lat, b.lon);
}

/** `[lonMin, latMin, lonMax, latMax]` */
export function bbox(lat: number, lon: number, radiusKm: number): number[] {
  return Array.from(wasm.bbox(lat, lon, radiusKm));
}

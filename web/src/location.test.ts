import { describe, expect, it } from 'vitest';
import { LocateError, fromUrl, locate } from './location';

describe('fromUrl', () => {
  it('reads a commune code', () => {
    expect(fromUrl('?c=49347')).toEqual({ insee: '49347' });
    expect(fromUrl('?c=2a004')).toEqual({ insee: '2A004' });
  });
  it('reads rounded coordinates', () => {
    expect(fromUrl('?lat=47.6161&lon=-0.4672')).toEqual({ lat: 47.62, lon: -0.47 });
  });
  it('ignores garbage', () => {
    expect(fromUrl('')).toBeNull();
    expect(fromUrl('?lat=abc&lon=1')).toBeNull();
    expect(fromUrl('?c=123')).toBeNull();
  });
});

describe('locate', () => {
  it('locateFallback: refusal rejects with a readable message', async () => {
    const geo = {
      getCurrentPosition: (_ok: PositionCallback, fail?: PositionErrorCallback | null) =>
        fail?.({ code: 1, message: 'denied' } as GeolocationPositionError),
    } as unknown as Geolocation;
    await expect(locate(geo)).rejects.toBeInstanceOf(LocateError);
  });
  it('rejects when geolocation is missing', async () => {
    await expect(locate(undefined)).rejects.toThrow(/pas disponible/);
  });
});

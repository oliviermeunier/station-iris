import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCommunes } from './geo';
import { HttpError, fetchJson } from './http';
import { convertHydro, parseHydroStations, parsePiezoStations } from './hubeau';
import { mergeDaily, parseForecast } from './openmeteo';

describe('Open-Meteo', () => {
  it('parsesMultiModelForecast with missing days', () => {
    const f = parseForecast({
      daily: {
        time: ['2026-10-18', '2026-10-19'],
        temperature_2m_max_meteofrance_seamless: [14.4, null],
        temperature_2m_min_meteofrance_seamless: [4.2, null],
        precipitation_sum_meteofrance_seamless: [2.75, null],
        temperature_2m_max_gfs_seamless: [14.4, 15.2],
      },
    });
    expect(f.dates).toEqual(['2026-10-18', '2026-10-19']);
    expect(f.byModel.meteofrance_seamless!.tmax).toEqual([14.4, null]);
    expect(f.byModel.gfs_seamless!.tmax).toEqual([14.4, 15.2]);
    // A variable the API did not return becomes all-null instead of crashing.
    expect(f.byModel.gfs_seamless!.rain).toEqual([null, null]);
    expect(f.byModel.icon_seamless!.tmin).toEqual([null, null]);
  });

  it('mergeDaily appends only dates after the archive', () => {
    const empty = { tmax: [], tmin: [], rain: [], et0: [] };
    const a = { ...empty, dates: ['2026-10-10'], tmax: [10], tmin: [1], rain: [0], et0: [1] };
    const r = {
      dates: ['2026-10-10', '2026-10-11'],
      tmax: [99, 12],
      tmin: [99, 2],
      rain: [99, 3],
      et0: [99, 1],
    };
    const m = mergeDaily(a, r);
    expect(m.dates).toEqual(['2026-10-10', '2026-10-11']);
    expect(m.tmax).toEqual([10, 12]);
  });
});

describe("Hub'Eau", () => {
  it('filtersInactivePiezo', () => {
    const stations = parsePiezoStations(
      [
        { code_bss: 'A', x: -0.5, y: 47.6, date_fin_mesure: '2026-10-15', noms_masse_eau_edl: ['Alluvions de la Sarthe'] },
        { code_bss: 'B', x: -0.3, y: 47.5, date_fin_mesure: '2022-12-31' },
      ],
      new Date('2026-10-18'),
    );
    expect(stations.map((s) => s.code)).toEqual(['A']);
    expect(stations[0]!.nappe).toBe('Alluvions de la Sarthe');
    expect(stations[0]!.lat).toBe(47.6);
  });

  it('convertsQmnJtoM3s and HIXnJtoM', () => {
    expect(convertHydro([{ date_obs_elab: '2026-10-01', resultat_obs_elab: 9508 }])).toEqual([['2026-10-01', 9.508]]);
    expect(convertHydro([{ date_obs_elab: '2026-10-01', resultat_obs_elab: 2978 }])[0]![1]).toBeCloseTo(2.978);
    expect(convertHydro([{ date_obs_elab: '2026-10-01', resultat_obs_elab: null }])).toEqual([]);
  });

  it('cleans station labels', () => {
    const [s] = parseHydroStations([
      { code_station: 'M072061010', libelle_station: 'La Sarthe à Châteauneuf-sur-Sarthe', libelle_cours_eau: 'la Sarthe', longitude_station: -0.48, latitude_station: 47.67 },
    ]);
    expect(s!.name).toBe('La Sarthe à Châteauneuf-sur-Sarthe');
  });
});

describe('API Géo', () => {
  it('parses communes and drops those without a centre', () => {
    const c = parseCommunes([
      { code: '49347', nom: 'Tiercé', codesPostaux: ['49125'], centre: { coordinates: [-0.4449, 47.6254] } },
      { code: '00000', nom: 'Sans centre' },
    ]);
    expect(c).toEqual([{ code: '49347', nom: 'Tiercé', codesPostaux: ['49125'], lat: 47.6254, lon: -0.4449 }]);
  });
});

describe('fetchJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    await expect(fetchJson('https://example.test/a', 1000)).rejects.toBeInstanceOf(HttpError);
  });

  it('retries once on 5xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson('https://example.test/b', 1000)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

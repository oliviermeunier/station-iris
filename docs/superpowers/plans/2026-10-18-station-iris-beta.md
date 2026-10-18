# Station Iris — bêta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier une bêta publique, statique et gratuite de Station Iris (météo + eau locale, partout en France) sur GitHub Pages.

**Architecture:** Site 100 % navigateur. TypeScript (Vite, sans framework) appelle directement geo.api.gouv.fr, Hub'Eau et Open-Meteo, met en cache dans IndexedDB, et délègue les calculs (enveloppes min/max/moyenne, verdicts, consensus multi-modèles, bilan d'eau, ordre des stations) à un cœur Rust compilé en WebAssembly (`wasm-bindgen`, fonctions JSON in → JSON out). Cartes Leaflet (fond IGN Plan v2), graphiques ECharts (zoom molette + déplacement natifs via `dataZoom`).

**Tech Stack:** Rust 1.98 (edition 2024) + wasm-bindgen 0.2.129 (WSL) ; Node 24 + pnpm 10 (Windows) ; Vite, TypeScript strict, Vitest ; Leaflet ; ECharts (import modulaire) ; GitHub Actions → Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-station-iris-design.md`

## Global Constraints

- Aucun serveur ; aucun cookie ; position du visiteur jamais stockée ni envoyée ailleurs qu'aux API de données (le cache garde les données par commune/station, pas la position).
- Nappe : valeur Hub'Eau `profondeur_nappe` = profondeur sous le sol ; toujours affichée « X,XX m sous le sol » ; plus grand = plus bas ; dans les graphiques et le réservoir, plus haut = plus d'eau.
- Rivière : débit `QmnJ` (L/s → m³/s ÷ 1000) si publié → fourchette + verdict ; sinon hauteur `HIXnJ` (mm → m ÷ 1000) seule, sans fourchette ni verdict, mention « niveau pouvant être réglé par un ouvrage ».
- Verdict = tiers de la fourchette min–max connue à la date (±3 jours) : bas / normal / haut ; hors fourchette = « plus bas (haut) que toutes les années connues à cette date ». Toujours afficher « sur N ans ».
- Référence : nappes et rivières = toutes les années disponibles (rivières : 30 dernières années max), hors année en cours ; pluie et températures = 30 dernières années complètes (1996–2025 en 2026).
- Rayon par défaut 10 km ; profil rivière ≈ 30 km amont / 10 km aval ; si aucune station dans 10 km : le dire + la plus proche avec sa distance.
- Pluie « significative » ≥ 1 mm ; prévision 7 jours ; modèles Open-Meteo : `meteofrance_seamless`, `ecmwf_ifs025`, `icon_seamless`, `gfs_seamless` ; un modèle sans valeur un jour (null) ne compte pas ce jour-là (« N sur M » avec M = sources ayant une valeur).
- Charte A : Fraunces (titres, chiffres), Inter (texte) ; clair `--bg #f6f1e7 --ink #1f2a2e --brand #1f4f5f --accent #b4532a --rain #2f6f8f` ; sombre `--bg #141a1d --ink #ece6da --brand #8cc7d6 --accent #f08a5d --rain #6fb3d2` ; thème = préférence système puis choix mémorisé (`localStorage` clé `iris.theme`).
- Textes en français. Attributions en pied de page : Open-Meteo (CC BY 4.0), Hub'Eau (eaufrance), IGN, API Géo.
- Code et identifiants en anglais ; licence MIT ; commits en français sans `Co-Authored-By`.
- Rust : `unsafe_code = "forbid"`, pas de `unwrap`/`expect` hors tests ; clippy `-D warnings`.

## Review Focus

1. Aucun piézomètre / aucune station dans 10 km → message clair + la plus proche avec distance (Task 7 : test `nearestBeyondRadius`).
2. Modèle qui renvoie `null` (Météo-France s'arrête à J+3) → consensus calculé sur les seules valeurs présentes, « N sur M » cohérent (Task 2 : test `consensus_ignores_missing_values`).
3. Une API en panne / lente → seule la section concernée affiche « données indisponibles », le reste s'affiche (Task 4 : test `fetchJson rejects on non-2xx` + rendu par section en `try/catch`, Task 6–8).
4. Géolocalisation refusée ou indisponible → la recherche de commune reste utilisable, aucun écran bloqué (Task 5 : test `locateFallback`).
5. Hauteurs de rivière négatives ou stations sans historique → affichage brut sans verdict, pas de NaN (Task 2 : test `envelope_none_when_no_past_year` ; Task 7 : rendu « — » si absent).

---

### Task 1: Dépôt, cœur Rust — enveloppe, verdict, géo

**Files:**
- Create: `Cargo.toml` (workspace), `core/Cargo.toml`, `core/src/lib.rs`, `core/src/envelope.rs`, `core/src/verdict.rs`, `core/src/geo.rs`, `.gitignore`, `LICENSE` (MIT, Olivier Meunier 2026), `rustfmt.toml`
- Test: tests unitaires dans chaque module

**Interfaces:**
- Produces:
  - `envelope::Envelope { min: f64, max: f64, mean: f64, years: u32 }`
  - `envelope::envelope_at(history: &[(NaiveDate, f64)], target: NaiveDate, half_window_days: u32) -> Option<Envelope>` (années strictement antérieures à `target.year()`, fenêtre ±`half_window_days` autour du même jour, 29/02 → 28/02 ; moyenne = moyenne des valeurs retenues)
  - `envelope::envelope_series(history, from: NaiveDate, to: NaiveDate, half_window_days) -> Vec<(NaiveDate, Option<Envelope>)>` (pour la bande des graphiques ; référence = toutes les années ≠ année de chaque date)
  - `verdict::Position { BelowAll, Low, Normal, High, AboveAll }` ; `verdict::classify(value: f64, env: &Envelope) -> Position` (sur l'échelle « plus grand = plus », l'appelant inverse la profondeur)
  - `geo::distance_km(a: (f64,f64), b: (f64,f64)) -> f64` (haversine, (lat, lon)) ; `geo::bbox(center: (f64,f64), radius_km: f64) -> [f64; 4]` (lon_min, lat_min, lon_max, lat_max)

- [ ] **Step 1: Tests** — `envelope_uses_only_past_years`, `envelope_window_three_days`, `envelope_none_when_no_past_year`, `envelope_mean_is_average`, `classify_thirds` (min 0, max 3 : 0.5→Low, 1.5→Normal, 2.9→High, −1→BelowAll, 4→AboveAll), `distance_paris_lyon_about_392km` (±3 km), `bbox_contains_center`.
- [ ] **Step 2:** `wsl … cargo test -p iris-core` → FAIL (non défini).
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` → PASS.
- [ ] **Step 5:** Commit « Cœur Rust : enveloppe saisonnière, verdict, distances ».

### Task 2: Cœur Rust — consensus, bilan, rivière, export WebAssembly

**Files:**
- Create: `core/src/consensus.rs`, `core/src/balance.rs`, `core/src/river.rs`, `core/src/wasm.rs`, `scripts/build-wasm.sh`
- Modify: `core/src/lib.rs`, `core/Cargo.toml` (`crate-type = ["cdylib","rlib"]`, `wasm-bindgen = "=0.2.129"`, `serde`, `serde_json`, `chrono`)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `consensus::DayConsensus { date: NaiveDate, mean: Option<f64>, min: Option<f64>, max: Option<f64>, sources: u32, rainy: u32 }`
  - `consensus::consensus(series: &[Vec<Option<f64>>], dates: &[NaiveDate], rain_threshold: Option<f64>) -> Vec<DayConsensus>` (`rainy` = nb de valeurs ≥ seuil si seuil fourni)
  - `balance::water_balance(days: &[(NaiveDate, Option<f64>, Option<f64>)], end: NaiveDate, window: u32) -> Balance { rain: f64, et0: f64, days_covered: u32 }` (repris de garden `domain/water_balance.rs`)
  - `river::Station { code: String, name: String, river: String, lat: f64, lon: f64 }` ; `river::profile(stations: &[Station], center: (f64,f64), up_km: f64, down_km: f64) -> Vec<Station>` (rivière de la station la plus proche ; tri par `code` croissant = amont → aval ; garde les stations à ≤ `up_km` en amont et ≤ `down_km` en aval de la plus proche, distances à vol d'oiseau)
  - `river::river_key(label_station: &str, label_river: Option<&str>) -> String` (nom normalisé : `label_river` sinon texte avant « à »/« au »/« aux », minuscules, sans article)
  - WASM (`wasm.rs`, `#[wasm_bindgen]`, JSON string in/out, erreurs → `JsError`) : `envelope_at_json`, `envelope_series_json`, `classify_json`, `consensus_json`, `water_balance_json`, `profile_json`, `distance_km`, `bbox_json`
  - `scripts/build-wasm.sh` : `cargo build -p iris-core --release --target wasm32-unknown-unknown` puis `wasm-bindgen --target web --out-dir web/src/wasm-pkg target/wasm32-unknown-unknown/release/iris_core.wasm`

- [ ] **Step 1: Tests** — `consensus_mean_min_max`, `consensus_ignores_missing_values` (4 séries dont une `None` le jour 5 → `sources == 3`), `consensus_counts_rainy_at_threshold` (1.0 compte), `balance_week`, `river_key_from_station_label` (« La Sarthe à Châteauneuf-sur-Sarthe » → « sarthe »), `profile_orders_upstream_to_downstream` (codes M063…, M068…, M072…, M073… → cet ordre), `profile_limits_distance`.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter. **Step 4:** contrôles + `bash scripts/build-wasm.sh` produit `web/src/wasm-pkg/iris_core.js` et `iris_core_bg.wasm`.
- [ ] **Step 5:** Commit « Cœur Rust : consensus multi-modèles, bilan d'eau, profil de rivière, export WebAssembly ».

### Task 3: Application web — squelette, charte A, thème, navigation

**Files:**
- Create: `web/package.json`, `web/vite.config.ts` (`base: './'`), `web/tsconfig.json`, `web/index.html`, `web/src/main.ts`, `web/src/router.ts`, `web/src/theme.ts`, `web/src/core.ts`, `web/src/ui/layout.ts`, `web/src/styles.css`, `web/public/favicon.svg` (arc-en-ciel discret), `pnpm-workspace.yaml` facultatif
- Test: `web/src/theme.test.ts`, `web/src/router.test.ts`

**Interfaces:**
- Produces:
  - `theme.initialTheme(stored: string|null, prefersDark: boolean): 'light'|'dark'` ; `theme.toggle()` ; attribut `data-theme` sur `<html>`
  - `router.parseRoute(hash: string): 'home'|'eau'|'temperatures'` (défaut `home`) ; routes `#/`, `#/eau`, `#/temperatures`
  - `core.ready(): Promise<Core>` où `Core` expose les fonctions WASM typées (Task 2)
  - `layout.renderShell(root: HTMLElement)` : en-tête (marque « Station Iris », nav, lieu courant, bascule ☀️/🌙), `<main>`, pied de page (attributions, lien dépôt, bouton café si configuré)

- [ ] Tests `initialTheme` (stocké prioritaire ; sinon préférence système) et `parseRoute` → FAIL → implémenter → `pnpm test` PASS → `pnpm build` OK → commit « Squelette web : charte A, thème clair/sombre, navigation ».

### Task 4: Couche données — cache, API Géo, Open-Meteo, Hub'Eau

**Files:**
- Create: `web/src/data/http.ts`, `web/src/data/cache.ts`, `web/src/data/geo.ts`, `web/src/data/openmeteo.ts`, `web/src/data/hubeau.ts`, `web/src/data/fixtures/*.json` (réponses réelles réduites)
- Test: `web/src/data/*.test.ts`

**Interfaces:**
- Produces:
  - `http.fetchJson<T>(url: string, ttlMs: number): Promise<T>` (cache IndexedDB par URL ; rejette si non-2xx)
  - `geo.searchCommunes(q: string): Promise<Commune[]>` (`/communes?nom=&fields=nom,code,codesPostaux,centre&boost=population&limit=8`) ; `geo.communeAt(lat, lon): Promise<Commune|null>` ; `Commune { code, nom, codesPostaux: string[], lat, lon }`
  - `openmeteo.MODELS = [{id:'meteofrance_seamless',label:'Météo-France'},{id:'ecmwf_ifs025',label:'ECMWF (européen)'},{id:'icon_seamless',label:'ICON (allemand)'},{id:'gfs_seamless',label:'GFS (américain)'}]`
  - `openmeteo.forecast(lat, lon): Promise<Forecast>` (daily `temperature_2m_max,temperature_2m_min,precipitation_sum`, 4 modèles, 7 jours, `past_days=0`, TTL 3 h) → `Forecast { dates: string[], byModel: Record<id, {tmax:(number|null)[], tmin:…, rain:…}> }`
  - `openmeteo.history(lat, lon): Promise<History>` (archive 1996-01-01 → aujourd'hui−6 j, `temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration`, TTL 24 h)
  - `hubeau.piezoStations(bbox): Promise<PiezoStation[]>` (garder `date_fin_mesure` ≥ aujourd'hui − 60 j) ; `PiezoStation { code, commune, lat, lon, nappe: string|null }` (`noms_masse_eau_edl[0]`)
  - `hubeau.piezoSeries(code): Promise<[string, number][]>` (`chroniques`, `profondeur_nappe`, size 20000, TTL 24 h)
  - `hubeau.hydroStations(bbox): Promise<river Station[]>` (`referentiel/stations`, `en_service=true`)
  - `hubeau.hydroSeries(code, grandeur: 'QmnJ'|'HIXnJ', fromDate): Promise<[string, number][]>` (converties en m³/s ou m)

- [ ] Tests de parsing sur fixtures (`parsesMultiModelForecast` avec `null`, `filtersInactivePiezo`, `convertsQmnJtoM3s` 9508 → 9.508, `convertsHIXnJtoM` 2978 → 2.978, `fetchJson rejects on non-2xx`) → FAIL → implémenter → PASS → commit « Couche données : API Géo, Open-Meteo, Hub'Eau, cache ».

### Task 5: Localisation — géolocalisation, recherche, état dans l'URL

**Files:**
- Create: `web/src/location.ts`, `web/src/ui/search.ts`
- Test: `web/src/location.test.ts`

**Interfaces:**
- Produces: `location.current(): Place|null` ; `Place { label: string, lat: number, lon: number, inseeCode?: string }` ; `location.set(place)` (met à jour `?c=<insee>` ou `?lat=&lon=` arrondis à 0,01°, déclenche le rendu) ; `location.fromUrl(search: string): Place|null` ; `location.locate(): Promise<Place>` (géoloc → `communeAt` → libellé ; rejette proprement si refus) ; écran d'accueil sans lieu : bouton « Me localiser » + recherche.
- [ ] Tests `fromUrl` (`?c=49347`, `?lat=47.62&lon=-0.47`, vide) et `locateFallback` (refus → rejet sans exception non gérée) → FAIL → implémenter → PASS → commit « Localisation : géolocalisation, recherche de commune, lien partageable ».

### Task 6: Page Températures + sélecteur de sources + graphique enveloppe

**Files:**
- Create: `web/src/sources.ts`, `web/src/ui/sourcePicker.ts`, `web/src/ui/envelopeChart.ts`, `web/src/ui/tempWeek.ts`, `web/src/pages/temperatures.ts`
- Test: `web/src/sources.test.ts`

**Interfaces:**
- Produces: `sources.selected(): string[]` (défaut : les 4 ; `localStorage` `iris.sources` ; jamais vide) ; `envelopeChart.render(el, opts: { title, unit, series: [string, number][], band: {date, min, max, mean}[], invert?: boolean })` (ECharts : bande min–max, moyenne pointillée, année courante, point « aujourd'hui », boutons 1 mois/3 mois/1 an/5 ans/tout, `dataZoom` inside + slider) ; `tempWeek.render(el, consensus: DayConsensus[] (tmax), consensusMin: DayConsensus[])` (moyenne + bande d'écart, gel si min moyenne ≤ 0 °C, survol = détail par source).
- [ ] Test `selected never empty` → implémenter page → vérification visuelle (capture Chrome headless) → commit « Page Températures : prévisions multi-sources et graphique comparé aux normales ».

### Task 7: Page Eau — pluie, nappe, rivière

**Files:**
- Create: `web/src/ui/rainWeek.ts`, `web/src/ui/tube.ts`, `web/src/ui/map.ts`, `web/src/ui/riverProfile.ts`, `web/src/pages/water.ts`, `web/src/text.ts`
- Test: `web/src/text.test.ts`, `web/src/pages/water.test.ts`

**Interfaces:**
- Produces:
  - `text.positionLabel(p: Position, subject: 'nappe'|'debit'|'pluie'|'temp'): string` (« basse », « normale », « haute », « plus basse que toutes les années connues à cette date »…) ; `text.depth(m: number): string` → « 4,62 m sous le sol »
  - `tube.svg(opts: { fill: number /*0..1*/, label?: string, size: 'mini'|'full' }): SVGElement`
  - `map.create(el): L.Map` (IGN Plan v2 WMTS `https://data.geopf.fr/wmts?…LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2…`, filtre CSS en sombre, cercle 10 km) ; marqueurs = mini-tubes
  - `riverProfile.render(el, stations, values)` lié à la carte via `highlight(code)` dans les deux sens (survol + toucher)
  - `water.nearestBeyondRadius(stations, center, radiusKm): {station, km}|null`
- [ ] Tests `text.depth(4.62) === '4,62 m sous le sol'`, `positionLabel`, `nearestBeyondRadius` → implémenter rendu (pluie 7 j + « N sources sur M », bilan 7/30 j, graphique pluie cumulée ; nappe : carte + tubes + verdict + graphique inversé ; rivière : carte + profil + débit/hauteur selon règle) → capture headless → commit « Page Eau : pluie, nappes en réservoir, rivière carte + profil ».

### Task 8: Accueil — synthèse

**Files:**
- Create: `web/src/pages/home.ts`, `web/src/synthesis.ts`
- Test: `web/src/synthesis.test.ts`

**Interfaces:**
- Produces: `synthesis.headline(input: { rainTotal: number, rainiest?: {date, mm}, nappe?: Position, frost?: string }): string` (une phrase ; ex. « Un peu de pluie attendue mercredi, mais la nappe reste basse pour la saison. ») ; quatre tuiles (pluie, aujourd'hui, nappe, rivière) liées aux pages.
- [ ] Tests de `headline` (sec / pluvieux / sans nappe) → implémenter → capture → commit « Accueil : phrase de synthèse et tuiles ».

### Task 9: Publication bêta

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md` (FR), `web/src/config.ts` (`COFFEE_URL`, `GOATCOUNTER_URL` lus depuis `import.meta.env`, vides = masqués)
- Modify: `web/index.html` (badge « bêta »)

- [ ] Workflow : checkout → Rust stable + `wasm32-unknown-unknown` → `cargo install wasm-bindgen-cli --version 0.2.129 --locked` → `bash scripts/build-wasm.sh` → pnpm install/test/build → upload `web/dist` → deploy Pages.
- [ ] `gh repo create oliviermeunier/station-iris --public` → push → activer Pages (source GitHub Actions) → vérifier HTTP 200 + capture de l'URL publique.
- [ ] Commit « Publication bêta sur GitHub Pages ».

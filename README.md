# Station Iris

**La météo et l'eau près de chez vous, comparées à ce qui a déjà été observé.**

Station Iris est un site gratuit, sans publicité et sans cookie. On choisit une commune (ou on se géolocalise) et le site montre, dans un rayon de 10 km :

- **la pluie et les températures des 7 prochains jours**, selon plusieurs modèles météo (Météo-France, ECMWF, ICON, GFS) que l'on peut cocher ou décocher : moyenne des sources, écart entre elles, et nombre de sources qui prévoient de la pluie ;
- **un indicateur de sécheresse** (pluie moins évaporation sur 7 et 30 jours) et la pluie cumulée depuis le 1er janvier ;
- **le niveau des nappes** mesuré par les piézomètres proches, dessiné comme un réservoir entre l'année la plus sèche et la plus humide connues à cette date ;
- **les rivières** : carte des stations et profil de la rivière la plus proche, de l'amont vers l'aval, avec le débit quand il est publié.

On peut aussi **chercher une rivière ou une nappe** par son nom et voir toutes ses stations, de la source à l'aval pour une rivière.

Chaque donnée est située par rapport au **minimum, au maximum et à la moyenne connus à la même date** les années précédentes, dans des graphiques que l'on peut zoomer et parcourir.

> **Bêta.** Le site fonctionne mais reste jeune. Limites connues plus bas.

## Comment ça marche

Il n'y a **aucun serveur** : le site est un ensemble de fichiers statiques. Votre navigateur interroge directement les services publics de données, et la position n'est jamais envoyée ailleurs qu'à ces services, arrondie à environ 1 km.

| Donnée | Source |
|---|---|
| Prévisions, archives météo (10 ans) | [Open-Meteo](https://open-meteo.com/) — CC BY 4.0 |
| Nappes (piézomètres), rivières (hauteurs et débits) | [Hub'Eau](https://hubeau.eaufrance.fr/) — eaufrance |
| Recherche de commune | [API Géo](https://geo.api.gouv.fr/) |
| Fond de carte | [IGN — Plan IGN](https://geoservices.ign.fr/) |

Les calculs (fourchettes saisonnières, verdicts, consensus des modèles, bilan d'eau, ordre des stations le long d'une rivière) sont écrits en **Rust** et compilés en **WebAssembly** pour tourner dans le navigateur. L'interface est en TypeScript, sans framework, avec [Leaflet](https://leafletjs.com/) et [ECharts](https://echarts.apache.org/).

## Limites connues

- **La nappe mesurée n'est pas forcément la vôtre.** Un piézomètre proche peut mesurer une nappe différente de celle sous votre terrain. Le site indique la distance et le nom de la nappe.
- **Hauteur de rivière ≠ sécheresse.** Beaucoup de stations ne publient que la hauteur d'eau, souvent réglée par un barrage ou une écluse. Pour elles, le site affiche la valeur sans la comparer aux années précédentes. Seules les stations qui publient un **débit** reçoivent un verdict.
- **Référence météo sur 10 ans**, et non 30 : l'API gratuite d'Open-Meteo compte une requête longue comme de nombreux appels, et 30 ans dépasseraient sa limite par minute.
- **Évaporation de référence** : c'est celle d'un gazon théorique, un indicateur de sécheresse et non une mesure de l'eau dans votre sol.
- Le premier affichage d'une commune peut prendre quelques secondes (téléchargement des historiques). Les données sont ensuite gardées en cache dans le navigateur.

## Développement

Prérequis : Rust stable avec la cible `wasm32-unknown-unknown`, `wasm-bindgen-cli` 0.2.129, Node 24 et pnpm 10.

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked

cargo test                       # cœur Rust
bash scripts/build-wasm.sh       # compile le cœur pour le navigateur (web/src/wasm-pkg)

cd web
pnpm install
pnpm dev                         # http://localhost:5173/?c=49347 (Tiercé)
pnpm test
pnpm build
```

Les index de recherche des nappes et des rivières (`web/src/data/index-*.json`) se régénèrent avec `node scripts/build-indexes.mjs` (quelques minutes, à relancer de temps en temps).

Options de construction (variables d'environnement, facultatives) :

- `VITE_COFFEE_URL` : lien du bouton « Paye-moi un café » (masqué si vide) ;
- `VITE_GOATCOUNTER_URL` : compteur d'audience [GoatCounter](https://www.goatcounter.com/), sans cookie (désactivé si vide).

Le déploiement sur GitHub Pages est automatique à chaque push sur `main` (`.github/workflows/pages.yml`). Les deux options ci-dessus s'y règlent comme *variables* du dépôt (`COFFEE_URL`, `GOATCOUNTER_URL`).

Conception et plan : `docs/superpowers/`.

## Licence

[MIT](LICENSE). Les données restent sous la licence de leurs producteurs (voir le tableau ci-dessus).

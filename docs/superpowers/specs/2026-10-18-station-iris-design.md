# Site public météo et eau locale — conception

Date : 2026-10-18.

Nom du projet : **Station Iris** (Olivier, confirmé le 2026-10-18). Domaine retenu : `stationiris.fr`, à acheter plus tard par Olivier. « Station » pour la station météo locale, « Iris » pour la déesse de l'arc-en-ciel, lien entre le ciel et l'eau.
- Domaines `stationiris.fr`, `station-iris.fr`, `stationiris.com` et `station-iris.com` libres au 2026-10-18 (RDAP), non réservés.
- Marque à vérifier sur data.inpi.fr avant achat.

Le projet remplace `garden`. Dans ce document : « le site ».

Les choix tranchés par Olivier pendant le brainstorming sont marqués **(Olivier)**. Ceux que j'ai faits par défaut sont marqués **(choix par défaut)** et peuvent être remis en cause. Les faits externes non encore vérifiés sont marqués `[à vérifier]`.

## 1. Intention

Olivier veut une page qui lui donne, pour sa commune, une synthèse claire de la météo et de l'eau : pluie, températures, nappe, rivière. Il veut pouvoir se situer par rapport à ce qui est connu : la moyenne, le minimum et le maximum observés à cette période de l'année. D'abord pour lui, à Tiercé (49), puis pour tout le monde, partout en France.

Le tableau de bord actuel de `garden` contient déjà une bonne partie des données, mais il est jugé peu clair :
- six cartes de même poids, sans conclusion ;
- des chiffres ambigus (« 4,62 m » est une profondeur sous le sol, ce qui n'est écrit nulle part) ;
- une prévision de pluie réduite à un total sur 7 jours.

**Pourquoi c'est un bon projet pour Olivier.**
- Il part de son propre usage (Tiercé).
- Il se branche sur de vrais systèmes publics : Hub'Eau, Open-Meteo, l'API Géo de l'État.
- Il touche à l'eau et à la sécheresse.
- Il est public et gratuit, ce qui en fait aussi une vitrine.

**Ce n'est pas une entreprise.**

## 2. Critère de succès

- **(Olivier)** Succès = **quelques euros reçus** via le bouton « Paye-moi un café ».
- **(Olivier)** Mesurer la fréquentation avec un outil d'audience.
- (choix par défaut) Indicateur principal suivi : **les visiteurs qui reviennent**, plutôt que les visites.
- Suggestion non validée par Olivier : faire un point à la fin de l'été 2027, première saison de sécheresse avec le site en ligne.

## 3. Objectifs, non-objectifs, anti-objectifs

### Objectifs

- **Localisation** (Olivier) :
  - géolocalisation proposée à l'ouverture ;
  - sinon, recherche par commune ;
  - partout en France ;
  - rayon par défaut de **10 km** autour du point.
- **Trois pages** (Olivier) :
  - **Accueil** : la synthèse ;
  - **Eau** : pluie, nappe, rivière, chacune dans une section clairement séparée ;
  - **Températures**.
- **Prévisions multi-sources** (Olivier) :
  - pluie et températures à 7 jours, en combinant plusieurs modèles météo ;
  - une **moyenne**, plus une indication de l'accord entre les sources ;
  - sources **cochables / décochables** par le visiteur.
- **Se situer** (Olivier) : chaque donnée est comparée à **la moyenne, au minimum et au maximum connus** à la même période de l'année.
- **Graphiques détaillés zoomables** (Olivier) : zoom et déplacement.
- **Nappe en réservoir vertical** (Olivier, maquette B validée).
- **Rivière : carte + profil liés** (Olivier).
- **Bouton « Paye-moi un café »** (Olivier).
- **Mesure d'audience** (Olivier).

### Non-objectifs

- **Le puits** : relevés manuels, formulaire, sonde. Abandonné **(Olivier)**.
- **Les oiseaux (BirdNET)** : projet séparé **(Olivier)**.
- (choix par défaut, pour la première version) :
  - comptes utilisateurs ;
  - alertes par mail ;
  - restrictions d'eau VigiEau ;
  - projections climatiques (Climadiag) ;
  - application mobile installable ;
  - langues autres que le français.

### Anti-objectifs

Ce qui ferait échouer le site même s'il fonctionne.

- **Afficher une information trompeuse.** Le cas typique est le piézomètre le plus proche, qui mesure une autre nappe que celle du visiteur. Chaque valeur doit dire d'où elle vient, à quelle distance elle a été mesurée, et ce qu'elle mesure vraiment (par exemple « m sous le sol »).
- **Collecter des données personnelles.** (choix par défaut, cohérent avec les valeurs d'Olivier) :
  - la position du visiteur n'est ni stockée ni envoyée ailleurs qu'aux API de données ;
  - pas de cookies de pistage ;
  - pas de publicité.
- **Un site à entretenir.** Aucun serveur à administrer (voir §4).

## 4. Contraintes et architecture décidée

**Pas de serveur (Olivier, option 3).**
- Le site est un ensemble de fichiers statiques.
- Tous les appels de données partent du navigateur du visiteur.
- J'ai vérifié le 2026-10-18 que les trois API acceptent les appels depuis un navigateur (en-têtes CORS) : Hub'Eau, Open-Meteo et geo.api.gouv.fr.

**Hébergement** : GitHub Pages par défaut (choix par défaut, accepté implicitement par Olivier).
- Le déménagement reste possible plus tard, par exemple chez Infomaniak.
- Pages gratuit suppose un dépôt public `[à vérifier : conditions GitHub Pages pour un compte gratuit]`.

**Réutilisation de garden.**
- Le serveur Rust (axum, sqlx/SQLite, collecteur, Caddy, sauvegardes restic) **n'est plus utilisé**.
- La **logique métier en Rust est réutilisée**, compilée en WebAssembly et appelée par l'interface. Concerne :
  - `domain/envelope.rs` (enveloppe saisonnière min/max par date, ±3 jours, années antérieures) ;
  - `domain/water_balance.rs` (pluie moins ETP) ;
  - `domain/rain_outlook.rs` ;
  - le décodage des réponses Hub'Eau et Open-Meteo.
- Le travail **non commité** sur la hauteur de rivière (`sources/hydrometrie.rs`, `store/river.rs`, migration `river_stage`), présent dans le répertoire de travail depuis le 2026-09-20, contient la connaissance utile sur l'endpoint `obs_elab` et la grandeur `HIXnJ`. Il est à récupérer.

**Interface** (choix par défaut) :
- TypeScript, sans gros framework si possible ;
- construction avec Vite et pnpm, la pile par défaut d'Olivier ;
- cœur Rust compilé avec `wasm-pack` / `wasm-bindgen`.

**Cache** (choix par défaut) :
- côté navigateur (IndexedDB), avec une durée de vie par type de donnée : prévisions quelques heures, historiques un jour ;
- le premier affichage d'une commune peut prendre quelques secondes, avec un indicateur de chargement honnête.

## 5. Contenu des pages

### Partout

- Une barre de navigation : Accueil · Eau · Températures.
- La commune ou position courante, toujours visible.
- Un champ de recherche de commune, avec autocomplétion via geo.api.gouv.fr.
- Le bouton « Paye-moi un café » en pied de page (choix par défaut sur l'emplacement).

### Accueil (synthèse)

Une tuile par sujet. Chacune affiche **un chiffre et une phrase**, et mène à sa page (choix par défaut, maquette `pages-v2`, non contesté) :
- **Pluie 7 jours** : total prévu, et prochain jour de pluie probable.
- **Températures** : minimum et maximum du jour. Signalement du gel s'il est prévu dans les 7 jours (choix par défaut, non contesté).
- **Nappe** : verdict pour le piézomètre le plus proche, par exemple « basse pour la mi-octobre ».
- **Rivière** : hauteur à la station la plus proche, et sa position dans la fourchette.

### Page Eau

Trois sections séparées visuellement : une couleur par section, une phrase-verdict en tête.

**1. Pluie**
- Prévision à 7 jours jour par jour : barre en mm (moyenne des sources cochées), puis « N sources sur M prévoient de la pluie ».
- Seuil de « pluie » : 1 mm (`SIGNIFICANT_RAIN_MM`, existant).
- Bilan sécheresse sur 7 et 30 jours (pluie moins évapotranspiration de référence), avec une explication courte.
- Graphique de la pluie cumulée comparée à la moyenne, au minimum et au maximum connus.

**2. Nappe**
- Carte des piézomètres dans le rayon. Chacun est dessiné en **réservoir vertical** (maquette `nappe-b-v2`) :
  - haut du réservoir = profondeur la plus faible connue à cette date (année la plus humide) ;
  - bas du réservoir = la plus forte (année la plus sèche) ;
  - niveau de l'eau = aujourd'hui.
- Les valeurs sont toujours écrites « X m sous le sol ».
- La phrase-verdict utilise des mots simples : basse, normale, haute.
- S'il n'y a **aucun piézomètre à moins de 10 km** : le dire, et afficher le plus proche avec sa distance.
- Garde-fou sur la représentativité : afficher la distance, et si possible la nappe concernée (nom de l'entité hydrogéologique). Hub'Eau expose des codes BDLISA sur les stations `[à vérifier]`.
- Graphique zoomable de la station choisie.

**3. Rivière**
- **Carte** : stations hydrométriques du rayon sur un fond de carte. Chacune affiche un petit réservoir entre son minimum et son maximum connus à cette date, et sa hauteur du jour.
- **Profil** au-dessus de la carte : les stations d'une même rivière ordonnées de l'amont vers l'aval.
- **Survol (ou toucher sur mobile) d'une station sur la carte = sa jauge mise en avant dans le profil**, et inversement **(Olivier pour le sens carte → profil ; réciprocité et toucher = choix par défaut)**.
- Limite à afficher : certaines hauteurs sont des niveaux de bief, réglés par un barrage ou une écluse. C'est déjà le cas de « la Sarthe à Châteauneuf » dans garden. Ce sont des repères, pas des indicateurs de sécheresse.
- Graphique zoomable.

### Page Températures

- **7 prochains jours** (maquette `previsions-multi`) :
  - pour le minimum et le maximum de chaque jour : valeur moyenne des sources cochées ;
  - **bande** montrant l'écart entre les sources (de la plus basse à la plus haute) ;
  - au survol d'un jour : le détail source par source ;
  - gel mis en évidence.
- **Graphique** des températures observées, comparées à la moyenne, au minimum et au maximum connus à la même date.

### Sélecteur de sources

- Une liste de cases à cocher, une par modèle météo.
- Elle s'applique aux prévisions de pluie et de températures.
- Le choix est mémorisé dans le navigateur (choix par défaut).
- Au moins une source doit rester cochée.

### Graphiques (modèle commun, maquette `graphique-enveloppe` validée)

- **Bande** min–max connus, jour par jour.
- **Ligne pointillée** = moyenne.
- **Ligne pleine** = cette année, avec un point pour aujourd'hui.
- Boutons de période : 1 mois, 3 mois, 1 an, 5 ans, tout.
- Zoom à la molette, déplacement en glissant, gestes équivalents sur mobile.
- Pour la nappe, l'axe est orienté pour que **plus haut = plus d'eau**.

## 6. Sources de données

| Donnée | Source | Notes |
|---|---|---|
| Recherche de commune | geo.api.gouv.fr (`/communes`) | CORS vérifié. |
| Prévisions pluie / températures multi-modèles | Open-Meteo, paramètre `models=` | Modèles candidats : Météo-France (AROME/ARPEGE), ECMWF, ICON, GFS `[à vérifier : noms exacts et couverture]`. L'API « ensemble » (dizaines de variantes par modèle) est une piste pour de vraies probabilités `[à vérifier]`. |
| Pluie, ETP et températures passées (enveloppes) | Open-Meteo archive | Déjà utilisé par garden (`backfill_days = 730`). Pour une enveloppe sur plus d'années, élargir la profondeur d'archive. |
| Nappes : stations dans le rayon | Hub'Eau `niveaux_nappes/stations` | Recherche géographique `[à vérifier : paramètres bbox/distance]`. |
| Nappes : chroniques | Hub'Eau `niveaux_nappes/chroniques` | Déjà utilisé. Champ `profondeur_nappe` = profondeur sous le sol. |
| Rivières : stations dans le rayon | Hub'Eau hydrométrie, référentiel des stations | Ordonnancement amont → aval à trouver (voir §8). |
| Rivières : hauteurs journalières | Hub'Eau hydrométrie `obs_elab`, grandeur `HIXnJ` | Déjà implémenté dans le travail non commité. Historique depuis 2011 pour Châteauneuf. |
| Fond de carte | IGN Géoplateforme ou OpenStreetMap | Choix par défaut : IGN (public, français). Bibliothèque Leaflet. |

**Conditions d'utilisation à vérifier avant mise en ligne** : celles d'Open-Meteo pour un site public avec bouton de don, notamment les limites d'appels gratuits et la définition de l'usage commercial `[à vérifier]`.

## 7. Mesure d'audience et don

- **Audience** :
  - outil sans cookies, dispensé de consentement selon les conditions de la CNIL `[à vérifier : conditions précises]` ;
  - candidats : GoatCounter, Umami, Plausible. Choix laissé au constructeur, sur le critère gratuit, sans cookie et hébergé en Europe si possible.
- **Don** :
  - service de « café » au nom personnel d'Olivier, et non de la SASU, en cours de fermeture ;
  - candidats : Ko-fi, Buy Me a Coffee, Tipeee, Liberapay ;
  - déclaration fiscale des dons reçus `[à vérifier]`.

## 7 ter. Décisions d'Olivier après relecture (2026-10-18)

- **Rivière (Olivier, option b)** :
  - on utilise le **débit** quand la station en publie, avec fourchette min/max/moyenne et verdict ;
  - sinon, on affiche **la hauteur seule, sans fourchette ni verdict**, avec la mention « niveau pouvant être réglé par un ouvrage » ;
  - le réservoir de la carte et la tuile d'accueil suivent la même règle.
  - Raison : à Châteauneuf, la hauteur est un niveau de bief bimodal (paliers vers 3,0 m et 1,8 m) et Hub'Eau n'y publie pas de débit (constat du code garden, `dashboard.rs`, `RiverSnapshot`).
- **Profil de rivière (Olivier, « ok » à la proposition)** :
  - la carte reste limitée au rayon de 10 km ;
  - le profil montre **la rivière la plus proche sur environ 30 km en amont et 10 km en aval** du point.
- **Dépôt (Olivier, « ok » à la proposition)** : **nouveau dépôt** où l'on recopie le cœur Rust utile. `garden` reste privé et n'est pas publié.
- **Charte graphique (Olivier)** : « moderne et vraiment chouette ». **Direction A « éditorial clair » retenue** (maquette `charte.html`, option A) :
  - fond papier crème ;
  - titres à empattements (Fraunces), texte en Inter ;
  - une grande phrase de synthèse en tête de l'accueil ;
  - tuiles séparées par des filets fins ;
  - accent terre cuite pour les alertes, bleu-pétrole pour l'eau.
- **Mode clair / sombre (Olivier)** : un bouton ☀️/🌙.
  - (choix par défaut) Par défaut, le site suit le réglage de l'appareil, et le choix du visiteur est mémorisé dans son navigateur.
  - La palette sombre de référence est la maquette `charte-a-clair-sombre.html`.
- **La météo fait partie du projet au même titre que l'eau (Olivier)** : pluie et températures ne sont pas des annexes de l'eau.

## 7 bis. Règles tranchées après relecture (choix par défaut)

- **Verdict de position** (nappe, et toute donnée comparée à sa fourchette) :
  - on calcule la position relative de la valeur du jour entre le min et le max connus à cette date ;
  - tiers inférieur → « basse », tiers central → « normale », tiers supérieur → « haute » ;
  - hors fourchette → « plus basse (haute) que toutes les années connues à cette date ».
  - Pour la nappe, « basse » = profondeur proche de la plus grande connue. Le code actuel ne qualifiait que les valeurs hors fourchette : ce comportement est remplacé.
- **Période de référence (« connus »)** :
  - nappes et rivières : **toutes les années disponibles** pour la station, en excluant l'année en cours (logique `seasonal_envelope` actuelle) ;
  - pluie et températures : **les 30 dernières années complètes** de l'archive Open-Meteo, pour rester proche d'une normale climatique et limiter le volume téléchargé ;
  - le nombre d'années utilisées est toujours affiché (« sur 11 ans »).
- **Piézomètre de la tuile d'accueil** : le plus proche, avec sa distance et le nom de la nappe mesurée quand Hub'Eau le fournit. La carte de la page Eau montre tous ceux du rayon. Une sélection « plus représentative » est hors première version.
- **Audience** : visites seulement, sans cookies ni marqueur persistant, donc sans bandeau. L'indicateur « visiteurs qui reviennent » est abandonné. Le critère de succès d'Olivier (euros reçus) ne dépend pas de l'audience.
- **Open-Meteo** :
  - les conditions (lues le 2026-10-18 sur open-meteo.com/en/terms) réservent l'API gratuite à l'usage non commercial ;
  - elles citent comme non commerciaux les « private or non-profit sites or apps with no subscriptions or advertising » ;
  - les dons ne sont pas mentionnés ;
  - limites gratuites : < 10 000 appels/jour, 5 000/heure, 600/minute, 300 000/mois, sans préciser si c'est par adresse IP ;
  - licence des données : CC-BY 4.0 (attribution à afficher).
  - **Avant mise en ligne**, écrire à Open-Meteo pour confirmer qu'un site sans pub ni abonnement, avec un bouton de don, reste non commercial, et comment les limites s'appliquent aux appels faits depuis les navigateurs des visiteurs. Si la réponse est négative, on retire le bouton de don plutôt que d'ajouter un serveur.

## 8. Laissé au constructeur

- Le découpage précis du cœur Rust (crate `core` compilable en `wasm32`, sans tokio ni sqlx) et de l'interface TypeScript.
- La bibliothèque de graphiques. uPlot est déjà utilisé et sait zoomer : vérifier qu'il gère la molette et le déplacement, sinon passer à une bibliothèque plus complète (ECharts par exemple).
- **L'ordre amont → aval des stations d'une rivière.** Pistes :
  - la hiérarchie des codes de station Sandre `[à vérifier]` ;
  - la position le long du tracé du cours d'eau (BD TOPAGE) ;
  - à défaut, un tri approximatif par altitude ou par distance le long de la ligne.
- La stratégie de cache et de rafraîchissement.
- La gestion des sources indisponibles : afficher la donnée manquante, sans faire planter la page.

## 9. Points encore ouverts

- **Nom** : « Station Iris » à confirmer après vérification INPI et achat du domaine par Olivier. Le nom de domaine n'est pas nécessaire pour construire : GitHub Pages fournit une adresse provisoire.
- **Licence du dépôt public** : (choix par défaut) MIT, comme `fiches-lecture`, sauf avis contraire d'Olivier.
- **Dépôt** : nouveau dépôt (Olivier). Nom provisoire `station-iris`. Ce document y sera déplacé à sa création.

## 10. Maquettes de référence

Dans `docs/maquettes/` :
- `pages-v2.html` (structure des trois pages) ;
- `nappe-b-v2.html` (réservoir vertical corrigé) ;
- `riviere.html` (carte + profil) ;
- `graphique-enveloppe.html` (graphique type) ;
- `previsions-multi.html` (prévisions multi-sources).

Les chiffres des maquettes sont en partie inventés.

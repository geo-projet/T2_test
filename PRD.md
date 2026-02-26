# Document d'Exigences Produit (PRD) : Assistant RAG Environnemental Hybride

**Dernière mise à jour :** Février 2026
**État actuel :** Phase 3 terminée — Filtre Spatial (Lien carte–RAG)

---

## 1. Vision du Produit

Développer une plateforme web permettant à des experts en environnement d'interroger en langage naturel une base de connaissances complexe, de croiser ces données avec la littérature scientifique ouverte, et de visualiser les données géospatiales associées sur une carte interactive. L'application agit comme un poste de travail expert unifié : analyse documentaire, recherche scientifique et exploration cartographique dans une seule interface.

---

## 2. Profil Utilisateur & Périmètre

* **Cible :** Experts du domaine (scientifiques, ingénieurs environnementaux).
* **Attentes :** Précision des données chiffrées, transparence des sources, absence d'hallucination, distinction claire entre données internes et externes, visualisation spatiale des données de terrain.
* **Contraintes Techniques :**
  * **Priorité des données :** Les données du partenaire (internes) sont la source de vérité primaire.
  * **Figures & Graphiques :** Les figures des PDF doivent être décrites textuellement pour être interprétées par le LLM.
  * **Science Ouverte :** La recherche externe doit se faire en temps réel (pas de base statique) pour garantir la fraîcheur.
  * **Langue :** L'interface est en français ; les requêtes en mode Science sont automatiquement traduites en anglais pour maximiser la couverture de la littérature scientifique.
  * **Données géospatiales :** Les fichiers GeoJSON sont servis depuis un répertoire local, organisés en groupes.

---

## 3. Fonctionnalités

### A. Ingestion et Parsing (Backend) — TERMINÉ

1. **Extraction des Tableaux :**
   - Structure Ligne/Colonne/En-tête préservée via LlamaParse (export Markdown).
   - Métadonnées enrichies : `content_type = "table"` pour les chunks contenant des tableaux.

2. **Traitement des Figures :**
   - Extraction via LlamaParse en mode `markdown`.
   - *À venir (Phase 3) :* description textuelle détaillée via modèle Vision.

3. **Citations Granulaires :**
   - Chaque chunk conserve : `file_name`, `page_label`, `content_type` (text / table).

---

### B. Moteur RAG & Recherche — TERMINÉ

1. **Trois modes de recherche :**

   | Mode | Comportement |
   |---|---|
   | `internal` | RAG vectoriel sur les PDF internes (top-5 chunks). |
   | `hybrid` | RAG interne (top-3) + recherche web générale Tavily (2 résultats). Synthèse comparative structurée. |
   | `science` | Recherche Tavily filtrée sur domaines scientifiques (5 résultats). Requête traduite FR→EN automatiquement. Réponse bilingue. |

2. **Traduction automatique (Mode Science) :**
   - La requête française est traduite en anglais par le LLM avant l'appel Tavily.
   - La traduction anglaise est affichée sous la bulle de message de l'utilisateur dans le chat (texte gris italique avec icône globe).
   - Si la requête est déjà rédigée en anglais, aucune traduction n'est affichée.
   - La réponse est générée en français (section principale) puis en anglais (section secondaire en blockquote markdown).

3. **Synthèse Comparative (Mode Hybride) :**
   - Réponse structurée en deux sections : **Selon les données internes du partenaire** / **Selon la littérature scientifique récente**.
   - Règles anti-hallucination strictes dans le prompt système.

---

### C. Interface Utilisateur — TERMINÉ

1. **Authentification :**
   - Page de login avec validation côté serveur (credentials dans `.env`).
   - Token de session cryptographique (`secrets.token_urlsafe`) invalidé côté serveur au logout.

2. **Sélecteur de mode :** Boutons Interne / Hybride / Science dans l'en-tête du chat.

3. **Bandeau d'information :** Avertissement automatique en mode Science (traduction + réponse bilingue).

4. **Affichage de la traduction (Mode Science) :**
   - La traduction anglaise de la requête apparaît sous la bulle bleue de l'utilisateur.
   - Affiché uniquement si la requête originale était en français (détection par comparaison normalisée).
   - Style : texte `xs` gris italique, aligné à droite, avec icône globe.

5. **Citations Cliquables :**
   - Source interne → ouvre la visionneuse PDF directement à la page citée.
   - Source externe → ouvre l'URL dans un nouvel onglet.

6. **Visionneuse PDF intégrée :**
   - Navigation par page, zoom, chargement authentifié (Authorization header).

7. **Affichage des sources :** Badges type (Interne/Externe, Texte/Tableau), score de pertinence, extrait du chunk.

---

### D. Cartographie Intégrée (OpenLayers) — TERMINÉ

1. **Déclenchement :**
   - Icône carte dans l'en-tête du chat ; un clic ouvre le panneau cartographique.
   - Layout adaptatif : chat RAG réduit à 1/3, carte à 2/3 de la largeur de l'écran.

2. **Fonds de carte :**
   - OpenStreetMap (défaut).
   - Google Satellite.
   - Bascule par radio buttons dans l'interface.

3. **Gestion des couches GeoJSON :**
   - Sidebar d'exploration : groupes de couches (sous-dossiers), activation par case à cocher.
   - Sélecteur de couleur par couche individuelle.
   - Zoom automatique sur l'étendue de la couche activée.
   - Chargement dynamique depuis un répertoire local (`GEOJSON_PATH`).

4. **Outils cartographiques :**
   - **Navigation** (défaut) : pan et zoom.
   - **Sélection** : clic sur une entité → affichage de ses attributs dans un panneau flottant.
   - **Dessin ROI** : tracé de rectangles de zone d'intérêt (efface avec bouton dédié).
   - **WMS** : bouton dans la toolbar ouvrant une interface d'ajout de service WMS externe.

5. **Données GeoJSON :**
   - Servies par deux routes API Next.js internes (`/api/layers`, `/api/layers/data`).
   - Répertoire configurable via variable d'environnement `GEOJSON_PATH`.
   - Sécurité : vérification anti-path-traversal, validation de l'extension de fichier.

6. **Outil WMS (Web Map Service) :**
   - Bouton dédié dans la toolbar cartographique.
   - Interface modale : saisie d'une URL WMS (http/https), chargement des couches disponibles via `GetCapabilities`.
   - Sélection multiple de couches avec nom technique et titre lisible.
   - Couches ajoutées superposées à la carte en `EPSG:4326`, compatibles avec les couches GeoJSON locales.
   - Couches WMS actives listées dans la sidebar avec bouton de retrait individuel.
   - **Proxy CORS** : GetCapabilities et tuiles WMS transitent par des routes API Next.js (`/api/wms-proxy`, `/api/wms-tiles`) pour contourner les restrictions CORS des serveurs externes.

7. **Export GeoPackage (.gpkg) :**
   - Bouton "Exporter → .gpkg" fixe en bas de la sidebar cartographique.
   - Actif uniquement si au moins une couche GeoJSON est cochée ; compteur de couches sélectionnées affiché.
   - Spinner + désactivation du bouton pendant l'export (état `isExporting`).
   - Les couches WMS sont **exclues** de l'export (données serveur distantes).
   - **Backend** : endpoint `POST /export/gdb` (FastAPI, authentifié) — charge les GeoJSON via `/api/layers/data`, construit un GeoPackage multi-couches via `pyogrio` (driver GPKG), retourne le fichier directement.
   - Chaque couche prend le nom de la sous-couche sélectionnée (sans extension, caractères sanitisés pour la compatibilité OGR).
   - Couches GeoJSON vides (0 entité) ignorées silencieusement.
   - **Format GeoPackage** : standard OGC, fichier SQLite unique, supporté nativement par QGIS, ArcGIS Pro, GDAL, PostGIS, FME. Préféré au format ESRI File Geodatabase (.gdb) dont le driver GDAL OpenFileGDB write ne préserve pas les noms de feature classes dans son catalogue interne.
   - Dépendances backend : `geopandas`, `pyogrio` (importés en lazy pour ne pas crasher le backend si absents).

8. **Filtre Spatial (Lien carte–RAG) :**
   - L'outil ROI (dessin rectangle) détecte les couches GeoJSON dont les entités intersectent la zone dessinée.
   - Convention de nommage : `Zone_A.geojson` ↔ `Zone_A.pdf` — correspondance automatique par stem de fichier.
   - Flux complet : dessin ROI → `matchedLayerIds` → `extractPdfStem()` → `document_filter: string[]` envoyé au backend avec chaque requête `/chat`.
   - **Backend** : `filter_nodes_by_document_stems()` filtre les nœuds ChromaDB après retrieval (correspondance partielle : le stem du groupe doit être contenu dans le stem du PDF).
   - **Mode interne filtré** : retriever séparé (top-5) → filtre → synthèse LLM directe via `achat()` avec contexte filtré.
   - **Mode hybride filtré** : filtre appliqué sur `source_nodes` du query engine interne avant la synthèse comparative.
   - **Mode Science** : `document_filter` ignoré (Tavily uniquement, pas de ChromaDB).
   - **Fallback silencieux** : si le filtre éliminerait tous les nœuds, le système retourne les résultats non filtrés (pas d'erreur).
   - **UI** : badge indicateur sous les boutons de mode — vert (couches trouvées dans la ROI) / orange (aucune couche intersectante).
   - `spatial_filter_active: bool` dans `QueryResponse` → note émeraude dans le panneau sources indiquant que la réponse est géographiquement filtrée.
   - `roiFilter` réinitialisé à la fermeture du panneau carte.

---

## 4. Roadmap de Développement

### ✅ Phase 1 — MVP (Fiabilité Interne) — TERMINÉ

- Pipeline d'ingestion PDF (texte + tableaux via LlamaParse).
- Indexation vectorielle ChromaDB.
- RAG sur données internes, citations avec numéro de page.
- Interface de chat simple avec visionneuse PDF.

### ✅ Phase 2 — V1 (Intelligence Hybride) — TERMINÉ

- Authentification sécurisée (backend) : endpoint `/login`, `/logout`, tokens cryptographiques.
- Mode Hybride : RAG interne + recherche web Tavily, synthèse comparative.
- Mode Science : filtrage sur domaines scientifiques, traduction automatique FR→EN, réponse bilingue.
- Bandeau d'avertissement mode Science dans l'UI.
- Appels LLM entièrement asynchrones (`achat`).
- Affichage de la traduction anglaise sous la bulle de l'utilisateur en Mode Science (si requête en français).

### ✅ Phase 2.5 — Cartographie (Visualisation Géospatiale) — TERMINÉ

- Intégration OpenLayers dans le frontend Next.js.
- Bouton carte dans l'en-tête, layout 1/3 RAG / 2/3 carte.
- Sidebar de gestion des couches GeoJSON (groupes, checkboxes, couleurs).
- Fonds de carte OSM et satellite, outils navigation/sélection/dessin.
- Routes API Next.js pour servir les données GeoJSON depuis le système de fichiers local.
- Outil WMS : ajout de services externes via GetCapabilities, sélection de couches, superposition EPSG:4326.
- Proxy CORS Next.js pour GetCapabilities (`/api/wms-proxy`) et tuiles WMS (`/api/wms-tiles`).
- **Export GeoPackage** : bouton sidebar → téléchargement `export_couches.gpkg` multi-couches, noms de couches préservés, authentifié, couches WMS exclues.

### ✅ Phase 3 — Lien carte–RAG (Filtre Spatial) — TERMINÉ

- Outil ROI expose la bbox et les couches intersectantes au parent via `onRoiChange`.
- Convention de nommage automatique stem GeoJSON ↔ stem PDF.
- `document_filter` transmis au backend dans chaque requête `/chat`.
- `filter_nodes_by_document_stems()` backend : filtre ChromaDB avec fallback silencieux.
- Mode interne : chemin filtré (retrieval + filtre + LLM direct) et chemin non filtré coexistent.
- Mode hybride : filtre sur les nœuds internes avant synthèse comparative.
- Badge indicateur vert/orange dans l'UI ; note émeraude dans le panneau sources.
- `spatial_filter_active` dans `QueryResponse` et `spatialFilterActive` dans `Message`.

### Phase 4 — V2 (Autonomie & UX) — À VENIR

- **Upload de PDF temporaires :** analyse ad hoc sans réindexation permanente.
- **Historique des sessions :** sauvegarde et rechargement des conversations.
- **Export réponses :** téléchargement des réponses en PDF ou Markdown.
- **Description des figures :** intégration d'un modèle Vision pour les graphiques.

### Hors-Périmètre (Actuel)

- Génération de nouveaux graphiques ou images.
- Modification des documents sources.
- Application mobile native.
- Réponses sur des sujets généralistes (météo, actualités, etc.).
- Édition des données GeoJSON depuis l'interface.

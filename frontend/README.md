# Frontend — Assistant RAG Environnemental

Interface Next.js de l'assistant RAG environnemental. Se connecte à l'API FastAPI backend.

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **react-markdown** — rendu des réponses LLM
- **react-pdf** — visionneuse PDF intégrée
- **OpenLayers (`ol`)** — carte interactive avec couches GeoJSON

## Démarrage

```bash
npm install
```

Créer `.env.local` à la racine du dossier `frontend/` :

```env
# URL de l'API backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Chemin vers le répertoire GeoJSON (relatif à frontend/)
# Structure attendue : <GEOJSON_PATH>/<groupe>/<fichier>.geojson
GEOJSON_PATH=../../mpk_to_geojson/geojson_dir
```

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Structure

```
frontend/
├── app/
│   ├── page.tsx          # Interface principale (chat + toggle carte + modes de recherche)
│   ├── layout.tsx        # Layout global
│   ├── globals.css
│   └── api/
│       └── layers/
│           ├── route.ts        # GET /api/layers — liste des groupes et couches GeoJSON
│           └── data/route.ts   # GET /api/layers/data?path=... — contenu d'une couche
├── components/
│   ├── LoginPage.tsx     # Page de connexion (POST /login backend)
│   ├── PDFViewer.tsx     # Visionneuse PDF avec Authorization header
│   ├── MapComponent.tsx  # Carte OpenLayers (fonds OSM/Satellite, couches GeoJSON, outils)
│   ├── MapSidebar.tsx    # Panneau de gestion des couches (groupes, checkboxes, couleurs)
│   ├── ToolButton.tsx    # Bouton d'outil carte réutilisable
│   └── ui/               # Composants shadcn/ui (Button, Input, Card, etc.)
└── lib/
    └── utils.ts
```

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de base de l'API backend | `http://localhost:8000` |
| `GEOJSON_PATH` | Chemin vers le répertoire GeoJSON (relatif à `frontend/`) | `../mpk_to_geojson/geojson_dir` |

## Données cartographiques

Placer les fichiers GeoJSON dans le répertoire pointé par `GEOJSON_PATH`, organisés en sous-dossiers (groupes) :

```
<GEOJSON_PATH>/
  sites/
    zone_etude.geojson
    points_mesure.geojson
  bassins_versants/
    bassin_principal.geojson
```

Les sous-dossiers deviennent des groupes de couches dans la sidebar cartographique.

## Scripts

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run start    # Serveur de production
npm run lint     # ESLint
```

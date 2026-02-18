# Frontend — Assistant RAG Environnemental

Interface Next.js de l'assistant RAG environnemental. Se connecte à l'API FastAPI backend.

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **react-markdown** — rendu des réponses LLM
- **react-pdf** — visionneuse PDF intégrée

## Démarrage

```bash
npm install
```

Créer `.env.local` à la racine du dossier `frontend/` :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Structure

```
frontend/
├── app/
│   ├── page.tsx          # Interface de chat (auth + modes de recherche + sources)
│   ├── layout.tsx        # Layout global
│   └── globals.css
├── components/
│   ├── LoginPage.tsx     # Page de connexion (POST /login backend)
│   ├── PDFViewer.tsx     # Visionneuse PDF avec Authorization header
│   └── ui/               # Composants shadcn/ui (Button, Input, Card, etc.)
└── lib/
    └── utils.ts
```

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de base de l'API backend | `http://localhost:8000` |

## Scripts

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run start    # Serveur de production
npm run lint     # ESLint
```

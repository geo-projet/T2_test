# Assistant RAG Environnemental Hybride

Plateforme web permettant à des experts en environnement d'interroger en langage naturel une base de connaissances constituée de rapports PDF techniques internes, avec possibilité de croiser ces données avec la littérature scientifique ouverte en temps réel.

## Fonctionnalités implémentées

### Modes de recherche
| Mode | Description |
|---|---|
| **Interne** | RAG sur les PDF internes uniquement. Réponse citant la page et le document source. |
| **Hybride** | RAG interne + recherche web générale (Tavily). Réponse structurée en deux sections distinctes. |
| **Science** | Recherche dans la littérature scientifique (domaines filtrés via Tavily). La requête est automatiquement traduite FR→EN. Réponse bilingue : français d'abord, version anglaise originale en dessous. |

### Autres fonctionnalités
- **Authentification** : login sécurisé via credentials stockés côté serveur (`.env`), token d'accès par session
- **Visionneuse PDF** : ouverture du document source directement à la page citée, avec navigation et zoom
- **Citations cliquables** : sources internes (PDF) et externes (URL) cliquables depuis la réponse
- **Anti-hallucination** : prompts système avec règles strictes de citation et d'interdiction d'extrapolation

---

## Stack technique

### Backend (Python)
| Composant | Choix |
|---|---|
| API | FastAPI |
| Orchestration RAG | LlamaIndex |
| Parsing PDF | LlamaParse (API LlamaCloud) |
| Base vectorielle | ChromaDB (persistant local) |
| Embeddings | OpenAI `text-embedding-3-small` |
| LLM | OpenAI `gpt-4o` |
| Recherche web | Tavily API |
| Auth | `secrets` Python (token in-memory) |

### Frontend (Next.js)
| Composant | Choix |
|---|---|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Markdown | react-markdown |
| PDF | react-pdf (pdfjs-dist) |

---

## Structure du projet

```
.
├── backend/
│   ├── data/               # PDF à ingérer (à créer)
│   ├── chroma_db/          # Base vectorielle persistante (générée par ingest.py)
│   ├── main.py             # API FastAPI (endpoints /login, /logout, /chat, /pdf)
│   ├── ingest.py           # Script d'ingestion et d'indexation des PDF
│   ├── requirements.txt    # Dépendances Python
│   └── .env.example        # Variables d'environnement requises
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Interface de chat principale
│   │   └── layout.tsx      # Layout global
│   ├── components/
│   │   ├── LoginPage.tsx   # Page de connexion
│   │   ├── PDFViewer.tsx   # Visionneuse PDF avec authentification
│   │   └── ui/             # Composants shadcn/ui
│   └── lib/
├── PRD.md
├── TECH_STACK_RECOMMENDATION.md
└── README.md
```

---

## Installation et démarrage

### Prérequis
- Python 3.10+
- Node.js 18+
- Clés API : OpenAI, LlamaCloud, Tavily

### 1. Backend

```bash
cd backend

# Créer et activer l'environnement virtuel
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
# source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

Créer le fichier `backend/.env` à partir de `.env.example` :

```env
OPENAI_API_KEY=sk-...
LLAMA_CLOUD_API_KEY=llx-...
TAVILY_API_KEY=tvly-...
TAVILY_INCLUDE_DOMAINS=nature.com,science.org,pubmed.ncbi.nlm.nih.gov

# Obligatoire — identifiants de connexion à l'application
AUTH_USERNAME=votre_nom_utilisateur
AUTH_PASSWORD=votre_mot_de_passe_securise

DATA_DIR=./data
CHROMA_DB_DIR=./chroma_db
```

Déposer les PDF dans `backend/data/`, puis indexer :

```bash
python ingest.py
```

Lancer l'API :

```bash
# Développement (rechargement auto)
fastapi dev main.py

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

API disponible sur `http://localhost:8000` — documentation Swagger sur `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
```

Créer `frontend/.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Lancer le serveur de développement :

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

---

## Utilisation

1. Déposer les PDF techniques dans `backend/data/`
2. Exécuter `python ingest.py` pour indexer les documents
3. Lancer le backend (`fastapi dev main.py`) et le frontend (`npm run dev`)
4. Ouvrir `http://localhost:3000`, se connecter avec les credentials définis dans `.env`
5. Choisir le mode de recherche et poser une question

---

## Endpoints API

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/login` | Non | Authentification, retourne un token |
| `POST` | `/logout` | Oui | Invalide le token de session |
| `POST` | `/chat` | Oui | Requête RAG (modes : internal, hybrid, science) |
| `GET` | `/pdf/{filename}` | Oui | Sert un PDF depuis `data/` |

---

## Roadmap

- [x] Phase 1 — MVP : ingestion PDF, RAG interne, citations sources
- [x] Phase 2 — V1 : mode hybride (interne + web), mode science (littérature filtrée + traduction auto), authentification sécurisée
- [ ] Phase 3 — V2 : upload de PDF temporaires, historique des sessions, export des réponses

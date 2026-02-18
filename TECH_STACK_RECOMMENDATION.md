# Rapport Tech Stack : Assistant RAG Environnemental

**Date :** 26 Janvier 2026 — **Mis à jour :** Février 2026
**Statut :** Options retenues marquées ✅ — Implémentées en Phase 1 & 2.

---

## 1. Analyse des Contraintes & Objectifs

L'objectif critique du MVP est la **fiabilité de l'ingestion**. Le PRD spécifie que les documents sont techniques, riches en tableaux et figures, et que ces éléments doivent être interprétables par le LLM (Ligne/Colonne pour les tableaux, descriptions textuelles pour les images).

Cela déplace la complexité de l'application du "Chat" vers le **Pipeline d'Ingestion (ETL)**.

---

## 2. Comparaison des Options Techniques

### A. Moteur d'Ingestion & Parsing

| Option | Description | Avantages | Inconvénients |
| :--- | :--- | :--- | :--- |
| **1. PyMuPDF + Custom Logic** | Extraction manuelle bas niveau. | 100% gratuit, local, rapide. | Très complexe sur tableaux denses. |
| **2. Unstructured.io** | Librairie polyvalente multi-formats. | Populaire, version locale. | Lourd à installer, imprécis sur tableaux denses. |
| **3. LlamaParse (LlamaIndex)** ✅ | API spécialisée PDF complexes. | État de l'art pour tableaux. Intégration native LlamaIndex. | API externe (données sortent temporairement). |
| **4. Docling (IBM)** | Librairie open-source locale. | Exécution locale, export Markdown/JSON propre. | Écosystème plus jeune. |

**Choix retenu : LlamaParse** — meilleure précision sur les tableaux denses, intégration directe avec LlamaIndex, export Markdown structuré. Configuration : `result_type="markdown"`, `language="fr"`, 4 workers parallèles.

---

### B. Base de Données Vectorielle

| Option | Description | Verdict |
| :--- | :--- | :--- |
| **1. ChromaDB** ✅ | Base vectorielle open-source Python-native. | Simple, persistant local (`./chroma_db`), parfait pour le dev et la prod single-server. |
| **2. LanceDB** | Base vectorielle sur fichier, très rapide. | Excellente option si multi-modal requis. |
| **3. Qdrant (Docker)** | Moteur de recherche vectorielle robuste. | Overkill pour ce périmètre, nécessite Docker. |

**Choix retenu : ChromaDB** — mode persistant local, intégration `llama-index-vector-stores-chroma`, suppression/recréation de collection à chaque ingestion pour éviter les doublons.

---

### C. Orchestration LLM

| Option | Verdict |
| :--- | :--- |
| **LlamaIndex** ✅ | Conçu pour le RAG complexe et l'indexation structurée avec métadonnées. |
| **LangChain** | Flexible mais abstraction parfois lourde pour des pipelines de données précis. |

**Choix retenu : LlamaIndex** — `VectorStoreIndex`, `as_query_engine(similarity_top_k=N)`, support natif des métadonnées de nodes (page, fichier, type de contenu).

---

### D. LLM & Embeddings

| Composant | Choix | Détail |
| :--- | :--- | :--- |
| **LLM** ✅ | OpenAI `gpt-4o` | Température 0 pour maximiser la précision. Appels asynchrones via `achat()`. |
| **Embeddings** ✅ | OpenAI `text-embedding-3-small` | Bon compromis performance/coût pour le RAG. |

---

### E. Recherche Web (Science Ouverte)

| Option | Verdict |
| :--- | :--- |
| **Tavily API** ✅ | API de recherche sémantique, supporte les filtres de domaines (`include_domains`). Deux usages : web général (mode Hybride) et domaines scientifiques filtrés (mode Science). |
| **Serper / SerpAPI** | Alternative, orientée Google Search. Moins de contrôle sur le filtrage de domaines. |

**Choix retenu : Tavily** — `search_depth="advanced"`, `include_domains` configurables via `.env` (`TAVILY_INCLUDE_DOMAINS`), dégradation gracieuse si clé absente.

---

### F. Backend API

| Option | Verdict |
| :--- | :--- |
| **FastAPI** ✅ | Support natif async (crucial pour LLM + Tavily en parallèle), validation Pydantic, Swagger auto-généré. |
| **Flask/Django** | Moins adaptés à l'async et au streaming LLM. |

**Implémenté :** endpoints `/login`, `/logout`, `/chat` (3 modes), `/pdf/{filename}` (serving authentifié). Authentification par token cryptographique in-memory (`secrets.token_urlsafe`).

---

### G. Frontend

| Composant | Choix | Détail |
| :--- | :--- | :--- |
| **Framework** ✅ | Next.js 16 (App Router) | SSR désactivé pour les composants avec localStorage (`dynamic` + `ssr: false`). |
| **UI** ✅ | shadcn/ui + Tailwind CSS v4 | Composants : Button, Input, Card, ScrollArea, Avatar, Badge. |
| **Markdown** ✅ | react-markdown | Rendu avec composants personnalisés (`h2` → bold, `h3` → semibold). |
| **PDF** ✅ | react-pdf (pdfjs-dist v5) | Chargement avec `Authorization` header, mémoïsation du `file` prop. |
| **Auth** ✅ | Token localStorage | Token reçu du backend, envoyé en `Bearer` header sur `/chat` et `/pdf`. |

---

## 3. Architecture de Données

```
backend/data/          ← PDF sources
       ↓
ingest.py              ← LlamaParse → chunks Markdown
                       ← Métadonnées : file_name, page_label, content_type
                       ← Embeddings OpenAI text-embedding-3-small
                       ↓
backend/chroma_db/     ← Index vectoriel persistant (collection "rag_collection")
       ↓
main.py /chat          ← Mode internal : ChromaDB top-K → gpt-4o
                       ← Mode hybrid  : ChromaDB + Tavily web → gpt-4o (synthèse)
                       ← Mode science : Tavily (domaines filtrés, query EN) → gpt-4o (bilingue FR/EN)
```

---

## 4. Décisions de Sécurité

| Point | Décision |
| :--- | :--- |
| Credentials | Stockés dans `.env` (non versionnés), jamais dans le code. |
| Comparaison passwords | `secrets.compare_digest()` — résistant aux timing attacks. |
| Tokens de session | `secrets.token_urlsafe(32)` — 256 bits d'entropie, invalidés côté serveur au logout. |
| Serving PDF | Vérification de path traversal (`startswith(data_dir_abs)`), extension `.pdf` imposée. |
| CORS | `allow_origins=["*"]` acceptable en dev ; à restreindre au domaine frontend en production. |

---

## 5. Points d'Amélioration Identifiés (Phase 3)

- **Tokens persistants** : les tokens actuels sont in-memory (perdus au redémarrage serveur). Migrer vers JWT signé ou Redis pour la production multi-workers.
- **CORS** : restreindre `allow_origins` au domaine frontend en production.
- **Description des figures** : intégrer un modèle Vision (GPT-4o Vision ou Gemini Flash) dans `ingest.py` pour générer des descriptions textuelles des images extraites.
- **Streaming** : implémenter le streaming des réponses LLM pour une meilleure UX sur les réponses longues.
- **Rate limiting** : protéger les endpoints contre les abus (ex: `slowapi`).

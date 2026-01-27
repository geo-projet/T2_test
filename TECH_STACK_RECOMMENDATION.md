# Rapport de Recommandation Tech Stack : Assistant RAG Environnemental

**Date :** 26 Janvier 2026
**Contexte :** MVP (Phase 1), Données Locales, Backend Python, Frontend Next.js.
**Focus :** Traitement de documents PDF complexes (Tableaux & Figures).

---

## 1. Analyse des Contraintes & Objectifs

L'objectif critique du MVP est la **fiabilité de l'ingestion**. Le PRD spécifie que les documents sont techniques, riches en tableaux et figures, et que ces éléments doivent être interprétables par le LLM (Ligne/Colonne pour les tableaux, descriptions textuelles pour les images).

Cela déplace la complexité de l'application du "Chat" vers le **Pipeline d'Ingestion (ETL)**.

---

## 2. Comparaison des Options Techniques

### A. Moteur d'Ingestion & Parsing (Le Cœur du Système)
*Le défi : Transformer des PDF non structurés en données structurées.*

| Option | Description | Avantages | Inconvénients |
| :--- | :--- | :--- | :--- |
| **1. PyMuPDF + Custom Logic** | Extraction manuelle via script Python bas niveau. | 100% Gratuit, Local, Rapide. Contrôle total. | Très complexe à maintenir pour les tableaux complexes. Nécessite beaucoup de code "glue". |
| **2. Unstructured.io (Open Source)** | Librairie polyvalente de traitement de documents. | Populaire, gère beaucoup de formats. Version locale disponible. | Lourd à installer (dépendances système). Parfois imprécis sur les tableaux denses sans OCR lourd. |
| **3. LlamaParse (LlamaIndex)** | API spécialisée dans les documents complexes avec RAG en tête. | **État de l'art** pour les tableaux et la structure. Intégration native LlamaIndex. | C'est une API (données sortent temporairement pour parsing, même si secure). |
| **4. Docling (IBM)** | Nouvelle librairie open-source performante. | Exécution locale, excellente préservation du layout, export Markdown/JSON propre. | Écosystème plus jeune que Unstructured. |

> **Analyse :** Pour un MVP qui doit réussir le test des "tableaux complexes", **LlamaParse** est souvent la solution la plus robuste immédiatement. Cependant, si le "100% Local" est strict pour le parsing, **Docling** est la meilleure alternative moderne locale.

### B. Base de Données Vectorielle (Stockage Local)

| Option | Description | Pourquoi pour ce projet ? |
| :--- | :--- | :--- |
| **1. ChromaDB** | Base vectorielle open-source, focus Python. | Très simple à configurer en mode persistant local (fichier). Parfait pour le dev. |
| **2. LanceDB** | Base vectorielle "Serverless" sur fichier. | Extrêmement rapide, stocke les données SUR disque (pas besoin de RAM massive). Supporte bien le multi-modal (images). |
| **3. Qdrant (Docker)** | Moteur de recherche vectorielle robuste. | Très puissant, mais nécessite un conteneur Docker qui tourne. Un peu "overkill" pour un simple script MVP local. |

### C. Orchestration LLM

| Option | Description | Verdict |
| :--- | :--- | :--- |
| **1. LangChain** | Le standard généraliste. | Très flexible, mais abstraction parfois lourde pour des pipelines de données précis. |
| **2. LlamaIndex** | Framework centré sur la "Data". | **Gagnant**. Conçu spécifiquement pour le RAG complexe, l'indexation structurée et les nœuds de métadonnées (requis par le PRD). |

### D. Backend API (Python)

| Option | Verdict |
| :--- | :--- |
| **FastAPI** | **Gagnant incontesté**. Support natif de l'async (crucial pour le streaming LLM), validation Pydantic forte, génération automatique de la doc (Swagger) pour le frontend. |
| **Flask/Django** | Moins adaptés aux websockets/streaming modernes requis pour une UI de chat fluide. |

---

## 3. Recommandation Finale : La Stack "Robust RAG"

Pour maximiser les chances de succès sur l'extraction des tableaux et figures dès le MVP, voici la combinaison recommandée :

### Backend (Python)
*   **Framework API :** `FastAPI`
*   **Orchestration :** `LlamaIndex` (pour ses capacités avancées de requêtage sur structures complexes).
*   **Ingestion (Parsing) :**
    *   *Choix A (Performance max)* : `LlamaParse` (Via API).
    *   *Choix B (100% Local)* : `Docling` (Python package).
    *   *Traitement Figures :* Utilisation d'un modèle Vision local (ex: `Llava` via `Ollama`) ou API (ex: `Gemini Flash`) pour générer les descriptions des images extraites.
*   **Vector DB :** `ChromaDB` (Mode persistant local `./chroma_db`).
*   **Vision/LLM :** Pour le MVP, utiliser une API performante (Gemini Pro/Flash ou GPT-4o) est recommandé pour valider la logique avant de passer au local (Ollama) si nécessaire, car les modèles locaux peinent encore sur l'interprétation fine de tableaux complexes.

### Frontend (Next.js)
*   **Framework :** `Next.js 15` (App Router).
*   **UI Library :** `shadcn/ui` + `Tailwind CSS` (Pour une UI propre et rapide sans design complexe).
*   **State Server :** `TanStack Query` (React Query) pour gérer les états de chargement de l'API.
*   **PDF Viewer :** `react-pdf` ou simplement l'iframe natif pour le MVP (Citations cliquables).

---

## 4. Architecture des Données Suggérée (MVP)

1.  **Dossier `/data`** : L'utilisateur dépose les PDF ici.
2.  **Script `ingest.py`** :
    *   Scan le dossier.
    *   Utilise *LlamaParse/Docling* pour extraire Texte + Tableaux (Markdown) + Images.
    *   Envoie les images à un modèle Vision -> Récupère la description textuelle.
    *   Crée des "Nodes" LlamaIndex avec métadonnées (`page`, `source`, `type`).
    *   Sauvegarde dans `ChromaDB` local.
3.  **API `main.py`** :
    *   Endpoint `/chat` : Reçoit la question -> Query ChromaDB -> Synthèse LLM -> Stream réponse.

## 5. Prochaines Étapes Immédiates

1.  Initialiser le repo Git.
2.  Créer l'environnement Python (`uv` ou `venv`).
3.  Installer `fastapi`, `llamaindex`, `chromadb`.
4.  Créer le dossier `backend` et `frontend`.

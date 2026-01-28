# Assistant RAG Environnemental Hybride

Ce projet est une plateforme web permettant aux experts en environnement d'interroger en langage naturel une base de connaissances complexe. L'application agit comme un assistant expert capable d'analyser des rapports techniques internes (PDFs riches en tableaux et figures) et de croiser ces informations, sur demande, avec la littérature scientifique ouverte en temps réel.

## 🚀 Fonctionnalités Clés

*   **Analyse de Documents Complexes :** Ingestion et parsing avancés de PDF techniques, préservant la structure des tableaux et générant des descriptions textuelles pour les figures.
*   **Mode Hybride (RAG + Web) :**
    *   **Interne :** Interrogation d'une base vectorielle locale construite à partir de vos documents.
    *   **Externe (Agent Web) :** Recherche en temps réel dans la littérature scientifique ouverte.
*   **Citations Précises :** Chaque réponse inclut des références cliquables vers le document source et la page exacte.
*   **Interface Expert :** Visualisation des extraits bruts (texte, tableaux) utilisés pour la réponse pour validation des données.

## 🛠 Tech Stack

### Backend
*   **Langage :** Python
*   **API Framework :** FastAPI
*   **Orchestration RAG :** LlamaIndex
*   **Base de Données Vectorielle :** ChromaDB (Local)
*   **Parsing PDF :** LlamaParse / Docling
*   **Modèles :** Compatible avec OpenAI, Anthropic, Gemini, ou modèles locaux via Ollama.

### Frontend
*   **Framework :** Next.js 15 (App Router)
*   **Langage :** TypeScript
*   **UI Components :** shadcn/ui
*   **Styling :** Tailwind CSS

## 📂 Structure du Projet

```
.
├── backend/                # Code source du backend Python
│   ├── chroma_db/          # Base de données vectorielle persistante
│   ├── data/               # Dossier pour déposer les PDF à ingérer
│   ├── ingest.py           # Script d'ingestion et d'indexation des documents
│   ├── main.py             # Point d'entrée de l'API FastAPI
│   └── requirements.txt    # Dépendances Python
├── frontend/               # Code source du frontend Next.js
│   ├── app/                # Pages et layouts (App Router)
│   ├── components/         # Composants UI réutilisables
│   └── lib/                # Utilitaires
├── PRD.md                  # Document d'Exigences Produit
└── TECH_STACK_RECOMMENDATION.md # Analyse technique détaillée
```

## ⚡️ Installation et Démarrage

### Prérequis

*   Node.js (v18+)
*   Python (v3.10+)
*   Clés API nécessaires (selon la configuration : OpenAI, Anthropic, Gemini, LlamaCloud, Tavily, etc.) configurées dans un fichier `.env`.

### 1. Configuration du Backend

```bash
cd backend

# Créer un environnement virtuel
python -m venv .venv

# Activer l'environnement virtuel
# Windows :
.venv\Scripts\activate
# Mac/Linux :
# source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# (Optionnel) Lancer l'ingestion des documents présents dans backend/data
python ingest.py

# Démarrer le serveur API
fastapi dev main.py
```
Le serveur backend sera accessible sur `http://localhost:8000`.

### 2. Configuration du Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```
L'application frontend sera accessible sur `http://localhost:3000`.

## 📖 Utilisation

1.  Déposez vos documents PDF techniques dans le dossier `backend/data`.
2.  Exécutez le script `python ingest.py` pour mettre à jour la base de connaissances.
3.  Lancez les serveurs Backend et Frontend.
4.  Ouvrez votre navigateur sur `http://localhost:3000`.
5.  Posez vos questions techniques à l'assistant. Utilisez le sélecteur pour activer la recherche Web si nécessaire.

## 📄 Licence

Ce projet est destiné à un usage interne ou éducatif. Veuillez vous référer aux licences des bibliothèques tierces utilisées.

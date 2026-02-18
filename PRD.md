# Document d'Exigences Produit (PRD) : Assistant RAG Environnemental Hybride

**Dernière mise à jour :** Février 2026
**État actuel :** Phase 2 (V1) terminée

---

## 1. Vision du Produit

Développer une plateforme web permettant à des experts en environnement d'interroger en langage naturel une base de connaissances complexe. L'application agit comme un assistant expert capable d'analyser des rapports techniques internes (PDFs riches en tableaux et figures) et de croiser ces informations, sur demande, avec la littérature scientifique ouverte en temps réel.

---

## 2. Profil Utilisateur & Périmètre

* **Cible :** Experts du domaine (scientifiques, ingénieurs).
* **Attentes :** Précision des données chiffrées, transparence des sources, absence d'hallucination, distinction claire entre données internes et externes.
* **Contraintes Techniques :**
  * **Priorité des données :** Les données du partenaire (internes) sont la source de vérité primaire.
  * **Figures & Graphiques :** Les figures des PDF doivent être décrites textuellement pour être interprétées par le LLM.
  * **Science Ouverte :** La recherche externe doit se faire en temps réel (pas de base statique) pour garantir la fraîcheur.
  * **Langue :** L'interface est en français ; les requêtes en mode Science sont automatiquement traduites en anglais pour maximiser la couverture de la littérature scientifique.

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

### B. Moteur RAG & Recherche — TERMINÉ

1. **Trois modes de recherche :**

   | Mode | Comportement |
   |---|---|
   | `internal` | RAG vectoriel sur les PDF internes (top-5 chunks). |
   | `hybrid` | RAG interne (top-3) + recherche web générale Tavily (2 résultats). Synthèse comparative structurée. |
   | `science` | Recherche Tavily filtrée sur domaines scientifiques (5 résultats). Requête traduite FR→EN automatiquement. Réponse bilingue. |

2. **Traduction automatique (Mode Science) :**
   - La requête française est traduite en anglais par le LLM avant l'appel Tavily.
   - La réponse est générée en français (section principale) puis en anglais (section secondaire en blockquote).

3. **Synthèse Comparative (Mode Hybride) :**
   - Réponse structurée en deux sections : **Selon les données internes du partenaire** / **Selon la littérature scientifique récente**.
   - Règles anti-hallucination strictes dans le prompt système.

### C. Interface Utilisateur — TERMINÉ

1. **Authentification :**
   - Page de login avec validation côté serveur (credentials dans `.env`).
   - Token de session cryptographique (`secrets.token_urlsafe`) invalidé côté serveur au logout.

2. **Sélecteur de mode :** Boutons Interne / Hybride / Science dans l'en-tête du chat.

3. **Bandeau d'information :** Avertissement automatique en mode Science (traduction + réponse bilingue).

4. **Citations Cliquables :**
   - Source interne → ouvre la visionneuse PDF directement à la page citée.
   - Source externe → ouvre l'URL dans un nouvel onglet.

5. **Visionneuse PDF intégrée :**
   - Navigation par page, zoom, chargement authentifié (Authorization header).

6. **Affichage des sources :** Badges type (Interne/Externe, Texte/Tableau), score de pertinence, extrait du chunk.

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

### Phase 3 — V2 (Autonomie & UX) — À VENIR

- **Upload de PDF temporaires :** analyse ad hoc sans réindexation permanente.
- **Historique des sessions :** sauvegarde et rechargement des conversations.
- **Export :** téléchargement des réponses en PDF ou Markdown.
- **Description des figures :** intégration d'un modèle Vision pour les graphiques.

### Hors-Périmètre (Actuel)

- Génération de nouveaux graphiques ou images.
- Modification des documents sources.
- Application mobile native.
- Réponses sur des sujets généralistes (météo, actualités, etc.).

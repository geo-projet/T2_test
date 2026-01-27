# Document d'Exigences Produit (PRD) : Assistant RAG Environnemental Hybride

## 1. Vision du Produit

Développer une plateforme web permettant à des experts en environnement d'interroger en langage naturel une base de connaissances complexe. L'application agit comme un assistant expert capable d'analyser des rapports techniques internes (PDFs riches en tableaux et figures) et de croiser ces informations, sur demande, avec la littérature scientifique ouverte en temps réel.

## 2. Profil Utilisateur & Périmètre

* **Cible :** Experts du domaine (scientifiques, ingénieurs).
* **Attentes :** Précision des données chiffrées, transparence des sources, absence d'hallucination, distinction claire entre données internes et externes.
* **Contraintes Techniques :**
* **Priorité des données :** Les données du partenaire (internes) sont la source de vérité primaire.
* **Figures & Graphiques :** Les figures des PDF doivent être décrites textuellement pour être interprétées par le LLM.
* **Science Ouverte :** La recherche externe doit se faire en "Temps Réel" (pas de base statique) pour garantir la fraîcheur.



---

## 3. Fonctionnalités Clés (Le "Quoi")

### A. Ingestion et Parsing (Backend)

Le défi majeur est la structuration de données non-structurées (PDF techniques).

1. **Extraction des Tableaux :**
* Le système doit extraire les tableaux non pas comme du texte brut, mais en préservant la structure (Ligne/Colonne/En-tête) pour permettre des requêtes analytiques (ex: "Quelle est la valeur de X pour l'année Y ?").


2. **Traitement des Figures :**
* Extraction des images des graphiques.
* Génération automatique d'une description textuelle détaillée (via modèle Vision) incluant les tendances, les pics et les axes.
* Lien sémantique entre le texte, le tableau et la figure correspondante.


3. **Citations Granulaires :**
* Chaque morceau de texte indexé doit conserver ses métadonnées : `Nom du Fichier`, `Numéro de Page`, `Type (Texte/Tableau/Figure)`.



### B. Moteur RAG & Recherche (Logic)

1. **Mode Hybride (Routing) :**
* Capacité à interroger la base vectorielle (Interne).
* Capacité à utiliser un agent de recherche web (Externe) pour les articles scientifiques.


2. **Module Agentique Web (Science Ouverte) :**
* Traduction de la requête utilisateur en mots-clés booléens pour API scientifiques.
* Filtrage à la volée des résultats (lecture des abstracts) pour ne garder que la littérature pertinente.


3. **Synthèse Comparative :**
* Si les deux sources sont activées, le LLM doit structurer la réponse pour comparer explicitement : "Selon les données internes..." VS "Selon la littérature scientifique...".



### C. Interface Utilisateur (Frontend)

1. **Sélecteur de Source :** Switch permettant à l'utilisateur de choisir le périmètre : `Interne Uniquement` (défaut) ou `Hybride / Web`.
2. **Citations Cliquables :** Les références `[1]` doivent ouvrir le PDF source directement à la page concernée.
3. **Affichage "Expert" :** Possibilité d'afficher les extraits bruts (Raw Context) utilisés pour générer la réponse afin de vérifier les unités ou les chiffres.

---

## 4. Roadmap de Développement

### Phase 1 : MVP (Focus : Fiabilité Interne)

*Objectif : Valider le pipeline d'ingestion des PDF complexes.*

* **Backend :** Pipeline d'ingestion PDF qui sont dans un répertoire local (Texte + Tableaux structurés + Description textuelle des Figures). Indexation vectorielle.
* **RAG :** Recherche sur données internes uniquement.
* **UI :** Interface de chat simple avec citation des sources (lien vers PDF).
* **Critère de succès :** Le bot répond correctement à une question basée sur une cellule spécifique d'un tableau complexe.

### Phase 2 : V1 (Focus : Intelligence Hybride)


* **Agent Web :** Intégration d'une API de recherche (Tavily/Serper) pour le volet "Science Ouverte".
* **UI Avancée :** Ajout du sélecteur de sources (Interne/Hybride).
* **Comparaison :** Prompt système ajusté pour forcer la distinction visuelle entre données internes et externes dans la réponse.

### Phase 3 : V2 (Focus : Autonomie & UX)

*Objectif : Améliorer la productivité de l'expert.*

* **Feature "Upload" :** L'utilisateur peut uploader un PDF temporaire pour l'analyser.
* **Gestion de l'historique :** Sauvegarde des sessions.
* **Export :** Exportation des réponses formatées.

### Hors-Périmètre (Actuel)

* Génération de nouveaux graphiques/images.
* Modification des documents sources.
* Application mobile native.
* Réponses sur des sujets généralistes (Météo, News, etc.).


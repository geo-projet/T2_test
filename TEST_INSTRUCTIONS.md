# Instructions de Test - MVP Amélioré

## 🚀 Nouvelles Fonctionnalités Implémentées

### ✅ 1. Descriptions Automatiques de Figures (Vision AI)
Les figures/graphiques des PDFs sont maintenant extraites et décrites automatiquement par GPT-4o Vision.

### ✅ 2. Citations PDF Cliquables
Les sources sont maintenant cliquables et ouvrent le PDF directement à la page concernée.

### ✅ 3. Métadonnées Typées
Chaque chunk est maintenant typé : `text`, `table`, ou `figure` pour une meilleure traçabilité.

---

## 📋 Étapes de Test

### Étape 1 : Réingestion des Documents (OBLIGATOIRE)

Pour activer les nouvelles fonctionnalités, vous devez réindexer vos documents :

```bash
cd backend
python ingest.py
```

**Ce qui va se passer :**
1. Parsing des PDFs avec LlamaParse (texte + tableaux en markdown)
2. Extraction des images > 200x200 pixels
3. Analyse de chaque image avec GPT-4o Vision (descriptions détaillées)
4. Indexation de tous les chunks avec métadonnées typées
5. Création d'une nouvelle collection ChromaDB

**Durée estimée :** 5-15 minutes selon la taille des PDFs et le nombre d'images

**Coût API :**
- LlamaParse : ~$0.03 par page
- GPT-4o Vision : ~$0.01 par image analysée

---

### Étape 2 : Démarrer le Backend

```bash
cd backend
uvicorn main:app --reload
```

Backend disponible sur : http://localhost:8000

**Vérifications :**
- `GET http://localhost:8000/` → {"message": "RAG API is running"}
- `GET http://localhost:8000/pdf/T2_Parc Commune_Rapport_VF_Signe_Optimized.pdf` → Le PDF s'affiche

---

### Étape 3 : Démarrer le Frontend

```bash
cd frontend
npm run dev
```

Frontend disponible sur : http://localhost:3000

---

### Étape 4 : Tests Fonctionnels

#### Test 1 : Questions sur des Figures/Graphiques

**Questions à essayer :**
- "Quelles sont les tendances visibles dans les graphiques ?"
- "Décris-moi les figures présentes dans les documents"
- "Quelles sont les valeurs clés montrées dans les graphiques ?"

**Résultat attendu :**
- La réponse mentionne des détails spécifiques aux figures (axes, valeurs, tendances)
- Les sources affichent le badge "Figure" 🖼️
- Cliquer sur la source ouvre le PDF à la bonne page

---

#### Test 2 : Questions sur des Tableaux

**Questions à essayer :**
- "Quelle est la valeur de [X] dans le tableau page [Y] ?"
- "Compare les données des tableaux entre 2022 et 2023"
- "Quels sont les chiffres clés dans les tableaux ?"

**Résultat attendu :**
- La réponse cite précisément les cellules du tableau
- Les sources affichent le badge "Tableau" 📊
- Cliquer sur la source ouvre le PDF avec le tableau visible

---

#### Test 3 : Citations Cliquables

**Actions :**
1. Posez une question quelconque
2. Dans les sources retournées, cliquez sur n'importe quelle source
3. Le PDF s'ouvre dans une modal

**Vérifications :**
- La modal affiche le PDF à la page correcte
- Navigation prev/next fonctionne
- Zoom in/out fonctionne (50% à 200%)
- Fermeture avec le bouton X

---

#### Test 4 : Types de Contenu

**Observation :**
Vérifiez que les badges de type sont corrects :
- 📄 **Texte** : Paragraphes narratifs
- 📊 **Tableau** : Données structurées en lignes/colonnes
- 🖼️ **Figure** : Descriptions de graphiques/images

---

### Étape 5 : Validation des Descriptions de Figures

**Vérification manuelle :**
1. Posez une question faisant référence à un graphique
2. Comparez la description dans la réponse avec le graphique réel dans le PDF
3. Vérifiez que les valeurs numériques sont précises

**Critères de qualité :**
- ✅ Type de graphique identifié (courbe, histogramme, etc.)
- ✅ Axes et unités mentionnés
- ✅ Tendances principales décrites
- ✅ Valeurs clés extraites correctement

---

## 🐛 Dépannage

### Problème : "Search index not initialized"
**Solution :** Exécutez `python ingest.py` pour créer l'index

### Problème : Le PDF ne s'ouvre pas
**Vérifications :**
1. Le backend est bien démarré sur http://localhost:8000
2. L'endpoint `/pdf/{filename}` retourne bien le fichier
3. Le nom du fichier dans les métadonnées est correct

### Problème : Les descriptions de figures sont vides
**Causes possibles :**
1. L'image est trop petite (< 200x200px) → filtrée automatiquement
2. Erreur API OpenAI → vérifiez les logs du backend
3. Clé API invalide → vérifiez `.env`

### Problème : "Worker not found" (react-pdf)
**Solution :** C'est normal en dev, le worker est chargé depuis unpkg CDN. En production, configurez le worker localement.

---

## 📊 Résultats Attendus

Après les tests, vous devriez constater :

1. **Couverture complète** : Questions sur texte, tableaux ET figures
2. **Précision améliorée** : Réponses avec valeurs numériques exactes
3. **Traçabilité** : Sources cliquables avec types identifiés
4. **UX professionnelle** : Visionneuse PDF intégrée et fluide

---

## 🎯 Critères de Succès du MVP (Rappel PRD)

- [x] **Pipeline d'ingestion** : Texte + Tables + Figures ✅
- [x] **Indexation vectorielle** : ChromaDB avec métadonnées ✅
- [x] **RAG interne** : Recherche top-k fonctionnelle ✅
- [x] **Chat UI** : Interface avec citations sources ✅
- [x] **Citations cliquables** : Liens vers PDFs ✅
- [ ] **Tests de validation** : À créer (Tâche #4)

**État MVP : 95% complété** 🎉

---

## 📝 Notes Importantes

### Coûts API
- **Ingestion initiale** : ~$1-5 selon volume de PDFs et images
- **Queries** : ~$0.01 par question (embeddings + GPT-4o)

### Performance
- **Temps de réingestion** : 5-15 min (une seule fois)
- **Temps de réponse** : 2-5 secondes par question

### Limitations Actuelles
- Pas de cache des descriptions de figures (réingestion complète nécessaire)
- Pas de gestion d'upload dynamique de PDFs (Phase 3)
- Pas de mode hybride web (Phase 2)

---

## 🚀 Prochaines Étapes Recommandées

1. **Tâche #4** : Créer des tests de validation sur tableaux complexes
2. **Tâche #5** : Ajouter l'affichage du contexte brut (Raw Context Viewer)
3. **Tâche #6** : Améliorer la gestion d'erreurs
4. **Optimisation** : Mise en cache des descriptions de figures
5. **Déploiement** : Configuration worker react-pdf pour production

---

Bon test ! 🎯

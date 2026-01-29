# Options de Recherche Scientifique - Phase 2 Avancée

## État Actuel (Option A - Implémentée ✅)

**Tavily avec Filtres de Domaines**

Recherche web focalisée sur des revues scientifiques spécifiques via filtres de domaines.

**Configuration actuelle** (`backend/.env`):
```env
TAVILY_INCLUDE_DOMAINS=nature.com,science.org,plos.org,plosone.org,frontiersin.org,mdpi.com,bioone.org,ncbi.nlm.nih.gov,sciencedirect.com
```

**Avantages:**
- ✅ Implémentation immédiate (5 minutes)
- ✅ Pas besoin de nouvelle API
- ✅ Fonctionne avec clé Tavily existante
- ✅ Liste de domaines configurable dans `.env`

**Limitations:**
- ⚠️ Dépend de l'indexation Tavily
- ⚠️ Peut avoir accès limité aux articles complets (paywall)
- ⚠️ Pas de métadonnées scientifiques riches (citations, DOI, etc.)

---

## Option B: Semantic Scholar API (Recommandé pour Phase 3)

### Vue d'Ensemble

**Semantic Scholar** est une API gratuite développée par l'Allen Institute for AI, spécialisée dans la recherche de littérature scientifique.

**Caractéristiques:**
- 🔬 200M+ articles scientifiques
- 🆓 Gratuit, sans clé API requise (limite: 100 requêtes/5min)
- 📊 Métadonnées riches: citations, auteurs, abstract, DOI
- 🎯 Filtres avancés: année, domaine, nombre de citations
- 🔓 Indicateur Open Access

**API Endpoint:** `https://api.semanticscholar.org/graph/v1/paper/search`

### Architecture Proposée

```
User Query (mode: hybrid)
        |
        v
    Backend Router
    /           \
Internal RAG    Recherche Scientifique Parallèle
(ChromaDB)      /                    \
            Tavily              Semantic Scholar
          (filtré)              (API gratuite)
              \                      /
               \                    /
                Response Merger
                      |
                      v
            Formatted Response
        (Interne / Web / Scholar)
```

### Implémentation

#### 1. Nouvelle Fonction Backend (`backend/main.py`)

```python
async def search_semantic_scholar(query: str, max_results: int = 3) -> list[SourceNode]:
    """
    Recherche via Semantic Scholar API.

    Retourne articles scientifiques avec métadonnées riches.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={
                    "query": query,
                    "limit": max_results,
                    "fields": "title,abstract,year,authors,citationCount,isOpenAccess,openAccessPdf,externalIds,publicationDate,venue"
                },
                headers={
                    "Accept": "application/json"
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            sources = []
            for paper in data.get("data", []):
                # Construire URL (DOI ou S2 ID)
                paper_id = paper.get("paperId")
                url = f"https://www.semanticscholar.org/paper/{paper_id}"

                # Vérifier si Open Access
                is_oa = paper.get("isOpenAccess", False)
                pdf_url = paper.get("openAccessPdf", {}).get("url") if is_oa else None

                # Abstract tronqué
                abstract = paper.get("abstract", "")[:500]

                # Auteurs
                authors = ", ".join([a.get("name", "") for a in paper.get("authors", [])[:3]])

                # Info publication
                year = paper.get("year", "N/A")
                venue = paper.get("venue", "Unknown")
                citations = paper.get("citationCount", 0)
                publication_info = f"{venue} ({year}) - {citations} citations"
                if is_oa:
                    publication_info += " - Open Access"

                sources.append(SourceNode(
                    text=abstract + "..." if abstract else "Pas d'abstract disponible",
                    score=1.0 - (len(sources) * 0.1),  # Score décroissant selon rang
                    source_type="external",
                    url=pdf_url if pdf_url else url,
                    title=f"{paper.get('title', 'Sans titre')} - {authors}",
                    publication_info=publication_info,
                    page_label="N/A",
                    file_name="N/A",
                    content_type="text"
                ))

            logger.info(f"Semantic Scholar: Found {len(sources)} articles")
            return sources

    except Exception as e:
        logger.error(f"Erreur Semantic Scholar: {e}")
        return []
```

#### 2. Modification du Mode Hybride

```python
@app.post("/chat", response_model=QueryResponse)
async def chat_endpoint(request: QueryRequest):
    # ...
    elif request.mode == "hybrid":
        # Exécution parallèle avec asyncio.gather
        internal_task = get_internal_sources(request.query)
        tavily_task = search_web_agent(request.query, max_results=2)
        scholar_task = search_semantic_scholar(request.query, max_results=3)

        results = await asyncio.gather(
            internal_task,
            tavily_task,
            scholar_task,
            return_exceptions=True
        )

        internal_sources = results[0] if not isinstance(results[0], Exception) else []
        tavily_sources = results[1] if not isinstance(results[1], Exception) else []
        scholar_sources = results[2] if not isinstance(results[2], Exception) else []

        # Synthèse tri-sources
        answer = synthesize_triple_response(
            request.query,
            internal_sources,
            tavily_sources,
            scholar_sources
        )
```

#### 3. Nouveau System Prompt (Tri-Sources)

```python
def synthesize_triple_response(
    query: str,
    internal_sources: list[SourceNode],
    web_sources: list[SourceNode],
    scholar_sources: list[SourceNode]
) -> str:
    system_prompt = """
Vous êtes un assistant scientifique expert. L'utilisateur vous a fourni TROIS types de sources:

1. DONNÉES INTERNES (source primaire de vérité - priorité maximale)
2. ARTICLES SCIENTIFIQUES (Semantic Scholar - littérature peer-reviewed)
3. RESSOURCES WEB (Tavily - contexte additionnel)

STRUCTURE DE RÉPONSE:
## Selon les données internes du partenaire
[Analyse basée sur sources internes avec citations [1], [2]...]

## Selon la littérature scientifique peer-reviewed
[Analyse basée sur articles Semantic Scholar avec citations [X], [Y]...]

## Selon les ressources web additionnelles
[Contexte additionnel si pertinent, avec citations [Z]...]

## Synthèse comparative
[Comparer les trois sources, mettre en évidence convergences/divergences]

RÈGLES:
- Toujours commencer par les données internes
- Distinguer clairement les trois types de sources
- Prioriser les articles peer-reviewed sur les ressources web
- Mentionner si Open Access disponible
- Citer systématiquement avec [numéro]
"""
    # ... construction contexte et appel LLM
```

#### 4. Frontend - Badge "Scholar"

Ajouter distinction visuelle pour sources Semantic Scholar:

```typescript
// Dans le rendu des sources
{msg.sources.map((src, idx) => {
  const isScholar = src.url?.includes('semanticscholar.org') || src.publication_info?.includes('citations');

  return (
    <div className={`
      ${isExternal && isScholar ? 'bg-purple-50 border-purple-200' : ''}
      ${isExternal && !isScholar ? 'bg-blue-50 border-blue-200' : ''}
      ${!isExternal ? 'bg-gray-50 border-gray-200' : ''}
    `}>
      {/* Badge spécifique */}
      <Badge className={isScholar ? 'bg-purple-600' : ''}>
        {isScholar ? 'Scholar' : isExternal ? 'Web' : 'Interne'}
      </Badge>

      {/* Icône spéciale pour Open Access */}
      {src.publication_info?.includes('Open Access') && (
        <Badge variant="outline" className="text-green-600">
          🔓 Open Access
        </Badge>
      )}
    </div>
  );
})}
```

### Avantages Option B

- ✅ **Qualité**: Articles peer-reviewed uniquement
- ✅ **Métadonnées**: DOI, citations, auteurs, année
- ✅ **Gratuit**: Pas de coût, limite généreuse (100 req/5min)
- ✅ **Open Access**: Détection automatique + liens PDF
- ✅ **Fiabilité**: Source académique reconnue
- ✅ **Filtres**: Par année, domaine, nombre de citations

### Limitations Option B

- ⚠️ Limité à 100 requêtes par 5 minutes
- ⚠️ Peut manquer certaines publications très récentes
- ⚠️ Pas toujours d'abstract disponible

### Temps d'Implémentation

- **Backend**: ~30 minutes
- **Frontend**: ~15 minutes
- **Tests**: ~15 minutes
- **Total**: ~1 heure

---

## Option C: Approche Triple Hybride (Optimal)

### Vue d'Ensemble

Combiner les trois sources pour une couverture maximale:
1. **Données internes** (ChromaDB) - Vérité terrain
2. **Semantic Scholar** - Littérature scientifique peer-reviewed
3. **Tavily filtré** - Actualités, blogs scientifiques, pré-prints

### Stratégie de Routage Intelligent

```python
class SearchMode(Enum):
    INTERNAL = "internal"           # ChromaDB uniquement
    HYBRID_WEB = "hybrid_web"       # ChromaDB + Tavily filtré
    HYBRID_SCHOLAR = "hybrid_scholar"  # ChromaDB + Semantic Scholar
    HYBRID_FULL = "hybrid_full"     # ChromaDB + Tavily + Scholar (tout)

@app.post("/chat")
async def chat_endpoint(request: QueryRequest):
    if request.mode == "hybrid_full":
        # Exécution parallèle optimisée
        tasks = {
            "internal": get_internal_sources(request.query, top_k=3),
            "scholar": search_semantic_scholar(request.query, max_results=3),
            "web": search_web_agent(request.query, max_results=2)
        }

        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        # Gestion d'erreurs par source
        sources_dict = {
            key: result if not isinstance(result, Exception) else []
            for key, result in zip(tasks.keys(), results)
        }
```

### UI - Sélecteur Multi-Options

```typescript
<div className="flex gap-2">
  <Button
    variant={searchMode === 'internal' ? 'default' : 'outline'}
    onClick={() => setSearchMode('internal')}
  >
    <FileText className="h-3 w-3 mr-1" />
    Interne
  </Button>

  <Button
    variant={searchMode === 'hybrid_scholar' ? 'default' : 'outline'}
    onClick={() => setSearchMode('hybrid_scholar')}
    className={searchMode === 'hybrid_scholar' ? 'bg-purple-600' : ''}
  >
    <GraduationCap className="h-3 w-3 mr-1" />
    + Articles
  </Button>

  <Button
    variant={searchMode === 'hybrid_full' ? 'default' : 'outline'}
    onClick={() => setSearchMode('hybrid_full')}
    className={searchMode === 'hybrid_full' ? 'bg-gradient-to-r from-purple-600 to-blue-600' : ''}
  >
    <Sparkles className="h-3 w-3 mr-1" />
    Complet
  </Button>
</div>
```

### Système de Scoring Multi-Sources

```python
def rank_and_merge_sources(
    internal: list[SourceNode],
    scholar: list[SourceNode],
    web: list[SourceNode]
) -> list[SourceNode]:
    """
    Fusionne et classe les sources selon leur pertinence et fiabilité.

    Pondération:
    - Interne: score × 1.5 (priorité maximale)
    - Scholar: score × 1.2 (peer-reviewed)
    - Web: score × 1.0 (contexte)
    """
    all_sources = []

    # Appliquer pondération
    for src in internal:
        src.score *= 1.5
        all_sources.append(src)

    for src in scholar:
        src.score *= 1.2
        all_sources.append(src)

    for src in web:
        src.score *= 1.0
        all_sources.append(src)

    # Trier par score pondéré
    all_sources.sort(key=lambda x: x.score, reverse=True)

    # Retourner top 8 sources
    return all_sources[:8]
```

### Cache Intelligent

```python
from functools import lru_cache
import hashlib

def query_hash(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()

# Cache Redis ou in-memory
SCHOLAR_CACHE = {}  # {query_hash: (sources, timestamp)}
CACHE_TTL = 3600 * 24  # 24h

async def search_semantic_scholar_cached(query: str, max_results: int = 3):
    cache_key = query_hash(query)

    # Vérifier cache
    if cache_key in SCHOLAR_CACHE:
        sources, timestamp = SCHOLAR_CACHE[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            logger.info("Cache hit: Semantic Scholar")
            return sources

    # Sinon, requête API
    sources = await search_semantic_scholar(query, max_results)
    SCHOLAR_CACHE[cache_key] = (sources, time.time())
    return sources
```

### Avantages Option C

- ✅ **Couverture maximale**: Données internes + articles + web
- ✅ **Fiabilité graduée**: Pondération selon type de source
- ✅ **Flexibilité**: L'utilisateur choisit le niveau de recherche
- ✅ **Performance**: Cache pour réduire latence
- ✅ **Résilience**: Dégradation gracieuse si une source fail

### Limitations Option C

- ⚠️ Complexité accrue (plus de code à maintenir)
- ⚠️ Latence potentielle si toutes sources appelées
- ⚠️ Besoin de prompts plus sophistiqués

### Temps d'Implémentation

- **Backend**: ~1.5 heures
- **Frontend**: ~30 minutes
- **Cache & optimisations**: ~30 minutes
- **Tests**: ~30 minutes
- **Total**: ~3 heures

---

## Comparaison des Options

| Critère | Option A (Actuelle) | Option B (Scholar) | Option C (Triple) |
|---------|---------------------|-------------------|------------------|
| **Implémentation** | ✅ 5 min | 🟡 1h | 🔴 3h |
| **Qualité scientifique** | 🟡 Moyenne | ✅ Excellente | ✅ Excellente |
| **Couverture** | 🟡 Limitée | 🟢 Bonne | ✅ Maximale |
| **Coût** | ✅ Gratuit | ✅ Gratuit | ✅ Gratuit |
| **Métadonnées** | ❌ Basiques | ✅ Riches | ✅ Riches |
| **Open Access** | ❌ Non détecté | ✅ Détecté | ✅ Détecté |
| **Maintenance** | ✅ Simple | 🟢 Modérée | 🟡 Complexe |
| **Latence** | ✅ Rapide (~2s) | 🟢 Rapide (~3s) | 🟡 Modérée (~5s) |

---

## Autres APIs Scientifiques (Référence)

### Europe PMC
- **Focus**: Sciences de la vie et biomédicales
- **Gratuit**: Oui
- **URL**: `https://www.ebi.ac.uk/europepmc/webservices/rest/search`
- **Avantages**: Excellent pour écologie, biologie

### CORE
- **Focus**: Agrégateur open access multidisciplinaire
- **Gratuit**: Oui (clé API requise)
- **URL**: `https://api.core.ac.uk/v3/search/works`
- **Avantages**: 200M+ articles open access

### arXiv API
- **Focus**: Preprints scientifiques
- **Gratuit**: Oui
- **URL**: `http://export.arxiv.org/api/query`
- **Avantages**: Articles très récents (non peer-reviewed)

### Unpaywall API
- **Focus**: Trouve versions open access d'articles
- **Gratuit**: Oui (avec email)
- **URL**: `https://api.unpaywall.org/v2/{doi}`
- **Avantages**: Complémentaire, trouve PDFs libres

### CrossRef
- **Focus**: Métadonnées d'articles (DOI)
- **Gratuit**: Oui
- **URL**: `https://api.crossref.org/works`
- **Avantages**: Exhaustif, mais pas de full-text

---

## Recommandation de Roadmap

### Phase 2.1 (Actuelle) ✅
**Option A**: Tavily avec filtres de domaines
- Permet de tester le concept rapidement
- Valide l'approche hybride auprès des utilisateurs

### Phase 2.2 (Prochaine - 1 semaine)
**Option B**: Ajouter Semantic Scholar
- Meilleure qualité scientifique
- Métadonnées riches pour citations
- Open Access detection

### Phase 2.3 (Future - 2 semaines)
**Option C**: Triple hybride avec UI avancée
- Sélecteur multi-modes
- Scoring intelligent
- Cache pour performance
- Filtres avancés (année, citations, domaine)

### Phase 3 (Long terme - 1 mois)
**Fonctionnalités avancées**:
- Export citations (BibTeX, RIS)
- Graphe de citations inter-sources
- Recommandations basées sur historique
- Alertes sur nouveaux articles
- Annotation collaborative

---

## Configuration Recommandée `.env` (Futur)

```env
# APIs de Recherche Scientifique

# Tavily (Web général filtré)
TAVILY_API_KEY=tvly-dev-xxx
TAVILY_INCLUDE_DOMAINS=nature.com,science.org,plos.org,frontiersin.org,mdpi.com

# Semantic Scholar (pas de clé requise, mais rate limit)
SEMANTIC_SCHOLAR_API_KEY=  # Optionnel pour rate limit augmenté
SEMANTIC_SCHOLAR_MAX_RESULTS=5
SEMANTIC_SCHOLAR_MIN_CITATIONS=0  # Filtrer par citations minimum

# Europe PMC (pour écologie/biologie)
EUROPEPMC_ENABLED=false
EUROPEPMC_MAX_RESULTS=3

# CORE (open access)
CORE_API_KEY=  # Optionnel
CORE_ENABLED=false

# Configuration Cache
ENABLE_CACHE=true
CACHE_TTL_HOURS=24
CACHE_MAX_SIZE=1000

# Stratégie de recherche
DEFAULT_SEARCH_MODE=hybrid_scholar  # internal | hybrid_web | hybrid_scholar | hybrid_full
ENABLE_SOURCE_RANKING=true
INTERNAL_SOURCE_WEIGHT=1.5
SCHOLAR_SOURCE_WEIGHT=1.2
WEB_SOURCE_WEIGHT=1.0
```

---

## Notes Importantes

1. **Rate Limits**:
   - Tavily: ~1000 requêtes/mois (free tier)
   - Semantic Scholar: 100 requêtes/5 minutes
   - Europe PMC: Pas de limite stricte

2. **Droit d'Auteur**:
   - Toujours vérifier Open Access avant affichage full-text
   - Respecter robots.txt des éditeurs
   - Ne pas scraper directement les sites (utiliser APIs)

3. **Performance**:
   - Implémenter cache dès que possible
   - Limiter nombre de sources affichées (top 8-10)
   - Timeout agressif (10s max par API)

4. **UX**:
   - Toujours montrer source de l'information
   - Distinguer visuellement les types de sources
   - Permettre de filtrer/trier les sources
   - Message clair si aucun résultat

---

*Document créé le 2026-01-28*
*Dernière mise à jour: Phase 2.1 (Option A implémentée)*

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import re
import secrets
import chromadb
import httpx
import logging
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="RAG Environnemental API")

# Allow CORS for local development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration (must match ingest.py)
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./chroma_db")
DATA_DIR = os.getenv("DATA_DIR", "./data")
AUTH_USERNAME = os.getenv("AUTH_USERNAME")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD")

Settings.embedding = OpenAIEmbedding(model="text-embedding-3-small")
Settings.llm = OpenAI(model="gpt-4o", temperature=0)

# Token store (in-memory, invalidated on server restart)
valid_tokens: set[str] = set()

security = HTTPBearer()

# Global Index Variable
index = None

def _normalize_for_lang_comparison(text: str) -> str:
    """Retire la ponctuation et met en minuscule pour comparaison langue-neutre."""
    return re.sub(r'[^\w\s]', '', text.strip().lower())

def get_index():
    global index
    if index is None:
        if not os.path.exists(CHROMA_DB_DIR):
            print("⚠️ Warning: ChromaDB directory not found. Have you run ingest.py?")
            return None

        print("Loading Vector Index...")
        db = chromadb.PersistentClient(path=CHROMA_DB_DIR)
        chroma_collection = db.get_or_create_collection("rag_collection")
        vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        index = VectorStoreIndex.from_vector_store(
            vector_store,
            storage_context=storage_context,
        )
    return index


# --- Auth models ---

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str


# --- Auth dependency ---

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if credentials.credentials not in valid_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
        )
    return credentials.credentials


# --- Query models ---

class QueryRequest(BaseModel):
    query: str
    mode: str = "internal"  # "internal" | "hybrid" | "science"

class SourceNode(BaseModel):
    text: str
    score: float
    page_label: str = "N/A"
    file_name: str = "N/A"
    content_type: str = "text"
    source_type: str = "internal"  # "internal" | "external"
    # Pour sources externes
    url: str | None = None
    title: str | None = None
    publication_info: str | None = None

class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceNode]
    english_query: str | None = None


# --- Auth endpoints ---

@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    if not AUTH_USERNAME or not AUTH_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentification non configurée sur le serveur",
        )

    username_ok = secrets.compare_digest(request.username, AUTH_USERNAME)
    password_ok = secrets.compare_digest(request.password, AUTH_PASSWORD)

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )

    token = secrets.token_urlsafe(32)
    valid_tokens.add(token)
    logger.info(f"Login successful for user: {request.username}")
    return LoginResponse(token=token)


@app.post("/logout")
async def logout(token: str = Depends(verify_token)):
    valid_tokens.discard(token)
    return {"message": "Déconnecté"}


# --- Utility functions ---

async def search_web_agent(query: str, max_results: int = 3, use_domain_filters: bool = True) -> list[SourceNode]:
    """
    Recherche web via Tavily API.

    Args:
        query: Requête de recherche
        max_results: Nombre maximum de résultats
        use_domain_filters: Si True, filtre par domaines scientifiques. Si False, recherche web complète.

    Stratégie:
    1. Appel API Tavily avec query
    2. Filtrage par domaines scientifiques (si use_domain_filters=True)
    3. Filtrage par pertinence (abstract/content)
    4. Retour de SourceNode avec source_type='external'
    """
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    if not tavily_api_key or tavily_api_key == "tvly-xxxxxxxxxxxx":
        logger.warning("TAVILY_API_KEY non configurée")
        return []

    try:
        # Construction du payload
        payload = {
            "api_key": tavily_api_key,
            "query": query,
            "search_depth": "advanced",
            "max_results": max_results,
            "include_raw_content": False
        }

        # Ajout des filtres de domaines si demandé ET configurés
        if use_domain_filters:
            include_domains = os.getenv("TAVILY_INCLUDE_DOMAINS", "").strip()
            if include_domains:
                domains_list = [d.strip() for d in include_domains.split(",") if d.strip()]
                if domains_list:
                    payload["include_domains"] = domains_list
                    logger.info(f"Web Agent: Filtrage sur {len(domains_list)} domaines scientifiques")
        else:
            logger.info("Web Agent: Recherche web complète (sans filtres de domaines)")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json=payload,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            sources = []
            for result in data.get("results", []):
                sources.append(SourceNode(
                    text=result.get("content", "")[:500] + "...",
                    score=result.get("score", 0.0),
                    source_type="external",
                    url=result.get("url"),
                    title=result.get("title"),
                    publication_info=result.get("published_date", ""),
                    page_label="N/A",
                    file_name="N/A",
                    content_type="text"
                ))
            logger.info(f"Web Agent: Found {len(sources)} external sources")
            return sources

    except Exception as e:
        logger.error(f"Erreur Web Agent: {e}")
        return []  # Dégradation gracieuse

async def synthesize_hybrid_response(
    query: str,
    internal_sources: list[SourceNode],
    external_sources: list[SourceNode]
) -> str:
    """
    Génère réponse comparative avec distinction claire des sources.
    """
    system_prompt = """
Vous êtes un assistant scientifique expert. L'utilisateur vous a fourni deux types de sources:

1. DONNÉES INTERNES (source primaire de vérité)
2. LITTÉRATURE SCIENTIFIQUE EXTERNE (contexte additionnel)

RÈGLES STRICTES:
- Structurer la réponse en sections distinctes
- Section 1: "## Selon les données internes du partenaire"
- Section 2: "## Selon la littérature scientifique récente"
- Comparer explicitement les deux sources quand pertinent
- Toujours préciser la provenance des données avec citations [1], [2], etc.
- Ne jamais mélanger les sources sans distinction claire
- Si contradiction: mettre en évidence et expliquer

RÈGLES ANTI-HALLUCINATION:
- Ne JAMAIS inventer des chiffres ou citations
- Si les sources ne contiennent pas l'info, dire "Les sources ne mentionnent pas..."
- Ne pas extrapoler au-delà des données fournies
"""

    # Construire contexte
    context = "Sources internes:\n"
    for i, src in enumerate(internal_sources, 1):
        context += f"[{i}] {src.text}\n\n"

    context += "\nSources externes:\n"
    for i, src in enumerate(external_sources, len(internal_sources) + 1):
        context += f"[{i}] {src.title}: {src.text}\n\n"

    # Appel LLM asynchrone
    messages = [
        ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
        ChatMessage(role=MessageRole.USER, content=f"Question: {query}\n\n{context}")
    ]

    llm = Settings.llm
    response = await llm.achat(messages)

    return str(response.message.content)


# --- Main endpoints ---

@app.get("/")
def read_root():
    return {"message": "RAG API is running"}

@app.post("/chat", response_model=QueryResponse)
async def chat_endpoint(request: QueryRequest, token: str = Depends(verify_token)):
    """Route la requête selon le mode sélectionné."""
    logger.info(f"Chat request - Mode: {request.mode}, Query: {request.query}")

    if request.mode == "internal":
        # Logique existante (inchangée)
        index = get_index()
        if not index:
            raise HTTPException(status_code=500, detail="Search index not initialized. Run ingestion first.")

        query_engine = index.as_query_engine(similarity_top_k=5)
        response = query_engine.query(request.query)

        sources = []
        for node in response.source_nodes:
            metadata = node.node.metadata or {}
            sources.append(SourceNode(
                text=node.node.get_content()[:500] + "...",
                score=node.score or 0.0,
                page_label=str(metadata.get("page_label", "N/A")),
                file_name=str(metadata.get("file_name", "N/A")),
                content_type=str(metadata.get("content_type", "text")),
                source_type="internal"
            ))

        return QueryResponse(answer=str(response), sources=sources)

    elif request.mode == "hybrid":
        # Mode Hybride: Interne + Web complet (SANS filtres de domaines)
        internal_sources = []
        external_sources = []

        # Requête interne
        index = get_index()
        if index:
            query_engine = index.as_query_engine(similarity_top_k=3)
            response_internal = query_engine.query(request.query)
            for node in response_internal.source_nodes:
                metadata = node.node.metadata or {}
                internal_sources.append(SourceNode(
                    text=node.node.get_content()[:500] + "...",
                    score=node.score or 0.0,
                    page_label=str(metadata.get("page_label", "N/A")),
                    file_name=str(metadata.get("file_name", "N/A")),
                    content_type=str(metadata.get("content_type", "text")),
                    source_type="internal"
                ))

        # Requête externe SANS filtres de domaines (web complet)
        external_sources = await search_web_agent(request.query, max_results=2, use_domain_filters=False)

        # Synthèse comparative (async)
        answer = await synthesize_hybrid_response(
            request.query,
            internal_sources,
            external_sources
        )

        all_sources = internal_sources + external_sources
        logger.info(f"Hybrid response - Internal: {len(internal_sources)}, External (web): {len(external_sources)}")
        return QueryResponse(answer=answer, sources=all_sources)

    elif request.mode == "science":
        # Mode Science: Revues scientifiques UNIQUEMENT (AVEC filtres de domaines)
        # La requête est traduite FR→EN avant la recherche pour maximiser les résultats

        llm = Settings.llm

        # 1. Traduire la requête FR → EN
        tr_messages = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content="Translate the following French text to English. Return only the translation, nothing else."
            ),
            ChatMessage(role=MessageRole.USER, content=request.query)
        ]
        tr_response = await llm.achat(tr_messages)
        english_query = str(tr_response.message.content).strip()
        logger.info(f"Science - query translated: '{request.query}' → '{english_query}'")

        # 2. Recherche externe avec la requête EN (AVEC filtres de domaines scientifiques)
        external_sources = await search_web_agent(english_query, max_results=5, use_domain_filters=True)

        # 3. Générer réponse bilingue (FR d'abord, EN original en dessous)
        if external_sources:
            context = "Scientific sources:\n"
            for i, src in enumerate(external_sources, 1):
                context += f"[{i}] {src.title}: {src.text}\n\n"

            system_prompt = """You are an expert scientific assistant. Analyze the provided scientific articles and answer the user's question.

RULES:
- Base your response ONLY on the provided scientific articles
- Systematically cite sources with [number]
- Mention authors, journals or dates when relevant
- If articles don't contain the information, say so explicitly
- Do not invent or extrapolate beyond the provided data
- Structure the response clearly and academically

RESPONSE FORMAT — follow this structure strictly:
1. Write the complete answer in FRENCH (the user's language)
2. Add this exact separator on its own line: ---
3. Add this label on its own line: **Version originale (anglais) :**
4. Write the complete answer in ENGLISH, prefixing every paragraph with "> " (markdown blockquote)
"""

            messages = [
                ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
                ChatMessage(
                    role=MessageRole.USER,
                    content=f"Question (FR): {request.query}\nQuestion (EN): {english_query}\n\n{context}"
                )
            ]

            response = await llm.achat(messages)
            answer = str(response.message.content)
        else:
            answer = "Aucun article scientifique trouvé pour cette requête dans les revues indexées."

        # Retourner la traduction seulement si la requête était en français
        returned_english_query = (
            english_query
            if _normalize_for_lang_comparison(request.query) != _normalize_for_lang_comparison(english_query)
            else None
        )
        logger.info(f"Science response - query EN: '{english_query}', sources: {len(external_sources)}, translated: {returned_english_query is not None}")
        return QueryResponse(answer=answer, sources=external_sources, english_query=returned_english_query)

    else:
        raise HTTPException(status_code=400, detail=f"Mode invalide: {request.mode}. Modes disponibles: internal, hybrid, science")

@app.get("/pdf/{filename:path}")
def get_pdf(filename: str, token: str = Depends(verify_token)):
    """Serve PDF files from the data directory"""
    pdf_path = os.path.join(DATA_DIR, filename)

    # Security: Ensure the requested file is within DATA_DIR
    pdf_path = os.path.abspath(pdf_path)
    data_dir_abs = os.path.abspath(DATA_DIR)

    if not pdf_path.startswith(data_dir_abs):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found")

    if not pdf_path.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Not a PDF file")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=filename
    )

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import chromadb
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

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
Settings.embedding = OpenAIEmbedding(model="text-embedding-3-small")
Settings.llm = OpenAI(model="gpt-4o", temperature=0)

# Global Index Variable
index = None

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

class QueryRequest(BaseModel):
    query: str

class SourceNode(BaseModel):
    text: str
    score: float
    page_label: str = "N/A"
    file_name: str = "N/A"

class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceNode]

# Startup event removed to prevent timeouts on Render Free Tier
# The index will be loaded lazily on the first /chat request

@app.get("/")
def read_root():
    return {"message": "RAG API is running"}

@app.post("/chat", response_model=QueryResponse)
def chat_endpoint(request: QueryRequest):
    index = get_index()
    if not index:
        raise HTTPException(status_code=500, detail="Search index not initialized. Run ingestion first.")
    
    query_engine = index.as_query_engine(similarity_top_k=5)
    response = query_engine.query(request.query)
    
    sources = []
    for node in response.source_nodes:
        # Extract metadata if available
        metadata = node.node.metadata or {}
        sources.append(SourceNode(
            text=node.node.get_content()[:500] + "...", # Truncate for display
            score=node.score or 0.0,
            page_label=str(metadata.get("page_label", "N/A")),
            file_name=str(metadata.get("file_name", "N/A"))
        ))
    
    return QueryResponse(answer=str(response), sources=sources)
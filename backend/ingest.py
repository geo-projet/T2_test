import os
import nest_asyncio
from dotenv import load_dotenv
from llama_parse import LlamaParse
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext, Settings
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import chromadb

# Apply nest_asyncio to allow nested event loops (useful for LlamaParse)
nest_asyncio.apply()

# Load environment variables
load_dotenv()

# Configuration
DATA_DIR = os.getenv("DATA_DIR", "./data")
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./chroma_db")
LLAMA_CLOUD_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def check_env_vars():
    missing = []
    if not LLAMA_CLOUD_API_KEY:
        missing.append("LLAMA_CLOUD_API_KEY")
    if not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    
    if missing:
        print(f"❌ Error: Missing environment variables: {', '.join(missing)}")
        print("   Please check your .env file.")
        return False
    return True

def ingest_documents():
    if not check_env_vars():
        return

    print(f"🚀 Starting ingestion process...")
    print(f"   - Data Directory: {DATA_DIR}")
    print(f"   - ChromaDB Directory: {CHROMA_DB_DIR}")

    # 1. Setup Global Settings
    # Use text-embedding-3-small for efficient embeddings
    Settings.embedding = OpenAIEmbedding(model="text-embedding-3-small")
    # Use gpt-4o for high-quality synthesis during query time (though not strictly used during simple ingestion, good to set)
    Settings.llm = OpenAI(model="gpt-4o", temperature=0)

    # 2. Setup LlamaParse
    # result_type="markdown" is ideal for tables and structured data
    print("Parsing documents with LlamaParse (this may take a moment)...")
    parser = LlamaParse(
        result_type="markdown",
        verbose=True,
        language="fr", 
        num_workers=4
    )
    file_extractor = {".pdf": parser}

    # 3. Load Documents
    try:
        documents = SimpleDirectoryReader(
            DATA_DIR, 
            file_extractor=file_extractor,
            recursive=True
        ).load_data()
    except Exception as e:
        print(f"❌ Error reading documents: {e}")
        return

    if not documents:
        print("⚠️  No documents found to ingest.")
        return

    print(f"✅ Successfully parsed {len(documents)} document chunks.")

    # 4. Setup Vector Database (Chroma)
    print(f"💾 Connecting to ChromaDB...")
    db = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    chroma_collection = db.get_or_create_collection("rag_collection")
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # 5. Indexing
    print("⚙️  Creating Vector Index (Embedding & Storing)...")
    index = VectorStoreIndex.from_documents(
        documents, 
        storage_context=storage_context,
        show_progress=True
    )
    
    print("🎉 Ingestion complete! Data is ready for RAG.")

if __name__ == "__main__":
    ingest_documents()
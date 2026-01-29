import os
import nest_asyncio
from dotenv import load_dotenv
from llama_parse import LlamaParse
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext, Settings, Document
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import chromadb
from pypdf import PdfReader
import json

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


def parse_pdf_with_pages(pdf_path, parser):
    """Parse PDF using LlamaParse and extract page information"""
    print(f"   Parsing {os.path.basename(pdf_path)}...")

    # Parse with LlamaParse
    documents = parser.load_data(pdf_path)

    # Get page count from PDF
    try:
        pdf_reader = PdfReader(pdf_path)
        total_pages = len(pdf_reader.pages)
        print(f"   PDF has {total_pages} pages")
    except Exception as e:
        print(f"   Warning: Could not read page count: {e}")
        total_pages = None

    # LlamaParse returns documents but may not have page info
    # Try to get page info from LlamaParse JSON result
    enriched_docs = []

    for idx, doc in enumerate(documents):
        # Add file metadata
        doc.metadata["file_name"] = os.path.basename(pdf_path)

        # Try to extract page number from LlamaParse metadata
        if "page" in doc.metadata:
            page_num = doc.metadata["page"]
        elif "page_number" in doc.metadata:
            page_num = doc.metadata["page_number"]
        elif "pages" in doc.metadata:
            # Sometimes it's a list or range
            pages = doc.metadata["pages"]
            if isinstance(pages, list) and pages:
                page_num = pages[0]
            else:
                page_num = pages
        else:
            # Estimate based on document position
            if total_pages and len(documents) > 0:
                # Distribute chunks across pages
                page_num = min(total_pages, int((idx / len(documents)) * total_pages) + 1)
            else:
                page_num = idx + 1

        doc.metadata["page_label"] = str(page_num)
        enriched_docs.append(doc)

    return enriched_docs

def ingest_documents():
    if not check_env_vars():
        return

    print(f"🚀 Starting ingestion process...")
    print(f"   - Data Directory: {DATA_DIR}")
    print(f"   - ChromaDB Directory: {CHROMA_DB_DIR}")

    # 1. Setup Global Settings
    Settings.embedding = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.llm = OpenAI(model="gpt-4o", temperature=0)

    # 2. Setup LlamaParse for text and tables
    print("📄 Parsing documents with LlamaParse (this may take a moment)...")
    parser = LlamaParse(
        result_type="markdown",
        verbose=True,
        language="fr",
        num_workers=4
    )

    # 3. Load Documents with page information
    documents = []
    pdf_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.pdf')]

    if not pdf_files:
        print("⚠️  No PDF documents found to ingest.")
        return

    for pdf_file in pdf_files:
        pdf_path = os.path.join(DATA_DIR, pdf_file)
        try:
            pdf_docs = parse_pdf_with_pages(pdf_path, parser)
            documents.extend(pdf_docs)
        except Exception as e:
            print(f"❌ Error parsing {pdf_file}: {e}")
            continue

    if not documents:
        print("⚠️  No documents were successfully parsed.")
        return

    print(f"✅ Successfully parsed {len(documents)} document chunks.")

    # 4. Add content type metadata
    print("🏷️  Adding content type metadata...")
    for doc in documents:
        # Check if content contains markdown tables
        if "|" in doc.text and "---" in doc.text:
            doc.metadata["content_type"] = "table"
        else:
            doc.metadata["content_type"] = "text"

        print(f"   Page {doc.metadata.get('page_label', '?')}: {doc.metadata.get('content_type', 'unknown')}")

    print(f"📚 Total documents to index: {len(documents)} (text/table chunks)")

    # 5. Setup Vector Database (Chroma)
    print(f"💾 Connecting to ChromaDB...")
    db = chromadb.PersistentClient(path=CHROMA_DB_DIR)

    # Delete and recreate collection to avoid duplicates
    try:
        db.delete_collection("rag_collection")
        print("   Deleted old collection")
    except:
        pass

    chroma_collection = db.get_or_create_collection("rag_collection")
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # 6. Indexing
    print("⚙️  Creating Vector Index (Embedding & Storing)...")
    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True
    )

    print("🎉 Ingestion complete! Data is ready for RAG.")
    print(f"   - Text/Table chunks: {len(documents)}")
    print(f"   - Total indexed: {len(documents)}")

if __name__ == "__main__":
    ingest_documents()
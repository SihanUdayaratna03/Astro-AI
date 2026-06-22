# AI RAG Assistant

![AstroRAG Assistant](screenshot.png)

A robust Retrieval-Augmented Generation (RAG) assistant built with **React**, **FastAPI**, **sentence-transformers**, **Qdrant**, and the **Google Gemini API**. It processes PDF documents and images, stores local embeddings in a vector database, and uses an LLM to answer questions strictly based on the provided context.

## 🏗️ Architecture

The system uses Python's asynchronous background tasks for reliable processing, keeping embeddings local to avoid API quotas.

```mermaid
graph TD
    %% Define Styles
    classDef frontend fill:#ff4b4b,stroke:#fff,stroke-width:2px,color:#fff
    classDef backend fill:#009688,stroke:#fff,stroke-width:2px,color:#fff
    classDef localAI fill:#f39c12,stroke:#fff,stroke-width:2px,color:#fff
    classDef extAPI fill:#4285f4,stroke:#fff,stroke-width:2px,color:#fff
    classDef database fill:#673ab7,stroke:#fff,stroke-width:2px,color:#fff

    %% Nodes
    UI[React Frontend]:::frontend
    API[FastAPI Backend]:::backend
    SentenceTransformer[Local Embeddings<br>sentence-transformers]:::localAI
    Qdrant[(Qdrant Vector DB)]:::database
    Gemini[Google Gemini API]:::extAPI

    %% Flow
    UI -- "1. Upload PDF/Image" --> API
    UI -- "1b. Poll Status" --> API
    
    subgraph FastAPI Background Tasks
        API -- "Extract Text & Chunk" --> Chunking[Sentence Splitter]
        Chunking -- "Generate Vectors" --> SentenceTransformer
        SentenceTransformer -- "Save Vectors" --> Qdrant
        
        API -- "Search Query" --> SentenceTransformer
        SentenceTransformer -- "Find Nearest" --> Qdrant
        Qdrant -- "Return Contexts" --> API
        API -- "Prompt with Context" --> Gemini
    end

    Gemini -- "Return Answer" --> API
    API -- "Return Answer" --> UI
```

## 🚀 How to Run Locally

You will need to open **three separate terminals** to run all the microservices required for this project.

### 1. Start Qdrant (Vector Database)
Qdrant stores the document embeddings for fast semantic search.
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 2. Start the FastAPI Backend
This serves the API endpoints and processes background ingestion jobs.
```bash
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Start the React Frontend
This serves the user interface.
```bash
cd frontend
npm run dev
```

---

## 🎯 Usage

1. Navigate to **http://localhost:5173** in your browser.
2. Expand the sidebar to **upload a PDF or Image**. Wait for the green success message.
3. In the main chat area, **ask a question** about the document you just uploaded.
4. The system will retrieve the most relevant chunks and generate an answer using Gemini.

## 🛠️ Features
- **Local Embeddings:** Uses `sentence-transformers` (`all-MiniLM-L6-v2`) locally to completely bypass API embedding quota limits and protect your data.
- **Persistent Job State:** Background ingestion tasks survive server reloads using a file-backed job store.
- **Robust Model Fallbacks:** Automatically falls back across multiple Gemini models (`gemini-1.5-flash`, `gemini-1.5-pro`, etc.) to gracefully handle API rate limits (429) and permissions issues (403).
- **Local Vector DB:** Uses Qdrant locally to ensure your data stays on your machine until sent to the LLM.
- **Multimodal Support:** Supports both PDFs and Images (via Gemini Vision OCR).

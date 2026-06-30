# Astro AI

![Welcome to Astro AI](screenshot.png)

**Traditional RAG is excellent at finding relevant passages. But what happens when the answer is spread across an entire document?** That's where most systems break down.

**Astro AI** is a next-generation intelligent document assistant built with **React**, **FastAPI**, **LangGraph**, **sentence-transformers**, **Qdrant**, **MySQL**, and the **Google Gemini API**. It bridges the gap between semantic search and deductive reasoning. 

Instead of just retrieving text chunks, Astro AI automatically extracts a **Multi-Hop Knowledge Graph** from your documents, computes PageRank centrality, and empowers an autonomous AI agent to deductively trace hidden connections between concepts using advanced Recursive SQL queries.

---

## Architecture

Astro AI leverages a highly scalable full-stack architecture. Embeddings are kept fully local to avoid API quota costs, while complex entity extraction and autonomous reasoning rely on LangGraph and the Gemini API.

```mermaid
graph TD
    classDef frontend fill:#ff4b4b,stroke:#fff,stroke-width:2px,color:#fff
    classDef backend fill:#009688,stroke:#fff,stroke-width:2px,color:#fff
    classDef localAI fill:#f39c12,stroke:#fff,stroke-width:2px,color:#fff
    classDef extAPI fill:#4285f4,stroke:#fff,stroke-width:2px,color:#fff
    classDef database fill:#673ab7,stroke:#fff,stroke-width:2px,color:#fff
    classDef agent fill:#34495e,stroke:#fff,stroke-width:2px,color:#fff

    UI[React Frontend]:::frontend
    API[FastAPI Backend]:::backend
    SentenceTransformer[Local Embeddings sentence-transformers]:::localAI
    Qdrant[(Qdrant Vector DB)]:::database
    MySQL[(MySQL Graph DB)]:::database
    Gemini[Google Gemini API]:::extAPI
    LangGraph[LangGraph Autonomous Agent]:::agent

    UI -- "1. Upload Document" --> API
    UI -- "1b. Poll Status" --> API

    subgraph FastAPI Background Ingestion Phase
        API -- "Extract Text & Chunk" --> Chunking[Sentence Splitter]
        Chunking -- "Generate Vectors" --> SentenceTransformer
        SentenceTransformer -- "Save Vectors" --> Qdrant
        
        API -- "Extract Entities & Relationships" --> Gemini
        Gemini -- "Graph JSON" --> NetworkX[NetworkX Centrality Analytics]
        NetworkX -- "Save Nodes, Edges, Scores" --> MySQL
    end

    subgraph Agentic Reasoning Phase
        UI -- "2. User Query" --> API
        API -- "Initialize State" --> LangGraph
        LangGraph -- "Plan & Route" --> Gemini
        LangGraph -- "search_document tool" --> Qdrant
        LangGraph -- "find_connection_path tool" --> MySQL
        LangGraph -- "calculate_expression tool" --> Math[Local Python Math]:::localAI
    end

    LangGraph -- "Synthesize Answer & Sources" --> API
    API -- "Return to User" --> UI
```

---

## Agentic RAG Workflow (LangGraph)

When a user asks a question, Astro AI delegates to a **LangGraph Agent** — a cyclic reasoning loop that decides whether to search the vector database, query the relational knowledge graph, calculate math, or synthesize a final answer. 

```mermaid
graph TD
    classDef state fill:#34495e,stroke:#fff,stroke-width:2px,color:#fff
    classDef model fill:#4285f4,stroke:#fff,stroke-width:2px,color:#fff
    classDef tools fill:#e67e22,stroke:#fff,stroke-width:2px,color:#fff
    classDef fallback fill:#c0392b,stroke:#fff,stroke-width:2px,color:#fff

    Start((User Query))
    State[AgentState Messages, Sources, Contexts]:::state
    Config[RunnableConfig gemini_model]:::state
    LLM[Gemini LLM Reasoning Engine]:::model
    Fallback[Model Fallback Chain 503/429]:::fallback
    ShouldContinue{Tool Call Required?}

    subgraph Tools Node
        ToolNode[Execute Tools]:::tools
        Search[search_document Qdrant]:::tools
        MultiHop[find_connection_path MySQL CTE]:::tools
        Calc[calculate_expression Safe Math]:::tools
        
        ToolNode --> Search
        ToolNode --> MultiHop
        ToolNode --> Calc
    end

    End((Final Answer))

    Start --> Config
    Config --> State
    State --> LLM
    LLM -- "API Error" --> Fallback
    Fallback -- "Next Model" --> LLM
    LLM --> ShouldContinue
    ShouldContinue -- "Yes Call Tool" --> ToolNode
    ToolNode -- "Update State" --> LLM
    ShouldContinue -- "No Answer Ready" --> End
```

**How the Agent Works:**
1. **Model Selection** — The user picks an Astro AI model tier in the UI.
2. **Initialize State** — The agent tracks messages, sources, and context counts.
3. **Reasoning Loop** — The Gemini LLM decides which tool to call:
   - `search_document`: Embeds the query locally and searches Qdrant for textual context.
   - `find_connection_path`: Executes a `WITH RECURSIVE` SQL CTE query in MySQL to trace connections between two concepts up to 4 hops deep.
4. **Self-Healing Fallback** — The system automatically retries with the next model on `503` and `429` errors.
5. **Synthesis** — The LLM synthesizes the final grounded answer and returns it with cited sources.

---

## Astro AI Model Tiers

Astro AI uses a named model tier system. Each tier maps to an underlying Gemini model.

| Astro AI Model      | Underlying Model   | Status        | Description                                  |
|---------------------|--------------------|---------------|----------------------------------------------|
| **Astro AI Nova**   | `gemini-1.5-flash` | Available     | Fast and lightweight. Ideal for quick lookups. |
| **Astro AI Pulsar** | `gemini-2.0-flash` | Available     | Balanced. Recommended for most tasks.        |
| **Astro AI Quasar** | `gemini-1.5-pro`   | Available     | Most powerful. Deep reasoning and analysis.  |

---

## Advanced Features

Astro AI doesn't just read your text; it maps the relationships inside it and lets you interact with them.

1. **Multi-Hop Knowledge Graph & PageRank**: During ingestion, Gemini extracts core entities and relationships. The backend uses `networkx` to calculate PageRank centrality, determining global importance. Highly central nodes appear physically larger in the dynamic React visualization!
2. **Interactive "Ghost Drag" UX**: Want to connect concepts? Drag and drop visual graph nodes from the canvas directly into the chat box. Dropping two nodes automatically constructs an advanced Multi-Hop query for the AI, acting like a digital whiteboard.
3. **Agentic RAG via LangGraph**: The AI autonomously decides whether to search Qdrant for text context or execute complex graph traversal against MySQL.
4. **Self-Healing Fallback**: Built for reliability, the system tracks model tiers (Nova, Pulsar, Quasar) and automatically retries with exponential backoff if it hits API rate limits.
5. **Multimodal OCR & Voice Input**: Seamlessly process PDFs and images via Gemini Vision, and interact hands-free using browser-native speech recognition.

---

## How to Run Locally

Open **separate terminals** to run all required services.

### 1. Start Databases
Ensure you have MySQL running on `localhost:3306` with a database named `astro_ai` and root password `root`.
Start Qdrant (Vector Database):
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 2. Start the FastAPI Backend
```bash
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Start the React Frontend
```bash
cd frontend
npm run dev
```

Navigate to **http://localhost:5173** in your browser.

---

## Features Matrix

| Feature | Description |
|---|---|
| **Multi-Hop Knowledge Graph** | Extracts a relational graph of your document into MySQL, accessible visually and via AI tools. |
| **Graph Centrality Analytics** | Calculates PageRank to physically scale node sizes based on their document-wide importance. |
| **Interactive Ghost Drag UX** | Drag and drop visual graph nodes directly into the chat box to trigger advanced AI queries. |
| **Agentic RAG (LangGraph)** | A cyclic LangGraph agent that decides when to search, trace connections, or answer. |
| **Recursive CTE Engine** | AI utilizes advanced MySQL `WITH RECURSIVE` queries to deductively find paths between nodes. |
| **Local Embeddings** | Uses `sentence-transformers` locally — zero API calls for embedding, zero quota usage. |
| **Multi-Model Fallback** | Automatically retries across Gemini models with exponential backoff on 503/429 errors. |
| **Multimodal OCR** | Supports PDFs and images via Gemini Vision OCR of text, tables, and charts. |
| **Split-Screen Layout** | View the interactive Knowledge Graph side-by-side with your real-time chat history. |
| **Voice Input** | Browser-native speech recognition for hands-free question entry. |

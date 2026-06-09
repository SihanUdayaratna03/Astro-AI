import os
from google import genai
from google.genai import types
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini client with new SDK
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EMBED_MODEL = "models/text-embedding-004"
EMBED_DIM = 3072  # gemini-embedding-001 outputs 3072-dimensional vectors

splitter = SentenceSplitter(chunk_size=1000, chunk_overlap=200)


def load_and_chunk_pdf(path: str) -> list[str]:
    """Load a PDF and split it into text chunks."""
    docs = PDFReader().load_data(file=path)
    texts = [d.text for d in docs if getattr(d, "text", None)]
    chunks = []
    for t in texts:
        chunks.extend(splitter.split_text(t))
    return chunks


def embed_texts(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
    """Embed a list of texts using Gemini's embedding model."""
    embeddings = []
    for text in texts:
        response = client.models.embed_content(
            model=EMBED_MODEL,
            contents=text,
            config=types.EmbedContentConfig(task_type=task_type),
        )
        embeddings.append(response.embeddings[0].values)
    return embeddings
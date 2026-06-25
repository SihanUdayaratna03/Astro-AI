import os
import time
import pathlib
from google import genai
from google.genai import types
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from dotenv import load_dotenv

load_dotenv(override=True)

# Configure Gemini client (used for OCR/generation, NOT embeddings)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Local sentence-transformers embedding model — no API key needed, no quota limits.
# all-MiniLM-L6-v2 produces 384-dimensional vectors and is fast on CPU.
EMBED_DIM = 384

_embedder = None

def _get_embedder():
    """Lazy-load the sentence-transformers model on first use."""
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


# Supported image MIME types for OCR
IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

splitter = SentenceSplitter(chunk_size=1000, chunk_overlap=200)


def get_file_type(path: str) -> str:
    """Returns 'pdf', 'image', or 'unknown' based on file extension."""
    ext = pathlib.Path(path).suffix.lower()
    if ext == ".pdf":
        return "pdf"
    elif ext in IMAGE_MIME_TYPES:
        return "image"
    return "unknown"


def load_and_chunk_pdf(path: str) -> list[str]:
    """Load a PDF and split it into text chunks."""
    docs = PDFReader().load_data(file=path)
    texts = [d.text for d in docs if getattr(d, "text", None)]
    chunks = []
    for t in texts:
        chunks.extend(splitter.split_text(t))
    return chunks


def load_and_chunk_image(path: str) -> list[str]:
    """
    Use Gemini Vision to perform OCR on an image and split the extracted
    text into chunks for embedding. Handles charts, tables, handwriting,
    and any visible text in the image.
    """
    ext = pathlib.Path(path).suffix.lower()
    mime_type = IMAGE_MIME_TYPES.get(ext, "image/jpeg")

    with open(path, "rb") as f:
        image_bytes = f.read()

    ocr_prompt = (
        "You are an advanced OCR and document analysis engine. "
        "Extract ALL text visible in this image with high fidelity. "
        "If the image contains tables, preserve the tabular structure using plain text formatting. "
        "If there are charts or diagrams, describe what they show and extract any labels or values. "
        "If handwriting is present, transcribe it faithfully. "
        "Return ONLY the extracted content — no commentary, no preamble."
    )

    MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"]
    last_error = None
    response = None

    for idx, model_name in enumerate(MODELS):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    ocr_prompt,
                ],
            )
            break
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            is_quota   = "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str
            is_unavail = "503" in err_str or "unavailable" in err_str or "overloaded" in err_str or "high demand" in err_str
            is_missing = "404" in err_str or "not found" in err_str or "not_found" in err_str
            is_denied  = "403" in err_str or "permission" in err_str

            if is_quota:
                print(f"[OCR] Model {model_name} quota exhausted, trying next...")
                last_error = Exception(f"Google API Quota Exhausted. Please wait or check your billing plan. Details: {e}")
                time.sleep(2 ** idx)  # exponential backoff: 1s, 2s, 4s, 8s
                continue
            elif is_unavail:
                print(f"[OCR] Model {model_name} unavailable (503), retrying next model in {2**idx}s...")
                last_error = Exception(f"Model temporarily unavailable (503). Retried all fallbacks. Details: {e}")
                time.sleep(2 ** idx)
                continue
            elif is_missing:
                print(f"[OCR] Model {model_name} not found, trying next...")
                continue
            elif is_denied:
                print(f"[OCR] Model {model_name} permission denied, trying next...")
                continue
            else:
                raise

    if response is None:
        raise last_error

    extracted_text = response.text.strip()

    if not extracted_text:
        return []

    chunks = splitter.split_text(extracted_text)
    return chunks


def embed_texts(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
    """Embed texts using local sentence-transformers (all-MiniLM-L6-v2, 384-dim).
    
    This runs fully locally — no API key or quota needed.
    The task_type parameter is accepted for API compatibility but not used.
    """
    model = _get_embedder()
    vectors = model.encode(texts, convert_to_numpy=True)
    return [v.tolist() for v in vectors]
import os
import pathlib
from google import genai
from google.genai import types
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini client with new SDK
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 3072  # gemini-embedding-001 outputs 3072-dimensional vectors

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

    MODELS = ["gemini-2.0-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash-lite"]
    last_error = None
    response = None

    for model_name in MODELS:
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
            if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                print(f"Model {model_name} quota exhausted or rate limited, trying next...")
                continue
            elif "404" in err_str or "not found" in err_str or "not_found" in err_str:
                print(f"Model {model_name} not found, trying next...")
                continue
            else:
                raise

    if response is None:
        raise last_error

    extracted_text = response.text.strip()

    if not extracted_text:
        return []

    # Split the extracted text into chunks for embedding
    chunks = splitter.split_text(extracted_text)
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
import logging
import uuid
import os
import asyncio
import json
import threading
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger("uvicorn")

# ── File-backed job store (survives uvicorn --reload restarts) ──────────────
_JOBS_FILE = Path("jobs.json")
_jobs_lock = threading.Lock()


def _load_jobs() -> dict:
    if _JOBS_FILE.exists():
        try:
            return json.loads(_JOBS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_job(job_id: str, data: dict):
    with _jobs_lock:
        jobs = _load_jobs()
        jobs[job_id] = data
        _JOBS_FILE.write_text(json.dumps(jobs), encoding="utf-8")


def _get_job(job_id: str) -> dict | None:
    with _jobs_lock:
        return _load_jobs().get(job_id)


# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Background task: ingest a document (PDF or image) ──────────────────────
async def _ingest_document(job_id: str, file_path: str, source_id: str):
    _save_job(job_id, {"status": "running", "output": None, "error": None})
    try:
        from app.services.data_loader import load_and_chunk_pdf, load_and_chunk_image, get_file_type, embed_texts
        from app.services.vector_db import get_storage

        file_type = get_file_type(file_path)
        logger.info(f"[Job {job_id}] Loading file type={file_type} path={file_path}")

        if file_type == "pdf":
            chunks = await asyncio.to_thread(load_and_chunk_pdf, file_path)
        elif file_type == "image":
            chunks = await asyncio.to_thread(load_and_chunk_image, file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_path}")

        logger.info(f"[Job {job_id}] Loaded {len(chunks)} chunks, embedding...")
        vecs = await asyncio.to_thread(embed_texts, chunks)

        ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{i}")) for i in range(len(chunks))]
        payloads = [{"source": source_id, "text": chunks[i]} for i in range(len(chunks))]

        logger.info(f"[Job {job_id}] Upserting {len(chunks)} vectors to Qdrant...")
        await asyncio.to_thread(lambda: get_storage().upsert(ids, vecs, payloads))

        logger.info(f"[Job {job_id}] Done! Ingested {len(chunks)} chunks.")
        _save_job(job_id, {
            "status": "completed",
            "output": {"ingested": len(chunks)},
            "error": None,
        })
    except Exception as e:
        logger.error(f"[Job {job_id}] Ingest failed: {e}", exc_info=True)
        _save_job(job_id, {"status": "failed", "output": None, "error": str(e)})


async def _ingest_prechunked(job_id: str, chunks: list[str], source_id: str):
    """Background task: embed and upsert pre-extracted chunks (no re-OCR)."""
    _save_job(job_id, {"status": "running", "output": None, "error": None})
    try:
        from app.services.data_loader import ingest_prechunked_chunks

        logger.info(f"[Job {job_id}] Ingesting {len(chunks)} pre-extracted chunks for '{source_id}'...")
        count = await asyncio.to_thread(ingest_prechunked_chunks, chunks, source_id)

        logger.info(f"[Job {job_id}] Done! Ingested {count} chunks.")
        _save_job(job_id, {
            "status": "completed",
            "output": {"ingested": count},
            "error": None,
        })
    except Exception as e:
        logger.error(f"[Job {job_id}] Pre-chunked ingest failed: {e}", exc_info=True)
        _save_job(job_id, {"status": "failed", "output": None, "error": str(e)})


# ── Astro AI model → Gemini model mapping ──────────────────────────────────
# Adding a new Astro AI model in the future only requires adding an entry here.
ASTRO_MODEL_MAP: dict[str, str] = {
    "nova":   "gemini-2.0-flash",    # Astro AI Nova   — fast, lightweight
    "pulsar": "gemini-2.5-flash",    # Astro AI Pulsar — balanced (default)
    "quasar": "gemini-2.5-pro",      # Astro AI Quasar — powerful, deep reasoning
}
DEFAULT_ASTRO_MODEL = "nova"


# ── Background task: answer a question via LangGraph RAG ───────────────────
async def _query_rag(job_id: str, question: str, astro_model: str = DEFAULT_ASTRO_MODEL):
    _save_job(job_id, {"status": "running", "output": None, "error": None})
    try:
        from app.agent.graph import app as langgraph_app
        from langchain_core.messages import HumanMessage

        # Resolve the Astro model name to the underlying Gemini model ID.
        # Unknown names fall back to the default Pulsar model.
        gemini_model = ASTRO_MODEL_MAP.get(astro_model, ASTRO_MODEL_MAP[DEFAULT_ASTRO_MODEL])
        logger.info(f"[Job {job_id}] Astro model='{astro_model}' → Gemini model='{gemini_model}'")

        initial_state = {
            "messages": [
                {"role": "system", "content": "You are a helpful AI assistant. Use tools to search documents or perform calculations if needed. Answer concisely."},
                HumanMessage(content=question),
            ],
            "sources": [],
            "num_contexts": 0,
        }

        # Pass the chosen Gemini model name through LangGraph's configurable dict.
        run_config = {"configurable": {"gemini_model": gemini_model}}

        logger.info(f"[Job {job_id}] Running LangGraph RAG for: {question!r}")
        result = await asyncio.to_thread(langgraph_app.invoke, initial_state, run_config)

        final_message = result["messages"][-1].content
        if isinstance(final_message, list):
            text_blocks = [b["text"] for b in final_message if isinstance(b, dict) and "text" in b]
            text_blocks += [b for b in final_message if isinstance(b, str)]
            final_message = "\n".join(text_blocks)
        elif not isinstance(final_message, str):
            final_message = str(final_message)

        sources = result.get("sources", [])
        logger.info(f"[Job {job_id}] RAG answer generated.")
        _save_job(job_id, {
            "status": "completed",
            "output": {"answer": final_message, "sources": sources},
            "error": None,
        })
    except Exception as e:
        logger.error(f"[Job {job_id}] Query failed: {e}", exc_info=True)
        _save_job(job_id, {"status": "failed", "output": None, "error": str(e)})


# ── Accepted file extensions ────────────────────────────────────────────────
ACCEPTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


class QueryRequest(BaseModel):
    question: str
    model: str = DEFAULT_ASTRO_MODEL  # Astro model id: 'nova' | 'pulsar' | 'quasar'


# ── Routes ───────────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a PDF or image file. Returns a job_id to poll for completion."""
    ext = Path(file.filename).suffix.lower()
    if ext not in ACCEPTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: {', '.join(ACCEPTED_EXTENSIONS)}",
        )

    upload_dir = Path("uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    job_id = str(uuid.uuid4())
    # Pre-create job entry so status is immediately "running" not "pending"
    _save_job(job_id, {"status": "running", "output": None, "error": None})
    background_tasks.add_task(_ingest_document, job_id, str(file_path.resolve()), file.filename)

    logger.info(f"Uploaded {file.filename!r} -> job {job_id}")
    return {
        "event_id": job_id,
        "message": "File uploaded - ingestion started.",
        "file_type": "pdf" if ext == ".pdf" else "image",
        "filename": file.filename,
    }


@app.post("/api/query")
async def query_pdf(req: QueryRequest, background_tasks: BackgroundTasks):
    """Submit a question. Returns a job_id to poll for the answer."""
    job_id = str(uuid.uuid4())
    _save_job(job_id, {"status": "running", "output": None, "error": None})
    background_tasks.add_task(_query_rag, job_id, req.question, req.model)
    return {"event_id": job_id, "message": "Query started.", "astro_model": req.model}


@app.get("/api/status/{job_id}")
def get_job_status(job_id: str):
    """Poll the status of a background job."""
    job = _get_job(job_id)
    if job is None:
        return {"status": "pending"}

    status = job["status"]
    if status == "completed":
        return {"status": "completed", "output": job["output"]}
    elif status == "failed":
        return {"status": "failed", "error": job.get("error")}
    else:
        return {"status": status}


# ── OCR Scan endpoint ────────────────────────────────────────────────────────
IMAGE_OCR_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


@app.post("/api/ocr-scan")
async def ocr_scan_image(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """OCR an image with Gemini Vision and background-ingest the text into Qdrant."""
    ext = Path(file.filename).suffix.lower()
    if ext not in IMAGE_OCR_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Expected an image (PNG/JPG/JPEG/WEBP). Got '{ext}'.",
        )

    upload_dir = Path("uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    from app.services.data_loader import load_and_chunk_image
    try:
        chunks = await asyncio.to_thread(load_and_chunk_image, str(file_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")

    if not chunks:
        raise HTTPException(status_code=422, detail="No text could be extracted from this image.")

    extracted_text = "\n\n".join(chunks)

    # Use _ingest_prechunked instead of _ingest_document to avoid re-running OCR.
    # The chunks are already extracted above — just embed + upsert them.
    job_id = str(uuid.uuid4())
    _save_job(job_id, {"status": "running", "output": None, "error": None})
    background_tasks.add_task(_ingest_prechunked, job_id, chunks, file.filename)

    return {
        "extracted_text": extracted_text,
        "char_count": len(extracted_text),
        "chunk_count": len(chunks),
        "event_id": job_id,
        "filename": file.filename,
        "message": "OCR complete. Background ingestion started.",
    }
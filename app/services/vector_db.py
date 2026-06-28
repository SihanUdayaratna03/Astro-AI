import threading
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct


class QdrantStorage:
    def __init__(self, url="http://localhost:6333", collection="docs_minilm_v1", dim=384):
        self.client = QdrantClient(url=url, timeout=30)
        self.collection = collection
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )

    def upsert(self, ids, vectors, payloads):
        if not ids:
            return
        points = [PointStruct(id=ids[i], vector=vectors[i], payload=payloads[i]) for i in range(len(ids))]
        self.client.upsert(self.collection, points=points)

    def search(self, query_vector, top_k: int = 5):
        response = self.client.query_points(
            collection_name=self.collection,
            query=query_vector,
            with_payload=True,
            limit=top_k,
        )
        contexts = []
        sources = set()

        for r in response.points:
            payload = getattr(r, "payload", None) or {}
            text = payload.get("text", "")
            source = payload.get("source", "")
            if text:
                contexts.append(text)
                sources.add(source)

        return {"contexts": contexts, "sources": list(sources)}

    def get_document_chunks(self, source_filename: str, limit: int = 50) -> list[str]:
        from qdrant_client.http import models
        response, _ = self.client.scroll(
            collection_name=self.collection,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="source",
                        match=models.MatchValue(value=source_filename)
                    )
                ]
            ),
            limit=limit,
            with_payload=True,
        )
        chunks = []
        for r in response:
            payload = getattr(r, "payload", None) or {}
            text = payload.get("text", "")
            if text:
                chunks.append(text)
        return chunks


# ── Module-level singleton ──────────────────────────────────────────────────
# Avoids creating a new TCP connection + collection_exists check per request.
_storage_instance = None
_storage_lock = threading.Lock()


def get_storage() -> QdrantStorage:
    """Return a cached QdrantStorage singleton (thread-safe)."""
    global _storage_instance
    if _storage_instance is None:
        with _storage_lock:
            if _storage_instance is None:
                _storage_instance = QdrantStorage()
    return _storage_instance
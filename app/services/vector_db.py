import threading
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from app.core.security import get_tenant_id

class QdrantStorage:
    def __init__(self, url="http://localhost:6333", collection="docs_minilm_v1", dim=384):
        self.client = QdrantClient(url=url, timeout=30)
        self.base_collection = collection
        self.dim = dim
        self._initialized_collections = set()
        # Initialize default collection right away for backward compatibility
        self._ensure_collection(self.base_collection)

    def _get_collection_name(self) -> str:
        tenant_id = get_tenant_id()
        if tenant_id == "default":
            return self.base_collection
        return f"{self.base_collection}_{tenant_id}"

    def _ensure_collection(self, collection_name: str):
        if collection_name not in self._initialized_collections:
            if not self.client.collection_exists(collection_name):
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=self.dim, distance=Distance.COSINE),
                )
            self._initialized_collections.add(collection_name)

    def upsert(self, ids, vectors, payloads):
        if not ids:
            return
        collection = self._get_collection_name()
        self._ensure_collection(collection)
        points = [PointStruct(id=ids[i], vector=vectors[i], payload=payloads[i]) for i in range(len(ids))]
        self.client.upsert(collection, points=points)

    def search(self, query_vector, top_k: int = 5):
        collection = self._get_collection_name()
        self._ensure_collection(collection)
        response = self.client.query_points(
            collection_name=collection,
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
        collection = self._get_collection_name()
        self._ensure_collection(collection)
        response, _ = self.client.scroll(
            collection_name=collection,
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
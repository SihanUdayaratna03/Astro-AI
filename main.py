import logging
from fastapi import FastAPI
import inngest
import inngest.fast_api
from dotenv import load_dotenv

import socket
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    responses = old_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo
import uuid
import os
import datetime
from data_loader import load_and_chunk_pdf, embed_texts
from vector_db import QdrantStorage
from custom_types import RAQQueryResult, RAGSearchResult, RAGUpsertResult, RAGChunkAndSrc

load_dotenv()

inngest_client = inngest.Inngest(
    app_id="rag_app",
    logger=logging.getLogger("uvicorn"),
    is_production=False,
    serializer=inngest.PydanticSerializer()
)

@inngest_client.create_function(
    fn_id="RAG: Ingest PDF",
    trigger=inngest.TriggerEvent(event="rag/ingest_pdf"),
    throttle=inngest.Throttle(
        limit=2, period=datetime.timedelta(minutes=1)  # ✅ Fixed: count → limit
    ),
    rate_limit=inngest.RateLimit(
        limit=1,
        period=datetime.timedelta(hours=4),
        key="event.data.source_id",
    ),
)
async def rag_ingest_pdf(ctx: inngest.Context):
    def _load(ctx: inngest.Context) -> RAGChunkAndSrc:
        pdf_path = ctx.event.data["pdf_path"]
        source_id = ctx.event.data.get("source_id", pdf_path)
        chunks = load_and_chunk_pdf(pdf_path)
        return RAGChunkAndSrc(chunks=chunks, source_id=source_id)

    def _upsert(chunks_and_src: RAGChunkAndSrc) -> RAGUpsertResult:
        chunks = chunks_and_src.chunks
        source_id = chunks_and_src.source_id
        vecs = embed_texts(chunks)
        ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{i}")) for i in range(len(chunks))]
        payloads = [{"source": source_id, "text": chunks[i]} for i in range(len(chunks))]
        QdrantStorage().upsert(ids, vecs, payloads)
        return RAGUpsertResult(ingested=len(chunks))

    chunks_and_src = await ctx.step.run("load-and-chunk", lambda: _load(ctx), output_type=RAGChunkAndSrc)
    ingested = await ctx.step.run("embed-and-upsert", lambda: _upsert(chunks_and_src), output_type=RAGUpsertResult)
    return ingested.model_dump()


@inngest_client.create_function(
    fn_id="RAG: Query PDF",
    trigger=inngest.TriggerEvent(event="rag/query_pdf_ai")
)
async def rag_query_pdf_ai(ctx: inngest.Context):
    question = ctx.event.data["question"]

    def _run_langgraph(q: str):
        import signal
        import threading
        from agents import app
        from langchain_core.messages import HumanMessage
        
        initial_state = {
            "messages": [
                {"role": "system", "content": "You are a helpful AI assistant. Use tools to search documents or perform calculations if needed. Answer concisely."},
                HumanMessage(content=q)
            ],
            "sources": [],
            "num_contexts": 0
        }
        
        result = app.invoke(initial_state)
        
        final_message = result["messages"][-1].content
        if isinstance(final_message, list):
            text_blocks = [block["text"] for block in final_message if isinstance(block, dict) and "text" in block]
            text_blocks += [block for block in final_message if isinstance(block, str)]
            final_message = "\n".join(text_blocks)
        elif not isinstance(final_message, str):
            final_message = str(final_message)
            
        sources = result.get("sources", [])
        num_contexts = result.get("num_contexts", 0)
        
        return {
            "answer": final_message,
            "sources": sources,
            "num_contexts": num_contexts
        }

    output = await ctx.step.run("run-langgraph-agent", lambda: _run_langgraph(question))
    return output


app = FastAPI()
inngest.fast_api.serve(app, inngest_client, [rag_ingest_pdf, rag_query_pdf_ai])
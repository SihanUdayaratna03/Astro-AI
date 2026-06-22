import asyncio
import inngest
import logging

inngest_client = inngest.Inngest(
    app_id="rag_app",
    logger=logging.getLogger("uvicorn"),
    is_production=False,
    serializer=inngest.PydanticSerializer()
)

async def main():
    res = await inngest_client.send(inngest.Event(
        name="rag/ingest_document",
        data={"pdf_path": "test", "source_id": "test"},
    ))
    print("res type:", type(res))
    print("res content:", res)
    if isinstance(res, list) and len(res) > 0:
        print("res[0] type:", type(res[0]))

asyncio.run(main())

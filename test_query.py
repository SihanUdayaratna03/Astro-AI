import asyncio
from app.main import _query_rag, _get_job
import uuid

async def test():
    job_id = str(uuid.uuid4())
    print('Starting job', job_id)
    await _query_rag(job_id, 'what is the last day to register?', 'gemini-2.5-flash')
    print('Finished:', _get_job(job_id))

asyncio.run(test())

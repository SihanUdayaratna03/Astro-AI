import os
import logging
logging.basicConfig(level=logging.DEBUG)

from dotenv import load_dotenv
load_dotenv()

import socket
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    responses = old_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo

def test_run():
    print("Starting test...")
    from app.agent.graph import app
    from langchain_core.messages import HumanMessage

    initial_state = {
        "messages": [
            {"role": "system", "content": "You are a helpful AI assistant. Use tools to search documents or perform calculations if needed. Answer concisely."},
            HumanMessage(content="What is the last day to register to 3yr 1 sem?")
        ],
        "sources": [],
        "num_contexts": 0
    }
    
    print("Invoking graph...", flush=True)
    try:
        result = app.invoke(initial_state)
        print("Done invoking graph.", flush=True)
        
        final_message = result["messages"][-1].content
        print("Raw final_message:", repr(final_message))
        
        if isinstance(final_message, list):
            text_blocks = [block["text"] for block in final_message if isinstance(block, dict) and "text" in block]
            text_blocks += [block for block in final_message if isinstance(block, str)]
            final_message = "\n".join(text_blocks)
        elif not isinstance(final_message, str):
            final_message = str(final_message)
            
        print("Processed final_message:", final_message)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_run()

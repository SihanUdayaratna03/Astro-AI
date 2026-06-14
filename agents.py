import os
from typing import Literal, TypedDict, List
from langchain_core.messages import BaseMessage, HumanMessage, ToolMessage
from langgraph.graph import StateGraph, MessagesState
from langgraph.prebuilt import ToolNode
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool

from vector_db import QdrantStorage
from data_loader import embed_texts

class AgentState(MessagesState):
    sources: List[str]
    num_contexts: int

@tool
def search_document(query: str, top_k: int = 5) -> str:
    """Searches the uploaded PDF document for relevant information to answer the user's query."""
    try:
        query_vec = embed_texts([query], task_type="RETRIEVAL_QUERY")[0]
        store = QdrantStorage()
        found = store.search(query_vec, top_k)
        context_block = "\n\n".join(f"- {c}" for c in found["contexts"])
        
        # We append sources at the end so our custom tool node can extract them
        sources_str = ",".join(found['sources'])
        return f"Contexts:\n{context_block}\n\n---SOURCES---\n{sources_str}"
    except Exception as e:
        return f"Error searching document: {e}"

@tool
def calculate_expression(expression: str) -> str:
    """Evaluates a mathematical expression or performs data calculation on extracted numbers. Use valid Python expressions."""
    try:
        import math
        # Simple safe evaluation
        allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return str(result)
    except Exception as e:
        return f"Error calculating: {e}"

tools = [search_document, calculate_expression]
tool_node = ToolNode(tools)

# Langchain Google GenAI defaults to checking GOOGLE_API_KEY
if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

# Initialize model
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
model_with_tools = model.bind_tools(tools)

def call_model(state: AgentState):
    messages = state["messages"]
    response = model_with_tools.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    messages = state["messages"]
    last_message = messages[-1]
    if not last_message.tool_calls:
        return "__end__"
    return "tools"

def custom_tool_node(state: AgentState):
    # Run the standard tool node to execute tools
    result = tool_node.invoke(state)
    
    # Extract sources if search_document was called
    messages = state["messages"]
    last_message = messages[-1]
    
    new_sources = []
    num_contexts = 0
    
    if hasattr(last_message, 'tool_calls'):
        for tc in last_message.tool_calls:
            if tc['name'] == 'search_document':
                # find the corresponding ToolMessage in result
                for m in result['messages']:
                    if isinstance(m, ToolMessage) and m.tool_call_id == tc['id']:
                        content = str(m.content)
                        if "---SOURCES---\n" in content:
                            parts = content.split("---SOURCES---\n")
                            contexts_str = parts[0]
                            src_str = parts[1]
                            
                            if src_str.strip():
                                new_sources.extend(src_str.strip().split(","))
                            
                            num_contexts += contexts_str.count("- ")
    
    # State update
    state_updates = {"messages": result["messages"]}
    
    existing_sources = state.get("sources", []) or []
    combined_sources = list(set(existing_sources + new_sources))
    if combined_sources:
        state_updates["sources"] = combined_sources
        
    existing_ctx = state.get("num_contexts", 0) or 0
    state_updates["num_contexts"] = existing_ctx + num_contexts
    
    return state_updates

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", custom_tool_node)

workflow.set_entry_point("agent")
workflow.add_conditional_edges(
    "agent",
    should_continue,
)
workflow.add_edge("tools", "agent")

app = workflow.compile()

import os
import time
from typing import Literal, List
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, MessagesState
from langgraph.prebuilt import ToolNode
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool

from app.services.vector_db import get_storage
from app.services.data_loader import embed_texts


class AgentState(MessagesState):
    sources: List[str]
    num_contexts: int



# ── Tools ────────────────────────────────────────────────────────────────────
@tool
def search_document(query: str, top_k: int = 5) -> str:
    """Searches the uploaded PDF document for relevant information to answer the user query."""
    try:
        query_vec = embed_texts([query], task_type="RETRIEVAL_QUERY")[0]
        found = get_storage().search(query_vec, top_k)  # module-level singleton
        context_block = "\n\n".join(f"- {c}" for c in found["contexts"])
        sources_str = ",".join(found["sources"])
        return f"Contexts:\n{context_block}\n\n---SOURCES---\n{sources_str}"
    except Exception as e:
        return f"Error searching document: {e}"


@tool
def calculate_expression(expression: str) -> str:
    """Evaluates a mathematical expression. Use valid Python math expressions."""
    try:
        import math
        allowed = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
        return str(eval(expression, {"__builtins__": {}}, allowed))
    except Exception as e:
        return f"Error calculating: {e}"


@tool
def query_knowledge_graph(entity_name: str) -> str:
    """Queries the relational Knowledge Graph for all connections involving the given entity (e.g. person, organization).
    Use this when answering questions about relationships, ownership, partnerships, or affiliations."""
    try:
        from app.core.db import SessionLocal
        from app.models.graph import Entity, Relationship
        from sqlalchemy import or_
        
        db = SessionLocal()
        try:
            # Find the entity
            entity = db.query(Entity).filter(Entity.name.ilike(f"%{entity_name}%")).first()
            if not entity:
                return f"No information found for entity '{entity_name}' in the Knowledge Graph."
                
            # Find all relationships where this entity is source or target
            rels = db.query(Relationship).filter(
                or_(
                    Relationship.source_entity_id == entity.id,
                    Relationship.target_entity_id == entity.id
                )
            ).all()
            
            if not rels:
                return f"Entity '{entity.name}' exists but has no known relationships."
                
            result_lines = [f"Knowledge Graph connections for '{entity.name}':"]
            for r in rels:
                src = r.source_entity.name
                tgt = r.target_entity.name
                result_lines.append(f"- [{src}] --({r.relationship_type})--> [{tgt}] : {r.description}")
                
            return "\n".join(result_lines)
        finally:
            db.close()
    except Exception as e:
        return f"Error querying Knowledge Graph: {e}"


@tool
def find_connection_path(entity1_name: str, entity2_name: str) -> str:
    """Finds a multi-hop connection path between two entities in the Knowledge Graph.
    Use this when you need to reason about how two seemingly unrelated concepts/people/companies are connected.
    """
    try:
        from app.core.db import SessionLocal
        from sqlalchemy import text
        
        db = SessionLocal()
        try:
            # Recursive CTE to find path (Breadth-First Search up to depth 4)
            # Standard MySQL syntax.
            query = text("""
            WITH RECURSIVE GraphPaths AS (
                SELECT 
                    e.id AS current_node,
                    CAST(e.name AS CHAR(1000)) AS path_string,
                    1 AS depth
                FROM entities e
                WHERE e.name LIKE :start_name
                
                UNION ALL
                
                SELECT 
                    CASE WHEN r.source_entity_id = gp.current_node THEN r.target_entity_id ELSE r.source_entity_id END,
                    CONCAT(gp.path_string, ' -> ', e_next.name),
                    gp.depth + 1
                FROM GraphPaths gp
                JOIN relationships r 
                    ON r.source_entity_id = gp.current_node OR r.target_entity_id = gp.current_node
                JOIN entities e_next 
                    ON e_next.id = CASE WHEN r.source_entity_id = gp.current_node THEN r.target_entity_id ELSE r.source_entity_id END
                WHERE gp.depth < 4
                  AND INSTR(gp.path_string, e_next.name) = 0 -- Prevent cycles
            )
            SELECT path_string 
            FROM GraphPaths 
            WHERE current_node IN (SELECT id FROM entities WHERE name LIKE :end_name)
            ORDER BY depth ASC
            LIMIT 1;
            """)
            
            result = db.execute(query, {"start_name": f"%{entity1_name}%", "end_name": f"%{entity2_name}%"}).fetchone()
            
            if result:
                return f"Path found: {result[0]}"
            else:
                return f"No connection path found between '{entity1_name}' and '{entity2_name}' within 4 degrees of separation."
                
        finally:
            db.close()
    except Exception as e:
        return f"Error finding connection path: {e}"


tools = [search_document, calculate_expression, query_knowledge_graph, find_connection_path]
tool_node = ToolNode(tools)

# LangChain reads GOOGLE_API_KEY; map from GEMINI_API_KEY if needed
if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

# ── Model config ─────────────────────────────────────────────────────────────
# Three models are enough. gemini-2.5-flash removed — it was causing longer queues.
FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite"]

# ── Cached model instances (avoid recreating HTTP sessions per query) ────────
_model_cache: dict[str, ChatGoogleGenerativeAI] = {}
_bound_cache: dict[str, object] = {}


def _get_model_with_tools(model_name: str):
    """Return a cached model instance with tools already bound."""
    if model_name not in _bound_cache:
        model = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0.2,
            timeout=10,     # Fail fast: 10s per attempt, then try the next model
            max_retries=0,  # CRITICAL: LangChain max_retries multiplies timeout by (retries+1)
        )                   # With max_retries=2 and timeout=60, one model = 3 * 60 = 180s!
        _bound_cache[model_name] = model.bind_tools(tools)
    return _bound_cache[model_name]


# ── Agent node ───────────────────────────────────────────────────────────────
def call_model(state: AgentState, config: RunnableConfig):
    messages = state["messages"]
    primary = config.get("configurable", {}).get("gemini_model", FALLBACK_MODELS[0])
    ordered = [primary] + [m for m in FALLBACK_MODELS if m != primary]
    last_error = None

    for model_name in ordered:
        try:
            m = _get_model_with_tools(model_name)  # cached instance
            response = m.invoke(messages)
            return {"messages": [response]}
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            is_retryable = any(kw in err_str for kw in [
                "429", "resource_exhausted", "quota",
                "503", "unavailable", "overloaded", "high demand",
                "timeout", "timed out", "deadline",
            ])
            is_skip = any(kw in err_str for kw in [
                "404", "not found", "not_found", "403", "permission",
            ])

            if is_retryable:
                print(f"[Agent] {model_name} failed ({err_str[:80]}), switching model in 1s...")
                last_error = Exception(f"Model {model_name} unavailable: {e}")
                time.sleep(1)   # flat 1s — fast failover, not minutes of exponential sleep
                continue
            elif is_skip:
                print(f"[Agent] {model_name} not accessible, trying next...")
                continue
            else:
                raise   # hard error — propagate immediately

    raise last_error


# ── Routing ──────────────────────────────────────────────────────────────────
def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    return "tools" if last.tool_calls else "__end__"


# ── Custom tool node (extracts sources from tool output) ─────────────────────
def custom_tool_node(state: AgentState):
    result = tool_node.invoke(state)
    last_message = state["messages"][-1]
    new_sources = []
    num_contexts = 0

    if hasattr(last_message, "tool_calls"):
        for tc in last_message.tool_calls:
            if tc["name"] == "search_document":
                for m in result["messages"]:
                    if isinstance(m, ToolMessage) and m.tool_call_id == tc["id"]:
                        content = str(m.content)
                        if "---SOURCES---\n" in content:
                            parts = content.split("---SOURCES---\n")
                            if parts[1].strip():
                                new_sources.extend(parts[1].strip().split(","))
                            num_contexts += parts[0].count("- ")

    state_updates = {"messages": result["messages"]}
    combined = list(set((state.get("sources") or []) + new_sources))
    if combined:
        state_updates["sources"] = combined
    state_updates["num_contexts"] = (state.get("num_contexts") or 0) + num_contexts
    return state_updates


# ── Build graph ───────────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", custom_tool_node)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

# recursion_limit caps agent<->tool loops — prevents infinite reasoning cycles
app = workflow.compile()

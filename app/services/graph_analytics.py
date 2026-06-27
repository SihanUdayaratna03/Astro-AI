import logging
import networkx as nx
from app.core.db import SessionLocal
from app.models.graph import Entity, Relationship

logger = logging.getLogger("uvicorn")

def update_centrality_scores():
    """Calculates PageRank for all entities and updates their centrality_score in the database."""
    db = SessionLocal()
    try:
        # Fetch all entities and relationships
        entities = db.query(Entity).all()
        relationships = db.query(Relationship).all()

        if not entities:
            return

        # Build NetworkX graph
        G = nx.DiGraph()
        
        # Add nodes
        for e in entities:
            G.add_node(e.id)
            
        # Add edges
        for r in relationships:
            G.add_edge(r.source_entity_id, r.target_entity_id)

        # Calculate PageRank
        # alpha=0.85 is standard.
        # If the graph is disconnected or small, networkx handles it gracefully.
        pagerank_scores = nx.pagerank(G, alpha=0.85, max_iter=100, tol=1e-06)

        # Normalize scores to make them easier to visualize (e.g. max score = 10, min score = 1)
        if pagerank_scores:
            max_pr = max(pagerank_scores.values())
            min_pr = min(pagerank_scores.values())
            pr_range = max_pr - min_pr if max_pr > min_pr else 1.0

            # Scale to [1.0, 10.0] for UI
            for e in entities:
                raw_score = pagerank_scores.get(e.id, 0)
                # Map raw_score to [1, 10]
                scaled_score = 1.0 + 9.0 * ((raw_score - min_pr) / pr_range)
                e.centrality_score = scaled_score

            db.commit()
            logger.info(f"Updated centrality scores for {len(entities)} entities.")
    except Exception as e:
        logger.error(f"Failed to update centrality scores: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

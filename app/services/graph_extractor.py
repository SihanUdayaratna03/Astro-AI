import os
import json
import logging
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.graph import Document, Entity, Relationship
from app.services.graph_analytics import update_centrality_scores

logger = logging.getLogger("uvicorn")

# Use the same Gemini client configuration
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def extract_and_save_graph(text: str, source_filename: str, source_id: str):
    """
    Extract entities and relationships from text using Gemini, 
    and save them to the MySQL graph database.
    """
    try:
        logger.info(f"[GraphExtractor] Starting extraction for {source_filename} (ID: {source_id})")
        
        # 1. Prompt Gemini for JSON extraction
        prompt = (
            "Analyze the following text. Extract all major entities (e.g., People, Organizations, Locations, Concepts) "
            "and the relationships between them. Output strictly in JSON format matching this schema exactly:\n"
            "{\n"
            '  "entities": [{"name": "string", "type": "string", "description": "string"}],\n'
            '  "relationships": [{"source_entity": "string", "target_entity": "string", "relationship_type": "string", "description": "string"}]\n'
            "}\n\n"
            "Text to analyze:\n" + text
        )
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        # 2. Parse the JSON response
        if not response.text:
            logger.warning("[GraphExtractor] Empty response from Gemini")
            return
            
        data = json.loads(response.text)
        entities_data = data.get("entities", [])
        relationships_data = data.get("relationships", [])
        
        logger.info(f"[GraphExtractor] Extracted {len(entities_data)} entities and {len(relationships_data)} relationships")
        
        # 3. Save to Database
        db: Session = SessionLocal()
        try:
            # Ensure Document exists
            doc = db.query(Document).filter(Document.id == source_id).first()
            if not doc:
                doc = Document(id=source_id, filename=source_filename)
                db.add(doc)
                db.flush()
                
            # Dictionary to keep track of entity objects by name to avoid duplicate inserts
            entity_map = {}
            
            # Process Entities (Upsert logic)
            for e_data in entities_data:
                name = e_data.get("name")
                if not name: continue
                
                # Check if entity already exists
                entity = db.query(Entity).filter(Entity.name == name).first()
                if not entity:
                    entity = Entity(
                        name=name,
                        entity_type=e_data.get("type", "UNKNOWN"),
                        description=e_data.get("description", "")
                    )
                    db.add(entity)
                    db.flush() # get the ID
                
                entity_map[name] = entity
                
            # Process Relationships
            for r_data in relationships_data:
                source_name = r_data.get("source_entity")
                target_name = r_data.get("target_entity")
                rel_type = r_data.get("relationship_type", "RELATED_TO")
                
                source_entity = entity_map.get(source_name)
                target_entity = entity_map.get(target_name)
                
                if source_entity and target_entity:
                    relationship = Relationship(
                        source_entity_id=source_entity.id,
                        target_entity_id=target_entity.id,
                        relationship_type=rel_type,
                        description=r_data.get("description", ""),
                        document_id=source_id
                    )
                    db.add(relationship)
            
            db.commit()
            logger.info(f"[GraphExtractor] Successfully saved graph data for {source_filename}")
            
            # Finally, trigger graph analytics to update PageRank centrality scores
            update_centrality_scores()
            
        except Exception as db_e:
            db.rollback()
            logger.error(f"[GraphExtractor] Database error: {db_e}", exc_info=True)
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"[GraphExtractor] Extraction failed: {e}", exc_info=True)

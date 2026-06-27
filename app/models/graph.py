from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.db import Base, engine

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String(255), primary_key=True)
    filename = Column(String(255))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    relationships = relationship("Relationship", back_populates="document", cascade="all, delete-orphan")

class Entity(Base):
    __tablename__ = "entities"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, index=True)
    entity_type = Column(String(50), index=True)
    description = Column(Text)
    centrality_score = Column(Float, default=0.0, index=True)
    
    outbound_relationships = relationship("Relationship", foreign_keys="[Relationship.source_entity_id]", back_populates="source_entity")
    inbound_relationships = relationship("Relationship", foreign_keys="[Relationship.target_entity_id]", back_populates="target_entity")

class Relationship(Base):
    __tablename__ = "relationships"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_entity_id = Column(Integer, ForeignKey("entities.id"), index=True)
    target_entity_id = Column(Integer, ForeignKey("entities.id"), index=True)
    relationship_type = Column(String(100), index=True)
    description = Column(Text)
    document_id = Column(String(255), ForeignKey("documents.id"), index=True)
    
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], back_populates="outbound_relationships")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], back_populates="inbound_relationships")
    document = relationship("Document", back_populates="relationships")

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

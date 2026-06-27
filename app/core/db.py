import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger("uvicorn")

# Default connection assumes a local MySQL server with these credentials
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/astro_ai")

Base = declarative_base()

try:
    # Try connecting to the specific database
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    # Check connection
    with engine.connect():
        pass
except Exception as e:
    # If the database 'astro_ai' doesn't exist, try connecting to MySQL root to create it
    logger.warning(f"Failed to connect to database 'astro_ai': {e}. Attempting to create it.")
    try:
        base_url = DATABASE_URL.rsplit('/', 1)[0]
        temp_engine = create_engine(base_url, pool_pre_ping=True)
        with temp_engine.connect() as conn:
            conn.execute(text("CREATE DATABASE IF NOT EXISTS astro_ai"))
            conn.commit()
        # Re-create engine with the newly created database
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    except Exception as create_e:
        logger.error(f"Failed to create database 'astro_ai': {create_e}. Please create it manually.")
        # Fallback to an in-memory SQLite database for testing if MySQL fails completely
        logger.warning("Falling back to SQLite in-memory database for Graph RAG.")
        DATABASE_URL = "sqlite:///:memory:"
        engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Import models so Base knows about them before create_all
from app.models.graph import Document, Entity, Relationship
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

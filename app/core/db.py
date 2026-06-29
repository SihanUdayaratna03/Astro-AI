import os
import logging
import threading
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from app.core.security import get_tenant_id

load_dotenv(override=True)
logger = logging.getLogger("uvicorn")

# Default connection assumes a local MySQL server with these credentials
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/astro_ai")
IS_SQLITE = DATABASE_URL.startswith("sqlite")
BASE_DB_URL = "sqlite://" if IS_SQLITE else DATABASE_URL.rsplit('/', 1)[0]
DEFAULT_DB_NAME = DATABASE_URL.rsplit('/', 1)[-1] if not IS_SQLITE else ":memory:"

Base = declarative_base()

def _create_and_init_engine(db_name: str, is_default: bool = False):
    if IS_SQLITE:
        url = DATABASE_URL if is_default else f"sqlite:///{db_name}.db"
        engine = create_engine(url, pool_pre_ping=True, connect_args={"check_same_thread": False})
    else:
        url = f"{BASE_DB_URL}/{db_name}"
        try:
            temp_engine = create_engine(BASE_DB_URL, pool_pre_ping=True)
            with temp_engine.connect() as conn:
                conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name}"))
                conn.commit()
            engine = create_engine(url, pool_pre_ping=True)
        except Exception as e:
            logger.error(f"Failed to create database {db_name}: {e}. Falling back to SQLite.")
            engine = create_engine(f"sqlite:///{db_name}.db", pool_pre_ping=True, connect_args={"check_same_thread": False})
    
    # If not default, we need to create tables immediately since models are already defined
    if not is_default:
        from app.models.graph import Document, Entity, Relationship
        Base.metadata.create_all(bind=engine)
        
    return engine

# Create the default engine immediately for backward compatibility
# (app.models.graph imports this and calls Base.metadata.create_all on it)
engine = _create_and_init_engine(DEFAULT_DB_NAME, is_default=True)

# ── Dynamic Engine Cache ────────────────────────────────────────────────────
_engine_cache = {DEFAULT_DB_NAME: engine}
_engine_lock = threading.Lock()

def get_tenant_engine():
    tenant_id = get_tenant_id()
    if tenant_id == "default":
        return engine
        
    db_name = f"{DEFAULT_DB_NAME}_{tenant_id}"
    
    if db_name not in _engine_cache:
        with _engine_lock:
            if db_name not in _engine_cache:
                _engine_cache[db_name] = _create_and_init_engine(db_name, is_default=False)
    return _engine_cache[db_name]


class TenantAwareSessionMaker:
    """A proxy session maker that returns a session bound to the current tenant's database engine."""
    def __call__(self, **kwargs):
        tenant_engine = get_tenant_engine()
        Session = sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)
        return Session(**kwargs)

# Magically replaces the global SessionLocal with our tenant-aware one!
SessionLocal = TenantAwareSessionMaker()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

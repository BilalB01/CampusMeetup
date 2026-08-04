from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Verbinding met de PostgreSQL-database (draait via Docker, zie docker-compose.yml)
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# FastAPI-dependency: geeft een databasesessie per request en sluit ze nadien altijd af
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

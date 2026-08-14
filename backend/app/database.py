from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Verbinding met de PostgreSQL-database (draait via Docker, zie docker-compose.yml).
# pool_pre_ping test elke connectie uit de pool met een lichte query vóór
# gebruik -- managed Postgres (bv. Railway) sluit inactieve connecties soms
# zelf server-side, wat zonder dit als een onverwachte OperationalError op de
# eerste query van een request zou verschijnen i.p.v. gewoon te herverbinden
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# FastAPI-dependency: geeft een databasesessie per request en sluit ze nadien altijd af
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

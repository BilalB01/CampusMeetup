from pathlib import Path

from app.config import settings

# Absoluut pad, onafhankelijk van vanuit welke map uvicorn gestart wordt —
# .parent.parent van dit bestand is backend/, ongeacht de working directory
UPLOADS_DIR = Path(__file__).resolve().parent.parent / settings.uploads_dir
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

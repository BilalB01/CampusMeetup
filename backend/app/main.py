from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models, schemas
from app.dependencies import get_current_user
from app.routers import auth

app = FastAPI(title="CampusMeetup API")

# Staat de React-frontend (op localhost:5173) toe om de API aan te spreken
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Beveiligde route: enkel bereikbaar met een geldig JWT-token, geeft de ingelogde gebruiker terug
@app.get("/users/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

from fastapi import Depends, HTTPException, WebSocket, WebSocketException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
# Zelfde als hierboven, maar geeft geen 401 als er geen token is — voor
# publieke routes (bv. activiteitendetail) die enkel willen weten wie de
# ingelogde gebruiker is als die er is
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


# Kernlogica van tokenvalidatie, losstaand van hoe het token binnenkomt
# (Authorization-header bij HTTP, querystring bij WebSocket — browsers
# kunnen geen custom headers zetten tijdens de WS-handshake). Geeft None
# terug i.p.v. te raisen, zodat elke aanroeper zijn eigen foutafhandeling
# (HTTPException vs. WebSocketException) kan kiezen
def _decode_user(token: str, db: Session) -> models.User | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.get(models.User, int(user_id))


# FastAPI-dependency die op elke beveiligde route gebruikt wordt om te
# controleren of het meegestuurde JWT-token geldig is, en de bijhorende
# gebruiker op te zoeken in de database
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    user = _decode_user(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kon inloggegevens niet valideren",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Zoals get_current_user, maar geeft None terug i.p.v. een 401 als er geen
# (geldig) token is — gebruikt op publieke routes die optioneel willen
# weten wie de ingelogde gebruiker is
def get_current_user_optional(
    token: str | None = Depends(optional_oauth2_scheme), db: Session = Depends(get_db)
) -> models.User | None:
    if token is None:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None


# WebSocket-variant: token komt als querystring-parameter (?token=...)
# binnen i.p.v. een Authorization-header. FastAPI bindt een niet-pad-
# parameter van een websocket-dependency automatisch aan de querystring,
# net zoals bij een gewone HTTP-route
def get_current_user_ws(
    websocket: WebSocket,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> models.User:
    user = _decode_user(token, db) if token else None
    if user is None:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    return user


# Bovenop get_current_user: laat enkel gebruikers met is_admin=True door naar
# /admin/...-routes. Aparte, samengestelde dependency i.p.v. een losse
# if-check in elke routerfunctie, zodat een vergeten check op een nieuw
# admin-endpoint niet stil kan gebeuren
def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel beheerders hebben hier toegang toe",
        )
    return current_user

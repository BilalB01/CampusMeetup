from fastapi import Depends, HTTPException, status
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


# FastAPI-dependency die op elke beveiligde route gebruikt wordt om te
# controleren of het meegestuurde JWT-token geldig is, en de bijhorende
# gebruiker op te zoeken in de database
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kon inloggegevens niet valideren",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.get(models.User, int(user_id))
    if user is None:
        raise credentials_exception
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

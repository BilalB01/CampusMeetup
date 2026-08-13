from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# Zorgt dat wachtwoorden nooit in platte tekst opgeslagen worden, enkel als bcrypt-hash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# Maakt een JWT-token aan die de gebruiker "ingelogd" houdt zonder serverkant sessies
def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


EMAIL_VERIFICATION_EXPIRE_HOURS = 24


# Eigen, kortlevende tokensoort voor de bevestigingslink in de registratiemail
# -- los van create_access_token() zodat zo'n link nooit ingezet kan worden
# als volwaardig inlogtoken. Het "purpose"-veld voorkomt het omgekeerde: een
# gewoon inlogtoken laten doorgaan voor een geldige bevestigingslink
def create_email_verification_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "purpose": "email_verification", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


# Geeft de user-id terug bij een geldig, niet-verlopen bevestigingstoken met
# het juiste "purpose"-veld; None bij eender welk ander probleem (verlopen,
# vervalst, of een token van een ander doeleinde) -- de aanroeper (routers/
# auth.py) zet dit zelf om naar de juiste HTTP-foutmelding
def verify_email_verification_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("purpose") != "email_verification":
        return None
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None

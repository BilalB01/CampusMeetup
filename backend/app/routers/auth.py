from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.email import send_verification_email
from app.ms_auth import verify_microsoft_id_token
from app.rate_limit import limiter
from app.security import (
    create_access_token,
    create_email_verification_token,
    hash_password,
    verify_email_verification_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# Nieuwe gebruiker aanmaken: controleert op dubbele e-mail, hasht het
# wachtwoord, en verstuurt een bevestigingsmail i.p.v. de gebruiker meteen in
# te loggen -- pas na het aanklikken van die link (GET /auth/verify) kan er
# ingelogd worden, zie login() hieronder. Zonder RESEND_API_KEY (bv. lokale
# ontwikkeling) is er niemand die de link kan versturen, dus wordt het
# account in dat geval meteen als bevestigd aangemaakt. Rate-gelimiteerd
# zoals login(): elke geslaagde aanroep verstuurt nu ook echt een e-mail
@router.post("/register", response_model=schemas.RegisterOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Er bestaat al een account met dit e-mailadres",
        )

    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        auth_provider="password",
        email_verified=not settings.resend_api_key,
    )
    db.add(user)
    # Nog geen commit: user.id is al wel nodig voor het verificatietoken (via
    # flush), maar de rij mag pas definitief bestaan als de mail ook echt
    # verstuurd is -- anders blijft er bij een mislukte verzending een
    # account achter dat nooit bevestigd kan worden (zie send_verification_email)
    db.flush()
    db.refresh(user)

    if settings.resend_api_key:
        token = create_email_verification_token(user.id)
        verify_url = f"{settings.frontend_url}/verifieer?token={token}"
        try:
            send_verification_email(user.email, user.name, verify_url)
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Kon de bevestigingsmail niet versturen. Probeer het straks opnieuw.",
            )
        db.commit()
        return schemas.RegisterOut(
            message="Account aangemaakt. Bevestig je e-mailadres via de link die we je gestuurd hebben."
        )

    db.commit()
    return schemas.RegisterOut(message="Account aangemaakt. Je kan meteen inloggen.")


# Bestaande gebruiker inloggen: controleert e-mail + wachtwoord, geeft bij succes een JWT-token terug
@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, payload: schemas.UserLogin, db: Session = Depends(get_db)):
    # register()/login_with_microsoft() slaan e-mailadressen altijd lowercase
    # op -- zonder dit lowercase()'en hier zou een andere hoofdlettering dan
    # bij het registreren (bv. auto-capitalize op mobiel) ten onrechte als
    # "onbestaand account" afgewezen worden
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldig e-mailadres of wachtwoord",
        )
    if user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dit account gebruikt Microsoft om in te loggen — gebruik de Microsoft-knop",
        )
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldig e-mailadres of wachtwoord",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bevestig eerst je e-mailadres via de link die we je gestuurd hebben",
        )

    token = create_access_token(subject=str(user.id))
    return schemas.Token(access_token=token, user=user)


# Bevestigingslink uit de registratiemail -- geeft bij succes meteen een
# volwaardig inlogtoken terug, zodat de gebruiker na het klikken niet ook nog
# apart moet inloggen. Het token zelf blijft 1u geldig (zie
# EMAIL_VERIFICATION_EXPIRE_HOURS), maar mag maar één keer een sessie
# opleveren: is het account al bevestigd, dan wordt user.email_verified zelf
# als "al gebruikt"-vlag ingezet i.p.v. nog een inlogtoken uit te delen --
# anders zou een gelekte/doorgestuurde link binnen dat venster een geldig
# inlogmiddel blijven, zonder wachtwoord nodig. Bewust een POST (zie
# schemas.EmailVerifyRequest) i.p.v. een GET met ?token=...: de /verifieer-
# pagina zelf doet deze aanroep via JavaScript, dus een kale link-preview/
# scanner die enkel de pagina ophaalt (geen JS uitvoert) verbruikt de link
# niet stilzwijgend vóór de echte gebruiker klikt
@router.post("/verify", response_model=schemas.Token)
def verify_email(payload: schemas.EmailVerifyRequest, db: Session = Depends(get_db)):
    user_id = verify_email_verification_token(payload.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deze bevestigingslink is ongeldig of verlopen",
        )
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")

    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dit e-mailadres is al bevestigd. Log in via de normale weg.",
        )

    user.email_verified = True
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=str(user.id))
    return schemas.Token(access_token=access_token, user=user)


# Inloggen met een Microsoft-account (EHB-studenten). Het ID-token komt van
# MSAL in de browser, hier wordt het server-side geverifieerd (handtekening +
# audience) vóór het vertrouwd wordt. Zelfde e-mailadres als een bestaand
# wachtwoord-account logt gewoon in op dat account — geen dubbele accounts
@router.post("/microsoft", response_model=schemas.Token)
def login_with_microsoft(payload: schemas.MicrosoftLogin, db: Session = Depends(get_db)):
    if not settings.microsoft_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Microsoft-login is nog niet geconfigureerd",
        )

    try:
        claims = verify_microsoft_id_token(payload.id_token, settings.microsoft_client_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ongeldig Microsoft-token")

    email = (claims.get("preferred_username") or claims.get("email") or "").lower()
    if not email.endswith("@student.ehb.be"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel toegankelijk met een @student.ehb.be-account",
        )

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        user = models.User(
            name=claims.get("name", email),
            email=email,
            hashed_password=None,
            auth_provider="microsoft",
            # Dit e-mailadres komt al geverifieerd uit het Microsoft-token
            # (zie verify_microsoft_id_token hierboven) -- geen aparte
            # bevestigingsmail nodig zoals bij een wachtwoord-account
            email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=str(user.id))
    return schemas.Token(access_token=token, user=user)

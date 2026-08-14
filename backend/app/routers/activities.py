from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional
from app.email import send_activity_share_email
from app.notifications import create_notification
from app.rate_limit import limiter

router = APIRouter(prefix="/activities", tags=["activities"])


# Zet een Activity-rij + berekende velden (aantal deelnemers, is_joined,
# deelnemerslijst) om naar het detail-response-schema. Wordt hergebruikt
# door alle endpoints die de volledige activiteit teruggeven.
def _to_detail(
    activity: models.Activity, db: Session, current_user: models.User | None
) -> schemas.ActivityDetailOut:
    participant_count = (
        db.query(func.count(models.Participation.id))
        .filter(models.Participation.activity_id == activity.id)
        .scalar()
    )
    is_joined = False
    if current_user is not None:
        is_joined = (
            db.query(models.Participation)
            .filter_by(activity_id=activity.id, user_id=current_user.id)
            .first()
            is not None
        )
    # Niet-ingelogde bezoekers mogen wel rondkijken (titel/locatie/tijdstip),
    # maar krijgen geen namen te zien -- via het vaste schoolmailformaat
    # (voornaam.achternaam@student.ehb.be) is een naam meteen om te zetten
    # naar een echt adres, dus namen blijven voorbehouden aan wie zelf
    # ingelogd is
    if current_user is None:
        organizer = schemas.ParticipantOut(id=activity.organizer_id, name="Organisator")
        participants: list[schemas.ParticipantOut] = []
    else:
        organizer = schemas.ParticipantOut.model_validate(activity.organizer)
        participants = [
            schemas.ParticipantOut.model_validate(p.user) for p in activity.participations
        ]
    return schemas.ActivityDetailOut(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        location_name=activity.location_name,
        latitude=activity.latitude,
        longitude=activity.longitude,
        start_time=activity.start_time,
        max_participants=activity.max_participants,
        category=activity.category,
        created_at=activity.created_at,
        organizer=organizer,
        participant_count=participant_count,
        is_joined=is_joined,
        participants=participants,
    )


# Nieuwe activiteit aanmaken — de ingelogde gebruiker wordt organisator én
# meteen ook deelnemer (telt dus mee in "1 / 10 deelnemers")
@router.post("", response_model=schemas.ActivityDetailOut, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_not_admin(current_user, "Beheerders kunnen geen activiteiten organiseren")
    activity = models.Activity(
        title=payload.title,
        description=payload.description,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        start_time=payload.start_time,
        max_participants=payload.max_participants,
        category=payload.category.value,
        organizer_id=current_user.id,
    )
    db.add(activity)
    db.flush()  # activity.id is nodig voor de Participation hieronder

    db.add(models.Participation(user_id=current_user.id, activity_id=activity.id))
    db.commit()
    db.refresh(activity)
    return _to_detail(activity, db, current_user)


# Zet een Activity-rij + het berekende deelnemersaantal om naar
# ActivityListItem — gedeeld tussen list_activities hieronder en
# GET /users/me/activities (main.py, waar participants_preview altijd leeg
# blijft — dat scherm toont geen avatar-stapel)
def activity_to_list_item(
    activity: models.Activity,
    participant_count: int,
    participants_preview: list[models.User] | None = None,
) -> schemas.ActivityListItem:
    return schemas.ActivityListItem(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        location_name=activity.location_name,
        latitude=activity.latitude,
        longitude=activity.longitude,
        start_time=activity.start_time,
        max_participants=activity.max_participants,
        category=activity.category,
        participant_count=participant_count,
        created_at=activity.created_at,
        participants_preview=[
            schemas.ParticipantOut.model_validate(u) for u in (participants_preview or [])
        ],
    )


# Georganiseerde en elders-deelgenomen activiteiten van één gebruiker,
# elk als (Activity, participant_count)-rijen -- gedeeld tussen
# GET /users/me/activities (main.py) en GET /admin/users/{id} (admin.py),
# die verder enkel verschillen in welke user_id ze doorgeven
def _organized_and_joined_rows(db: Session, user_id: int):
    organized_rows = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.organizer_id == user_id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time)
        .all()
    )
    # Activiteit-id's waaraan de gebruiker deelneemt — bevat ook de eigen
    # activiteiten (organisator wordt bij aanmaken automatisch ook
    # deelnemer). De organizer_id-filter hieronder sluit die overlap uit,
    # zodat "deelgenomen" nooit dezelfde activiteit toont als "georganiseerd"
    joined_activity_ids = (
        db.query(models.Participation.activity_id).filter(models.Participation.user_id == user_id).subquery()
    )
    joined_rows = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.id.in_(joined_activity_ids))
        .filter(models.Activity.organizer_id != user_id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time)
        .all()
    )
    return organized_rows, joined_rows


# Haalt in bulk de eerste 3 deelnemers per activiteit op (voor de
# avatar-stapel op de kaarten) — één aparte query i.p.v. deze in de
# count-query hierboven te combineren: een joinedload zou daar de
# group_by-aggregatie verstoren
def _participants_preview_by_activity(
    db: Session, activity_ids: list[int], limit: int = 3
) -> dict[int, list[models.User]]:
    if not activity_ids:
        return {}
    participations = (
        db.query(models.Participation)
        .options(joinedload(models.Participation.user))
        .filter(models.Participation.activity_id.in_(activity_ids))
        .order_by(models.Participation.joined_at)
        .all()
    )
    preview_by_activity: dict[int, list[models.User]] = {}
    for p in participations:
        bucket = preview_by_activity.setdefault(p.activity_id, [])
        if len(bucket) < limit:
            bucket.append(p.user)
    return preview_by_activity


# Lijst van activiteiten, eventueel gefilterd op categorie — publiek
# toegankelijk zodat niet-ingelogde bezoekers ook kunnen rondkijken.
# Activiteiten die al meer dan een uur bezig zijn, vallen hier bewust weg
# (Ontdek/Start/categorieën/kaart) — de activiteit zelf blijft gewoon
# bestaan (detailpagina, groepschat, profielgeschiedenis blijven werken),
# ze wordt enkel niet meer opgelijst als "iets om aan deel te nemen"
@router.get("", response_model=list[schemas.ActivityListItem])
def list_activities(
    category: schemas.ActivityCategory | None = None,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    verlopen_grens = datetime.now(timezone.utc) - timedelta(hours=1)
    query = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.start_time >= verlopen_grens)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time)
    )
    if category is not None:
        query = query.filter(models.Activity.category == category.value)

    rows = query.all()
    # Namen in de avatar-stapel zijn -- net als bij _to_detail hierboven --
    # voorbehouden aan ingelogde bezoekers
    preview_by_activity = (
        _participants_preview_by_activity(db, [a.id for a, _ in rows])
        if current_user is not None
        else {}
    )

    return [
        activity_to_list_item(activity, participant_count, preview_by_activity.get(activity.id))
        for activity, participant_count in rows
    ]


# Detail van één activiteit — publiek toegankelijk; is_joined staat enkel
# op True als er een geldig token werd meegestuurd én die gebruiker al
# deelneemt
@router.get("/{activity_id}", response_model=schemas.ActivityDetailOut)
def get_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )
    return _to_detail(activity, db, current_user)


# Geen einduur/duur opgeslagen op Activity -- 2u is een redelijke standaard-
# inschatting voor een meetup, zowel hier als in de "Google Agenda"-link
# (frontend/src/utils/calendar.js), zodat beide dezelfde aanname volgen
ICS_STANDAARD_DUUR = timedelta(hours=2)


def _naar_ics_datum(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _ics_escape(tekst: str) -> str:
    return tekst.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


# Publiek net als het detail hierboven -- toont dezelfde gegevens, enkel als
# .ics-bestand i.p.v. JSON, zodat de gebruiker de activiteit in zijn eigen
# agenda-app (Google/Outlook/Apple) kan zetten
@router.get("/{activity_id}/ics")
def get_activity_ics(activity_id: int, db: Session = Depends(get_db)):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )

    regels = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CampusMeetup//NL",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:activiteit-{activity.id}@campusmeetup.ehb",
        f"DTSTAMP:{_naar_ics_datum(datetime.now(timezone.utc))}",
        f"DTSTART:{_naar_ics_datum(activity.start_time)}",
        f"DTEND:{_naar_ics_datum(activity.start_time + ICS_STANDAARD_DUUR)}",
        f"SUMMARY:{_ics_escape(activity.title)}",
        f"LOCATION:{_ics_escape(activity.location_name)}",
    ]
    if activity.description:
        regels.append(f"DESCRIPTION:{_ics_escape(activity.description)}")
    regels += ["END:VEVENT", "END:VCALENDAR"]

    return Response(
        content="\r\n".join(regels) + "\r\n",
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="activiteit-{activity.id}.ics"'},
    )


# Controleert dat de ingelogde gebruiker geen beheerder is — beheerders
# organiseren/nemen niet deel aan activiteiten (zie ook Sidebar.jsx/
# Profiel.jsx aan de frontend-kant). Hergebruikt door create/join/leave
def _ensure_not_admin(current_user: models.User, detail: str) -> None:
    if current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


# Controleert dat de ingelogde gebruiker de organisator is — hergebruikt
# door zowel bewerken als verwijderen
def _ensure_organizer(activity: models.Activity, current_user: models.User) -> None:
    if activity.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel de organisator kan deze activiteit bewerken of verwijderen",
        )


# Deelnemers van een activiteit, de organisator zelf uitgesloten — gebruikt
# om te bepalen wie een melding krijgt bij bewerken/verwijderen. Geeft User-
# rijen terug (niet Participation) zodat ze ook na het verwijderen van de
# activiteit (en dus de bijhorende Participation-rijen, via cascade) nog
# geldig blijven om te gebruiken
def _andere_deelnemers(db: Session, activity_id: int, exclude_user_id: int) -> list[models.User]:
    return (
        db.query(models.User)
        .join(models.Participation, models.Participation.user_id == models.User.id)
        .filter(models.Participation.activity_id == activity_id)
        .filter(models.User.id != exclude_user_id)
        .all()
    )


# PUT i.p.v. PATCH: het bewerkformulier stuurt altijd alle velden mee
# (zelfde payload-vorm als aanmaken), maar met schemas.ActivityUpdate i.p.v.
# ActivityCreate -- zie de comment daar voor waarom dat een apart schema is
@router.put("/{activity_id}", response_model=schemas.ActivityDetailOut)
def update_activity(
    activity_id: int,
    payload: schemas.ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )
    _ensure_organizer(activity, current_user)

    activity.title = payload.title
    activity.description = payload.description
    activity.location_name = payload.location_name
    activity.latitude = payload.latitude
    activity.longitude = payload.longitude
    activity.start_time = payload.start_time
    activity.max_participants = payload.max_participants
    activity.category = payload.category.value

    db.commit()
    db.refresh(activity)

    for deelnemer in _andere_deelnemers(db, activity.id, current_user.id):
        create_notification(
            db,
            deelnemer,
            "activiteit_bijgewerkt",
            f'"{activity.title}" is bijgewerkt.',
            activity.id,
            deelnemer.notify_activity_updates,
        )

    return _to_detail(activity, db, current_user)


# Activiteit verwijderen — de cascade op Activity.participations/messages
# in models.py ruimt de bijhorende deelnames en chatberichten automatisch mee op
@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )
    _ensure_organizer(activity, current_user)

    # Vóór het verwijderen opvragen: Participation-rijen verdwijnen mee via
    # de cascade hierboven, dus na het verwijderen is er niets meer om op
    # te filteren. De activity_id in de melding zelf wordt bewust None
    # (de activiteit bestaat straks niet meer om naartoe te linken)
    deelnemers = _andere_deelnemers(db, activity.id, current_user.id)
    titel = activity.title

    db.delete(activity)
    db.commit()

    for deelnemer in deelnemers:
        create_notification(
            db,
            deelnemer,
            "activiteit_verwijderd",
            f'"{titel}" is geannuleerd.',
            None,
            deelnemer.notify_activity_updates,
        )


# Aansluiten bij een activiteit — weigert bij dubbele deelname of een
# volzette activiteit
@router.post("/{activity_id}/join", response_model=schemas.ActivityDetailOut)
def join_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_not_admin(current_user, "Beheerders kunnen niet deelnemen aan activiteiten")
    # with_for_update: vergrendelt deze activiteitsrij voor de duur van de
    # transactie, zodat twee gelijktijdige aanvragen op de laatste vrije plek
    # elkaar niet allebei via de participant_count-check hieronder kunnen
    # glippen -- de tweede wacht op de eerste en ziet dan de bijgewerkte
    # telling (zelfde bescherming als de IntegrityError-vangnet verderop,
    # maar dan voor de capaciteitscheck i.p.v. de dubbele-deelname-check)
    activity = db.get(models.Activity, activity_id, with_for_update=True)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )

    already_joined = (
        db.query(models.Participation)
        .filter_by(activity_id=activity_id, user_id=current_user.id)
        .first()
    )
    if already_joined:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Je neemt al deel aan deze activiteit",
        )

    participant_count = (
        db.query(func.count(models.Participation.id))
        .filter(models.Participation.activity_id == activity_id)
        .scalar()
    )
    if participant_count >= activity.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Deze activiteit zit vol"
        )

    participation = models.Participation(user_id=current_user.id, activity_id=activity_id)
    db.add(participation)
    try:
        db.commit()
    except IntegrityError:
        # Vangnet voor de zeldzame race condition waarbij twee identieke
        # aanvragen (bv. een dubbelklik) tegelijk langs de check hierboven
        # glippen — de UniqueConstraint in de database geeft dan een nette
        # 400 in plaats van een kale 500-fout
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Je neemt al deel aan deze activiteit",
        )

    db.refresh(activity)

    create_notification(
        db,
        activity.organizer,
        "nieuwe_deelnemer",
        f'{current_user.name} is aangesloten bij "{activity.title}"',
        activity.id,
        activity.organizer.notify_new_participant,
    )

    return _to_detail(activity, db, current_user)


# Afmelden voor een activiteit
@router.delete("/{activity_id}/join", response_model=schemas.ActivityDetailOut)
def leave_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_not_admin(current_user, "Beheerders kunnen niet deelnemen aan activiteiten")
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )

    participation = (
        db.query(models.Participation)
        .filter_by(activity_id=activity_id, user_id=current_user.id)
        .first()
    )
    if participation is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Je neemt niet deel aan deze activiteit",
        )

    db.delete(participation)
    db.commit()
    db.refresh(activity)
    return _to_detail(activity, db, current_user)


# Activiteit delen via e-mail — enkel voor ingelogde gebruikers, naar een
# willekeurig e-mailadres (de ontvanger hoeft geen account te hebben, het
# detailscherm is publiek toegankelijk). Geen best-effort: de gebruiker
# vraagt hier expliciet om te versturen en moet weten of dat gelukt is
@router.post("/{activity_id}/share", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/hour")
def share_activity(
    request: Request,
    activity_id: int,
    payload: schemas.ActivityShare,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )

    try:
        send_activity_share_email(
            to_email=payload.email,
            sender_name=current_user.name,
            message=payload.message or "Kom erbij!",
            activity_title=activity.title,
            activity_category=activity.category,
            activity_location=activity.location_name,
            activity_start=activity.start_time,
            activity_url=f"{settings.frontend_url}/activiteiten/{activity.id}",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Kon de uitnodiging niet versturen. Probeer het later opnieuw.",
        )

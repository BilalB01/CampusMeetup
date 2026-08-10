import truststore

# Gebruikt de Windows-certificaatwinkel voor TLS-verificatie i.p.v. certifi
truststore.inject_into_ssl()

from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.notifications import create_notification
from app.routers import activities, auth, chat
from app.security import hash_password, verify_password
from app.uploads import UPLOADS_DIR

# Hoe ver vooruit een activiteit een herinnering triggert (zie
# read_my_notifications hieronder)
REMINDER_WINDOW = timedelta(minutes=60)

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
app.include_router(activities.router)
app.include_router(chat.router)

# Geuploade chatafbeeldingen terug uitserveren onder /uploads/<bestand>
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Publiek (geen login nodig) — gebruikt op het login/registreerscherm, dat je
# per definitie nog niet ingelogd bekijkt
@app.get("/stats", response_model=schemas.PlatformStatsOut)
def read_platform_stats(db: Session = Depends(get_db)):
    student_count = db.query(func.count(models.User.id)).scalar()

    nu = datetime.now(timezone.utc)
    over_zeven_dagen = nu + timedelta(days=7)
    activities_this_week = (
        db.query(func.count(models.Activity.id))
        .filter(models.Activity.start_time >= nu, models.Activity.start_time <= over_zeven_dagen)
        .scalar()
    )

    return schemas.PlatformStatsOut(
        student_count=student_count, activities_this_week=activities_this_week
    )


# Beveiligde route: enkel bereikbaar met een geldig JWT-token, geeft de ingelogde gebruiker terug
@app.get("/users/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


# Naam bewerken op het Instellingen-scherm
@app.patch("/users/me", response_model=schemas.UserOut)
def update_current_user(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.name = payload.name
    db.commit()
    db.refresh(current_user)
    return current_user


# Wachtwoord wijzigen — niet van toepassing op Microsoft-accounts (geen
# hashed_password om tegen te verifiëren, zie ook login() in routers/auth.py
# voor dezelfde check bij het gewone inloggen)
@app.put("/users/me/password")
def change_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dit account gebruikt Microsoft om in te loggen — wachtwoord kan hier niet gewijzigd worden",
        )
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Huidig wachtwoord is onjuist")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"status": "ok"}


# Account verwijderen: eerst eigen berichten/deelnames (overal, ongeacht wie
# organiseert), dan de eigen georganiseerde activiteiten via ORM db.delete()
# per activiteit (zodat de bestaande cascade op Activity.participations/
# messages ook deelnames/berichten van ANDERE gebruikers in die activiteiten
# meeneemt), pas dan de gebruiker zelf — anders blokkeren de foreign keys
@app.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Message).filter(models.Message.user_id == current_user.id).delete()
    db.query(models.Participation).filter(models.Participation.user_id == current_user.id).delete()
    for activiteit in db.query(models.Activity).filter(models.Activity.organizer_id == current_user.id):
        db.delete(activiteit)
    db.delete(current_user)
    db.commit()


# Activiteiten van de ingelogde gebruiker voor het profielscherm, opgesplitst
# in "georganiseerd" en "deelgenomen (elders)". Bewust onder /users/me/...
# i.p.v. /activities/...: een pad zoals /activities/mine zou vóór
# /activities/{activity_id} geregistreerd moeten staan (anders vangt
# {activity_id} de string "mine" op en faalt de int-conversie met een
# verwarrende 422) — in dit padnamespace speelt die volgorde-valkuil niet
@app.get("/users/me/activities", response_model=schemas.MyActivitiesOut)
def read_my_activities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Georganiseerd: zelfde outerjoin+count+group_by-opbouw als GET
    # /activities, enkel met een extra filter op organizer_id
    organized_rows = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.organizer_id == current_user.id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time)
        .all()
    )

    # Activiteit-id's waaraan de gebruiker deelneemt — bevat ook de eigen
    # activiteiten (organisator wordt bij aanmaken automatisch ook
    # deelnemer). De organizer_id-filter hieronder sluit die overlap uit,
    # zodat "deelgenomen" nooit dezelfde activiteit toont als "georganiseerd"
    joined_activity_ids = (
        db.query(models.Participation.activity_id)
        .filter(models.Participation.user_id == current_user.id)
        .subquery()
    )
    joined_rows = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.id.in_(joined_activity_ids))
        .filter(models.Activity.organizer_id != current_user.id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time)
        .all()
    )

    all_ids = [a.id for a, _ in organized_rows] + [a.id for a, _ in joined_rows]
    preview_by_activity = activities._participants_preview_by_activity(db, all_ids)

    return schemas.MyActivitiesOut(
        organized=[
            activities.activity_to_list_item(a, c, preview_by_activity.get(a.id)) for a, c in organized_rows
        ],
        joined=[activities.activity_to_list_item(a, c, preview_by_activity.get(a.id)) for a, c in joined_rows],
    )


# Badges voor het profielscherm — de definities liggen vast in code,
# "earned" wordt hier telkens live berekend uit de echte tellingen,
# geen aparte databasetabel of achtergrondjob nodig
@app.get("/users/me/badges", response_model=list[schemas.BadgeOut])
def read_my_badges(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    organized_count = (
        db.query(func.count(models.Activity.id))
        .filter(models.Activity.organizer_id == current_user.id)
        .scalar()
    )

    # "Deelgenomen aan andermans activiteit" — zelfde organizer_id-uitsluiting
    # als in read_my_activities hierboven, voor dezelfde reden
    joined_elsewhere_count = (
        db.query(func.count(models.Participation.id))
        .join(models.Activity, models.Activity.id == models.Participation.activity_id)
        .filter(models.Participation.user_id == current_user.id)
        .filter(models.Activity.organizer_id != current_user.id)
        .scalar()
    )

    message_count = (
        db.query(func.count(models.Message.id))
        .filter(models.Message.user_id == current_user.id)
        .scalar()
    )

    organized_categories = db.query(models.Activity.category).filter(
        models.Activity.organizer_id == current_user.id
    )
    joined_categories = (
        db.query(models.Activity.category)
        .join(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Participation.user_id == current_user.id)
    )
    distinct_categories = {c for (c,) in organized_categories.union(joined_categories).all()}

    definities = [
        ("eerste_organisatie", "Eerste activiteit", "Je hebt je eerste activiteit georganiseerd", "🎉", organized_count >= 1),
        ("drukbezet_organisator", "Drukbezet organisator", "5 activiteiten georganiseerd", "🗓️", organized_count >= 5),
        ("nieuwsgierig", "Nieuwsgierig", "Deelgenomen aan andermans activiteit", "👋", joined_elsewhere_count >= 1),
        ("sociale_vlinder", "Sociale vlinder", "5 keer deelgenomen aan andermans activiteiten", "🦋", joined_elsewhere_count >= 5),
        ("prater", "Prater", "10 chatberichten verstuurd", "💬", message_count >= 10),
        ("alleskunner", "Alleskunner", "Actief in alle 6 categorieën", "🌟", len(distinct_categories) >= 6),
    ]
    return [
        schemas.BadgeOut(key=k, label=l, description=d, icon=i, earned=e)
        for k, l, d, i, e in definities
    ]


# Chatoverzicht voor het profielscherm: alle groepschats waar de gebruiker
# aan deelneemt, met laatste bericht + ongelezen-teller. Bulkqueries + verwerking
# in Python, zelfde aanpak als read_my_activities/read_my_badges hierboven
@app.get("/users/me/conversations", response_model=list[schemas.ConversationOut])
def read_my_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    participations = (
        db.query(models.Participation)
        .filter(models.Participation.user_id == current_user.id)
        .all()
    )
    if not participations:
        return []
    activity_ids = [p.activity_id for p in participations]
    participation_by_activity = {p.activity_id: p for p in participations}

    activities_by_id = {
        a.id: a
        for a in db.query(models.Activity).filter(models.Activity.id.in_(activity_ids)).all()
    }
    messages = (
        db.query(models.Message)
        .options(joinedload(models.Message.user))
        .filter(models.Message.activity_id.in_(activity_ids))
        .order_by(models.Message.created_at.desc())
        .all()
    )

    last_message_by_activity: dict[int, models.Message] = {}
    unread_by_activity: dict[int, int] = {aid: 0 for aid in activity_ids}
    for m in messages:
        last_message_by_activity.setdefault(m.activity_id, m)
        participation = participation_by_activity[m.activity_id]
        is_unread = m.user_id != current_user.id and (
            participation.last_read_at is None or m.created_at > participation.last_read_at
        )
        if is_unread:
            unread_by_activity[m.activity_id] += 1

    def preview(m: models.Message | None) -> str | None:
        if m is None:
            return None
        tekst = "📷 Afbeelding" if m.image_url else m.content
        return f"Jij: {tekst}" if m.user_id == current_user.id else tekst

    result = [
        schemas.ConversationOut(
            activity_id=aid,
            title=activities_by_id[aid].title,
            category=activities_by_id[aid].category,
            last_message=preview(last_message_by_activity.get(aid)),
            last_message_at=(
                last_message_by_activity[aid].created_at
                if aid in last_message_by_activity
                else participation_by_activity[aid].joined_at
            ),
            unread_count=unread_by_activity[aid],
        )
        for aid in activity_ids
    ]
    result.sort(key=lambda c: c.last_message_at, reverse=True)
    return result


# "Lazy" berekend i.p.v. via een achtergrondtaak (die bestaat niet in dit
# project): maakt een herinnering aan voor elke activiteit van de gebruiker
# die binnen REMINDER_WINDOW start en nog geen herinnering heeft
def _ensure_reminder_notifications(db: Session, current_user: models.User) -> None:
    if not current_user.notify_reminder:
        return
    nu = datetime.now(timezone.utc)
    binnenkort = nu + REMINDER_WINDOW
    activiteiten = (
        db.query(models.Activity)
        .join(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Participation.user_id == current_user.id)
        .filter(models.Activity.start_time > nu, models.Activity.start_time <= binnenkort)
        .all()
    )
    for activiteit in activiteiten:
        bestaat_al = (
            db.query(models.Notification)
            .filter_by(user_id=current_user.id, activity_id=activiteit.id, type="herinnering")
            .first()
        )
        if bestaat_al:
            continue
        create_notification(
            db,
            current_user,
            "herinnering",
            f'Herinnering: "{activiteit.title}" begint binnen het uur.',
            activiteit.id,
            True,
        )


@app.get("/users/me/notifications", response_model=list[schemas.NotificationOut])
def read_my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_reminder_notifications(db, current_user)
    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )
    return [
        schemas.NotificationOut(
            id=n.id,
            type=n.type,
            text=n.text,
            activity_id=n.activity_id,
            read=n.read_at is not None,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@app.put("/users/me/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = db.get(models.Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Melding niet gevonden")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dit is niet jouw melding")

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)

    return schemas.NotificationOut(
        id=notification.id,
        type=notification.type,
        text=notification.text,
        activity_id=notification.activity_id,
        read=True,
        created_at=notification.created_at,
    )


@app.put("/users/me/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.read_at.is_(None),
    ).update({"read_at": datetime.now(timezone.utc)})
    db.commit()
    return {"status": "ok"}


@app.put("/users/me/notification-preferences", response_model=schemas.UserOut)
def update_notification_preferences(
    payload: schemas.NotificationPreferences,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.notify_new_participant = payload.notify_new_participant
    current_user.notify_chat_messages = payload.notify_chat_messages
    current_user.notify_reminder = payload.notify_reminder
    db.commit()
    db.refresh(current_user)
    return current_user

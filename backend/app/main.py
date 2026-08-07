from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.routers import activities, auth, chat
from app.uploads import UPLOADS_DIR

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


# Beveiligde route: enkel bereikbaar met een geldig JWT-token, geeft de ingelogde gebruiker terug
@app.get("/users/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


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

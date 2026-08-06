from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional

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
        organizer=schemas.ParticipantOut.model_validate(activity.organizer),
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
# GET /users/me/activities (main.py)
def activity_to_list_item(activity: models.Activity, participant_count: int) -> schemas.ActivityListItem:
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
    )


# Lijst van activiteiten, eventueel gefilterd op categorie — publiek
# toegankelijk zodat niet-ingelogde bezoekers ook kunnen rondkijken
@router.get("", response_model=list[schemas.ActivityListItem])
def list_activities(
    category: schemas.ActivityCategory | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time)
    )
    if category is not None:
        query = query.filter(models.Activity.category == category.value)

    return [activity_to_list_item(activity, participant_count) for activity, participant_count in query.all()]


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


# Controleert dat de ingelogde gebruiker de organisator is — hergebruikt
# door zowel bewerken als verwijderen
def _ensure_organizer(activity: models.Activity, current_user: models.User) -> None:
    if activity.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel de organisator kan deze activiteit bewerken of verwijderen",
        )


# PUT i.p.v. PATCH: het bewerkformulier stuurt altijd alle velden mee
# (zelfde payload-vorm als aanmaken), dus hergebruikt gewoon
# schemas.ActivityCreate i.p.v. een apart partial-update-schema
@router.put("/{activity_id}", response_model=schemas.ActivityDetailOut)
def update_activity(
    activity_id: int,
    payload: schemas.ActivityCreate,
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

    db.delete(activity)
    db.commit()


# Aansluiten bij een activiteit — weigert bij dubbele deelname of een
# volzette activiteit
@router.post("/{activity_id}/join", response_model=schemas.ActivityDetailOut)
def join_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.get(models.Activity, activity_id)
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
    return _to_detail(activity, db, current_user)


# Afmelden voor een activiteit
@router.delete("/{activity_id}/join", response_model=schemas.ActivityDetailOut)
def leave_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
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

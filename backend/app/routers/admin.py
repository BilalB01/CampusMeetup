from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_admin
from app.notifications import create_notification
from app.routers.activities import _participants_preview_by_activity, activity_to_list_item

router = APIRouter(prefix="/admin", tags=["admin"])


# Alle gebruikers, alfabetisch op naam -- enkel voor beheerders (get_current_admin)
@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    return db.query(models.User).order_by(models.User.name).all()


# Detail van één gebruiker + zijn/haar activiteiten (georganiseerd/
# deelgenomen), voor het klikbare gebruikerskaartje op AdminGebruikers.jsx --
# zelfde opbouw als GET /users/me/activities in main.py, maar dan op een
# willekeurige target i.p.v. de ingelogde gebruiker zelf
@router.get("/users/{user_id}", response_model=schemas.AdminUserDetailOut)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    target = db.get(models.User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")

    organized_rows = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.organizer_id == target.id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time.desc())
        .all()
    )
    joined_activity_ids = (
        db.query(models.Participation.activity_id).filter(models.Participation.user_id == target.id).subquery()
    )
    joined_rows = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .filter(models.Activity.id.in_(joined_activity_ids))
        .filter(models.Activity.organizer_id != target.id)
        .group_by(models.Activity.id)
        .order_by(models.Activity.start_time.desc())
        .all()
    )

    all_ids = [a.id for a, _ in organized_rows] + [a.id for a, _ in joined_rows]
    preview_by_activity = _participants_preview_by_activity(db, all_ids)

    return schemas.AdminUserDetailOut(
        **schemas.UserOut.model_validate(target).model_dump(),
        organized=[activity_to_list_item(a, c, preview_by_activity.get(a.id)) for a, c in organized_rows],
        joined=[activity_to_list_item(a, c, preview_by_activity.get(a.id)) for a, c in joined_rows],
    )


# Gebruiker permanent verwijderen -- zelfde volgorde als delete_current_user
# in main.py (berichten -> deelnames -> eigen activiteiten via db.delete()
# per activiteit voor de cascade -> user zelf), geparametriseerd op een
# willekeurige target i.p.v. de ingelogde gebruiker. Een beheerder mag
# zichzelf hier niet via verwijderen -- daarvoor bestaat al DELETE /users/me
# op het eigen account (anders kan een beheerder zichzelf per ongeluk
# buitensluiten)
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Je kan jezelf hier niet verwijderen -- gebruik daarvoor je eigen accountinstellingen",
        )
    target = db.get(models.User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")

    db.query(models.Message).filter(models.Message.user_id == target.id).delete()
    db.query(models.Participation).filter(models.Participation.user_id == target.id).delete()
    for activiteit in db.query(models.Activity).filter(models.Activity.organizer_id == target.id):
        db.delete(activiteit)
    db.delete(target)
    db.commit()


# Alle activiteiten, eventueel gefilterd op categorie -- bewust GEEN
# "verlopen (>1u)"-filter zoals in GET /activities: een beheerder moet ook
# oude activiteiten terugvinden om ze eventueel op te ruimen
@router.get("/activities", response_model=list[schemas.ActivityListItem])
def list_all_activities(
    category: schemas.ActivityCategory | None = None,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    query = (
        db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
        .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
        .group_by(models.Activity.id)
        # Oplopend i.p.v. aflopend: op datum gesorteerd betekent hier
        # chronologisch (eerstkomende/oudste eerst), niet "nieuwst toegevoegd"
        .order_by(models.Activity.start_time)
    )
    if category is not None:
        query = query.filter(models.Activity.category == category.value)

    rows = query.all()
    return [activity_to_list_item(activity, participant_count) for activity, participant_count in rows]


# Alle deelnemers van een activiteit, organisator inbegrepen -- i.t.t.
# _andere_deelnemers in activities.py sluiten we hier niemand uit: de
# beheerder zelf neemt normaal niet deel, dus moet ook de organisator zelf
# een melding krijgen dat zijn activiteit weg is
def _alle_deelnemers(db: Session, activity_id: int) -> list[models.User]:
    return (
        db.query(models.User)
        .join(models.Participation, models.Participation.user_id == models.User.id)
        .filter(models.Participation.activity_id == activity_id)
        .all()
    )


# Activiteit permanent verwijderen door een beheerder -- zelfde cascade als
# de organisator-variant (delete_activity in activities.py), maar iedereen
# (ook de organisator) krijgt een melding met andere bewoording, zodat
# niemand denkt dat de organisator dit zelf annuleerde
@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_any_activity(
    activity_id: int,
    payload: schemas.AdminActivityDelete,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden")

    deelnemers = _alle_deelnemers(db, activity.id)
    titel = activity.title

    db.delete(activity)
    db.commit()

    for deelnemer in deelnemers:
        create_notification(
            db,
            deelnemer,
            # "_admin" i.p.v. "_beheerder": notifications.type is String(30) in
            # de database, en "activiteit_verwijderd_beheerder" (31 tekens)
            # past daar net niet in
            "activiteit_verwijderd_admin",
            f'"{titel}" is door een beheerder verwijderd. Reden: {payload.reason}',
            None,
            deelnemer.notify_activity_updates,
        )

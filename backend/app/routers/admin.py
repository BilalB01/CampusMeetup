from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_admin
from app.notifications import create_notification
from app.routers.activities import _organized_and_joined_rows, _participants_preview_by_activity, activity_to_list_item

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

    organized_rows, joined_rows = _organized_and_joined_rows(db, target.id)

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
# willekeurige target i.p.v. de ingelogde gebruiker. Expliciete check op
# zichzelf nodig: deze route checkt bij het verwijderen zelf niet of
# target.is_admin is (een beheerder kan hiermee dus wel een ándere
# beheerder verwijderen), dus zonder deze check zou een beheerder zichzelf
# hier nog altijd kunnen verwijderen, los van de aparte check in
# DELETE /users/me
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Een beheerdersaccount kan niet verwijderd worden",
        )
    target = db.get(models.User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")

    # Deelnemers van de eigen activiteiten van target vooraf ophalen (incl.
    # titel): na het verwijderen bestaan die activiteiten niet meer om nog
    # naar te verwijzen, en zonder deze melding zouden die deelnemers nooit
    # te weten komen dat hun activiteit verdwenen is -- zelfde bewoording als
    # delete_any_activity hieronder, dat exact dezelfde eindsituatie meldt
    te_melden = [
        (deelnemer, activiteit.title)
        for activiteit in db.query(models.Activity).filter(models.Activity.organizer_id == target.id)
        for deelnemer in _alle_deelnemers(db, activiteit.id)
        if deelnemer.id != target.id
    ]

    db.query(models.Message).filter(models.Message.user_id == target.id).delete()
    db.query(models.Participation).filter(models.Participation.user_id == target.id).delete()
    for activiteit in db.query(models.Activity).filter(models.Activity.organizer_id == target.id):
        db.delete(activiteit)
    db.delete(target)
    db.commit()

    for deelnemer, titel in te_melden:
        create_notification(
            db,
            deelnemer,
            "activiteit_verwijderd_admin",
            f'"{titel}" is door een beheerder verwijderd.',
            None,
            deelnemer.notify_activity_updates,
        )


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
    preview_by_activity = _participants_preview_by_activity(db, [a.id for a, _ in rows])
    return [
        activity_to_list_item(activity, participant_count, preview_by_activity.get(activity.id))
        for activity, participant_count in rows
    ]


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

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.chat import manager
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_ws
from app.uploads import UPLOADS_DIR

router = APIRouter(prefix="/activities", tags=["chat"])

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


# Live groepschat van een activiteit — enkel voor deelnemers. Validatie
# gebeurt volledig VOOR er ooit een accept() gebeurt: get_current_user_ws
# raiset WebSocketException bij een ongeldig/ontbrekend token, en de
# controles hieronder doen hetzelfde bij een onbestaande activiteit of een
# niet-deelnemer. FastAPI vangt WebSocketException op en stuurt zelf een
# nette websocket.close met die code — de socket wordt dus nooit "open"
# voor iemand die er niet hoort te zijn
@router.websocket("/{activity_id}/ws")
async def activity_chat_ws(
    websocket: WebSocket,
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_ws),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    is_participant = (
        db.query(models.Participation)
        .filter_by(activity_id=activity_id, user_id=current_user.id)
        .first()
        is not None
    )
    if not is_participant:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    await manager.connect(activity_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()

            # Typtekst-indicator: volledig additief bovenop de bestaande
            # berichten-flow — dit soort payload heeft geen "content"-sleutel,
            # dus bestaande clients/berichten blijven ongewijzigd werken
            if data.get("type") == "typing":
                payload = {
                    "type": "typing",
                    "user": schemas.ParticipantOut.model_validate(current_user).model_dump(),
                }
                await manager.broadcast(activity_id, payload)
                continue

            content = (data.get("content") or "").strip()
            if not content:
                continue  # lege/whitespace-only berichten negeren

            message = models.Message(
                activity_id=activity_id, user_id=current_user.id, content=content
            )
            db.add(message)
            db.commit()
            db.refresh(message)

            payload = schemas.MessageOut.model_validate(message).model_dump(mode="json")
            await manager.broadcast(activity_id, payload)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(activity_id, websocket)


# Chatgeschiedenis van een activiteit, oudste eerst — enkel voor deelnemers.
# Markeert de chat meteen als gelezen (voor het chatoverzicht/ongelezen-teller,
# zie GET /users/me/conversations in main.py)
@router.get("/{activity_id}/messages", response_model=list[schemas.MessageOut])
def get_messages(
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel deelnemers hebben toegang tot deze chat",
        )

    participation.last_read_at = datetime.now(timezone.utc)
    db.commit()

    return (
        db.query(models.Message)
        .options(joinedload(models.Message.user))
        .filter(models.Message.activity_id == activity_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )


# Afbeelding uploaden naar de chat — normale multipart POST i.p.v. binaire
# data over de WebSocket sturen. Slaat het bestand op, maakt er een
# Message-rij van, en broadcast die via dezelfde ConnectionManager als de
# WS-tekstberichten, zodat elke andere open verbinding in de room ze
# meteen ziet. De eigen verzender ontvangt 'm ook via zijn eigen open WS —
# de frontend hoeft na een succesvolle upload dus niets lokaal toe te
# voegen aan de berichtenlijst
@router.post(
    "/{activity_id}/messages/image",
    response_model=schemas.MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_chat_image(
    activity_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden"
        )

    is_participant = (
        db.query(models.Participation)
        .filter_by(activity_id=activity_id, user_id=current_user.id)
        .first()
        is not None
    )
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel deelnemers hebben toegang tot deze chat",
        )

    extension = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enkel JPEG-, PNG-, GIF- of WEBP-afbeeldingen zijn toegestaan",
        )

    # Geen Pillow in dit project: geen server-side compressie/resizing, het
    # bestand wordt ongewijzigd opgeslagen. We lezen het volledig in het
    # geheugen in (begrensd door de 5 MB-check hieronder) i.p.v. te
    # streamen — voldoende robuust voor de schaal van dit schoolproject
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Afbeelding is te groot (max. 5 MB)",
        )

    # Extensie afgeleid van het gevalideerde content_type, NIET van de
    # (onbetrouwbare) bestandsnaam van de client — garandeert dat
    # StaticFiles nadien de juiste Content-Type kan afleiden bij het
    # terugserveren
    filename = f"{uuid4().hex}{extension}"
    (UPLOADS_DIR / filename).write_bytes(contents)

    message = models.Message(
        activity_id=activity_id,
        user_id=current_user.id,
        content=None,
        image_url=f"/uploads/{filename}",
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    payload = schemas.MessageOut.model_validate(message).model_dump(mode="json")
    await manager.broadcast(activity_id, payload)
    return message


# Verwijdert een eigen bericht — enkel de verzender zelf mag dit, geen
# organisator-override. Broadcast een "delete"-event zodat elke open
# WebSocket-verbinding in de room (ook de eigen) het bericht meteen weghaalt
@router.delete("/{activity_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    activity_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    message = db.get(models.Message, message_id)
    if message is None or message.activity_id != activity_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bericht niet gevonden"
        )
    if message.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Je kan enkel je eigen berichten verwijderen",
        )

    if message.image_url:
        (UPLOADS_DIR / message.image_url.removeprefix("/uploads/")).unlink(missing_ok=True)

    db.delete(message)
    db.commit()

    await manager.broadcast(activity_id, {"type": "delete", "id": message_id})

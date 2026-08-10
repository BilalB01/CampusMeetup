from sqlalchemy.orm import Session

from app import models
from app.email import send_notification_email

_SUBJECTS = {
    "nieuwe_deelnemer": "Nieuwe deelnemer",
    "chatbericht": "Nieuw chatbericht",
    "herinnering": "Herinnering",
}


# Eén schakelaar per meldingstype stuurt in-app + e-mail samen aan: bij
# enabled=False wordt er dus ook geen Notification-rij aangemaakt
def create_notification(
    db: Session,
    user: models.User,
    type: str,
    text: str,
    activity_id: int | None,
    enabled: bool,
) -> models.Notification | None:
    if not enabled:
        return None
    notification = models.Notification(
        user_id=user.id, activity_id=activity_id, type=type, text=text
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    send_notification_email(user.email, _SUBJECTS.get(type, "CampusMeetup"), text)
    return notification

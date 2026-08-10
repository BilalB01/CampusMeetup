from datetime import datetime

import resend

from app.config import settings

resend.api_key = settings.resend_api_key

_WEEKDAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"]
_MAANDEN = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
]


def _format_when(start_time: datetime) -> str:
    weekdag = _WEEKDAGEN[start_time.weekday()].capitalize()
    return f"{weekdag} {start_time.day} {_MAANDEN[start_time.month - 1]}, {start_time.strftime('%H:%M')}"


def send_notification_email(to_email: str, subject: str, text: str) -> None:
    if not settings.resend_api_key:
        return
    try:
        resend.Emails.send({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": subject,
            "text": text,
        })
    except Exception:
        # best-effort: een mislukte e-mail mag de eigenlijke actie
        # (deelnemen, bericht versturen, ...) nooit laten falen
        pass


# Géén best-effort: dit is een expliciete gebruikersactie ("delen via
# e-mail"), dus een mislukte verzending moet wél zichtbaar falen zodat de
# router een nette foutmelding kan tonen — anders denkt de gebruiker dat de
# uitnodiging vertrokken is terwijl dat niet zo is
def send_activity_share_email(
    to_email: str,
    sender_name: str,
    message: str,
    activity_title: str,
    activity_category: str,
    activity_location: str,
    activity_start: datetime,
    activity_url: str,
) -> None:
    resend.Emails.send({
        "to": [to_email],
        "template": {
            "id": "activiteit-delen",
            "variables": {
                "SENDER_NAME": sender_name,
                "PERSONAL_MESSAGE": message,
                "ACTIVITY_CATEGORY": activity_category,
                "ACTIVITY_TITLE": activity_title,
                "ACTIVITY_WHEN": _format_when(activity_start),
                "ACTIVITY_LOCATION": activity_location,
                "ACTIVITY_URL": activity_url,
            },
        },
    })

# Meldingen — in-app meldingen en e-mail in detail

Dit document gaat dieper in op hoe meldingen (notifications) werken in
CampusMeetup: wanneer ze ontstaan, hoe ze zowel als database-rij (voor het
meldingencentrum) als als e-mail (via Resend) bij de gebruiker terechtkomen,
en hoe de frontend ze ophaalt en toont. Voor een vergelijkbaar diepgaand
document over een ander onderdeel, zie [authenticatie.md](authenticatie.md).

## 1. Kort overzicht

Er is geen aparte achtergrondtaak of message queue. Een melding ontstaat
altijd synchroon, als bijwerking van een gewone API-aanvraag (iemand sluit
aan bij een activiteit, stuurt een chatbericht, ...) of — bij de
herinnering — synchroon op het moment dat de gebruiker zijn meldingen
ophaalt.

```
Actie (aansluiten, chatbericht, activiteit bewerken/verwijderen, ...)
  → create_notification()            (backend/app/notifications.py)
      → Notification-rij in de database   (indien de gebruiker dit type aan heeft staan)
      → send_notification_email()          (backend/app/email.py, best-effort)
  → frontend pollt elke 30s /users/me/notifications
      → badge-tellers (zijbalk/onderbalk) + toast-pop-up bij iets nieuws
```

## 2. Soorten meldingen

Alle meldingstypes die in de code effectief voorkomen (als string in het
`type`-veld van `Notification`):

| Type (waarde in DB) | Ontstaat wanneer | Wordt aangemaakt in |
|---|---|---|
| `nieuwe_deelnemer` | Iemand sluit aan bij jouw activiteit | `routers/activities.py`, `join_activity` |
| `chatbericht` | Er komt een nieuw bericht in een groepschat waar je deel van bent | `routers/chat.py`, `_notify_new_message` |
| `herinnering` | Een activiteit waaraan je deelneemt begint binnen het uur | `main.py`, `_ensure_reminder_notifications` (zie §6) |
| `activiteit_bijgewerkt` | De organisator bewerkt een activiteit waaraan jij deelneemt | `routers/activities.py`, `update_activity` |
| `activiteit_verwijderd` | De organisator annuleert (verwijdert) een activiteit waaraan jij deelneemt | `routers/activities.py`, `delete_activity` |
| `activiteit_verwijderd_admin` | Een beheerder verwijdert de activiteit (i.p.v. de organisator zelf) | `routers/admin.py`, `delete_any_activity` |

De laatste twee lijken op elkaar maar hebben bewust een andere tekst en een
ander `type`: bij `activiteit_verwijderd_admin` weet de ontvanger dat het
een ingreep van een beheerder was (met reden erbij), niet iets wat de
organisator zelf besliste. De naam is bovendien ingekort tot `_admin` in
plaats van `_beheerder`, omdat `Notification.type` in de database
`String(30)` is en `activiteit_verwijderd_beheerder` daar met 31 tekens
net niet in past (zie `backend/app/models.py`).

Bij `nieuwe_deelnemer` gaat de melding altijd naar de organisator; bij de
andere activiteit-gerelateerde types gaat ze naar de (andere) deelnemers.

## 3. De centrale helper: `create_notification`

Alle meldingen — ongeacht het type — lopen door dezelfde functie in
`backend/app/notifications.py`:

```python
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
```

Belangrijk om te weten:

- **Eén `enabled`-vlag stuurt in-app én e-mail samen aan.** Staat een type
  uit (bv. `notify_chat_messages = False`), dan wordt er zelfs geen
  `Notification`-rij aangemaakt — de melding bestaat dan nergens, ook niet
  "ongelezen in de database maar zonder mail". Zie §5 voor de voorkeuren
  zelf.
- De aanroeper (de router) beslist welke `enabled`-waarde wordt
  meegegeven — meestal het bijhorende voorkeursveld van de ontvanger, bv.
  `deelnemer.notify_activity_updates`.
- `activity_id` mag `None` zijn: bij een verwijderde activiteit bestaat er
  namelijk niets meer om naar te linken (zie `models.Notification`, kolom
  `activity_id` met `ondelete="SET NULL"`).
- `_SUBJECTS` (bovenaan `notifications.py`) bepaalt het e-mailonderwerp per
  type. Niet elk type staat er expliciet in — `activiteit_bijgewerkt` en
  `activiteit_verwijderd` ontbreken, en vallen dus terug op de generieke
  `"CampusMeetup"` via `_SUBJECTS.get(type, "CampusMeetup")`.

## 4. De e-mailinfrastructuur (`email.py`)

`backend/app/email.py` bevat twee functies die allebei via
[Resend](https://resend.com) versturen, maar met een bewust verschillend
foutgedrag:

| Functie | Gebruikt voor | Bij ontbrekende `RESEND_API_KEY` | Bij een verzendfout |
|---|---|---|---|
| `send_notification_email` | Elke melding uit `create_notification` | Stopt stil, stuurt niets | Vangt de fout af (`except Exception: pass`) |
| `send_activity_share_email` | Expliciet "activiteit delen via e-mail" (`POST /activities/{id}/share`) | Geen eigen check — laat het aan Resend/de aanroeper over | Fout gooit door naar de router |

```python
def send_notification_email(to_email: str, subject: str, text: str) -> None:
    if not settings.resend_api_key:
        return
    try:
        resend.Emails.send({...})
    except Exception:
        pass
```

Dit is bewust **best-effort**: een melding komt altijd voort uit een
andere, eigenlijke actie (aansluiten, een bericht sturen, een activiteit
bewerken, ...). Die actie moet altijd slagen, ook al ligt Resend plat of
is er geen API-key ingesteld — de gebruiker ziet de melding dan gewoon
enkel in-app, in het meldingencentrum.

`send_activity_share_email` is het tegenovergestelde: geen `try/except`
in `email.py` zelf. De router (`routers/activities.py`, `share_activity`)
vangt de fout wél op, maar zet ze om in een zichtbare `502`:

```python
try:
    send_activity_share_email(...)
except Exception:
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Kon de uitnodiging niet versturen. Probeer het later opnieuw.",
    )
```

Het verschil: delen via e-mail is een expliciete, eenmalige
gebruikersactie ("stuur deze uitnodiging"). Als dat niet lukt, moet de
gebruiker dat weten — anders denkt hij dat de uitnodiging vertrokken is
terwijl dat niet zo is.

**Zonder `RESEND_API_KEY` in `.env`** (zie `backend/app/config.py`, het
veld is optioneel en standaard `None`) blijft de rest van de applicatie
gewoon werken: `resend.api_key` wordt dan `None`, `send_notification_email`
stopt vroeg door de `if not settings.resend_api_key` check, en er wordt
nergens een uitzondering opgegooid. Enkel `send_activity_share_email` mist
die check, dus die zou in dat geval effectief falen — en de gebruiker
krijgt daarvan de nette `502` hierboven te zien in plaats van een kale
serverfout.

## 5. Meldingsvoorkeuren per type

Elke gebruiker heeft vier aan/uit-schakelaars op `models.User`, elk met
een default van `True`:

| Veld op `User` | Bestuurt meldingstype(s) |
|---|---|
| `notify_new_participant` | `nieuwe_deelnemer` |
| `notify_chat_messages` | `chatbericht` |
| `notify_reminder` | `herinnering` |
| `notify_activity_updates` | `activiteit_bijgewerkt`, `activiteit_verwijderd`, `activiteit_verwijderd_admin` |

Zoals hierboven vermeld stuurt elke schakelaar **beide kanalen tegelijk**
aan (in-app én e-mail) — er is geen apart vinkje "toon in de app" versus
"stuur me een mail". Dat is een bewuste keuze om de Instellingen-UI niet
nodeloos te verdubbelen (zie de comment bij deze velden in
`backend/app/models.py`).

Bijwerken gebeurt via:

```
PUT /users/me/notification-preferences
```

met als body exact de vier velden hierboven (`schemas.NotificationPreferences`).
De UI voor deze instellingen zelf zit niet in dit document — zie
[profiel-en-instellingen.md](profiel-en-instellingen.md).

## 6. De "herinnering"-melding: lazy berekend

Er draait geen scheduler of cronjob die op het juiste moment een
herinnering verstuurt. In plaats daarvan wordt dat lazy berekend, telkens
wanneer een gebruiker zijn meldingen ophaalt:

```python
# backend/app/main.py
REMINDER_WINDOW = timedelta(minutes=60)

def _ensure_reminder_notifications(db: Session, current_user: models.User) -> None:
    if not current_user.notify_reminder:
        return
    nu = datetime.now(timezone.utc)
    binnenkort = nu + REMINDER_WINDOW
    activiteiten = (
        db.query(models.Activity)
        .join(models.Participation, ...)
        .filter(models.Participation.user_id == current_user.id)
        .filter(models.Activity.start_time > nu, models.Activity.start_time <= binnenkort)
        .all()
    )
    for activiteit in activiteiten:
        bestaat_al = db.query(models.Notification).filter_by(
            user_id=current_user.id, activity_id=activiteit.id, type="herinnering"
        ).first()
        if bestaat_al:
            continue
        create_notification(db, current_user, "herinnering", ..., activiteit.id, True)
```

`GET /users/me/notifications` roept deze functie op vóór het opvragen van
de meldingen zelf. Voor elke activiteit waaraan de gebruiker deelneemt en
die binnen het uur begint, wordt gecontroleerd of er al een
`herinnering`-melding voor die combinatie (gebruiker + activiteit)
bestaat; zo niet, dan wordt die nu pas aangemaakt. Zo kan een gebruiker
nooit twee keer dezelfde herinnering krijgen, ook al wordt deze functie
tientallen keren per uur aangeroepen (elke poll, zie §7).

Omdat dit puur gebeurt op het moment van ophalen (en de frontend elke 30
seconden pollt zolang de app open staat, zie §7), verschijnt een
herinnering in de praktijk binnen enkele tientallen seconden nadat een
activiteit het venster van 60 minuten instapt — maar enkel als er op dat
moment ook effectief gepolld wordt.

## 7. Het meldingencentrum en de toast-pop-ups

### Meldingencentrum (`MeldingenOverzicht.jsx`)

`frontend/src/pages/MeldingenOverzicht.jsx` haalt bij het openen van het
scherm `getNotifications(token)` op (dus rechtstreeks `GET
/users/me/notifications`, los van de gedeelde poll hieronder) en toont ze
in een lijst, nieuwste eerst (dat sorteren gebeurt al backend-kant). Een
klik op een melding:

1. Markeert 'm lokaal en via `PUT /users/me/notifications/{id}/read` als
   gelezen (optimistic update — de UI verandert meteen, de aanvraag loopt
   op de achtergrond mee).
2. Navigeert door naar de activiteit — naar het chatgedeelte specifiek als
   het om een `chatbericht`-melding gaat, anders naar het activiteitdetail.

"Alles gelezen" is ook een optimistic update, net als het aanklikken van
één melding: lokaal worden meteen alle meldingen op gelezen gezet, terwijl
`PUT /users/me/notifications/read-all` op de achtergrond loopt. Bij een
mislukte aanvraag wordt dat — in tegenstelling tot de stille fallback bij
één melding — wél teruggedraaid: de vorige lees/ongelezen-status komt
terug, en er verschijnt een foutmelding. Zonder die rollback zou de UI
alles als gelezen blijven tonen ook al is de serveraanroep mislukt.

### Gedeelde poll-lus (`NotificationsContext`)

Los van het meldingencentrum zelf houdt `NotificationsContext`
(`frontend/src/notifications/NotificationsContext.jsx`) één centrale,
app-brede voorraad meldingen bij, opgehaald via dezelfde
`GET /users/me/notifications`, elke **30 seconden**
(`POLL_INTERVAL_MS = 30000`) zolang er een ingelogde gebruiker is. Deze
context wordt in `main.jsx` rond de hele app gehangen (binnen
`AuthProvider`, want de poll heeft het token nodig), dus de poll loopt
onafhankelijk van welk scherm er open staat.

Uit die gedeelde voorraad worden twee dingen afgeleid: de ongelezen-teller
(gebruikt voor de badges in zijbalk/onderbalk) en de toasts.

### Toast-pop-ups (`NotificationToasts.jsx`)

`frontend/src/components/NotificationToasts.jsx` toont de toasts uit die
context. Een toast verschijnt enkel voor een melding die (a) ongelezen is
én (b) nog niet eerder gezien is tijdens deze sessie — de eerste poll na
het inloggen/laden van de app legt enkel een "baseline" vast (welke
meldingen al bestonden) zonder er toasts voor te tonen; pas bij een
volgende poll telt een melding als "nieuw".

Elke toast verdwijnt automatisch na 6 seconden (`AUTO_DISMISS_MS = 6000`),
of meteen bij een klik (die ook navigeert, net als in het
meldingencentrum) of op het sluitkruisje. Toasts worden niet getoond op de
auth-schermen (login/registratie, via `isAuthScreen`).

## 8. Rate limiting

Op de meldingen-endpoints zelf (`GET /users/me/notifications`, de
`read`/`read-all`-routes, `notification-preferences`) staat geen rate
limiting. Wel beperkt via `@limiter.limit("5/hour")`:
`POST /activities/{id}/share` — het endpoint dat `send_activity_share_email`
aanroept. Dat is geen melding in de zin van dit document, maar deelt wel de
e-mailinfrastructuur uit `email.py`; de limiet voorkomt dat het endpoint
misbruikt wordt als gratis, open e-mail-relay.

## 9. Voorbeeldverzoeken

```bash
# Eigen meldingen ophalen (berekent meteen ook eventuele nieuwe herinneringen)
curl http://localhost:8000/users/me/notifications \
  -H "Authorization: Bearer <access_token>"

# Eén melding als gelezen markeren
curl -X PUT http://localhost:8000/users/me/notifications/42/read \
  -H "Authorization: Bearer <access_token>"

# Alles in één keer als gelezen markeren
curl -X PUT http://localhost:8000/users/me/notifications/read-all \
  -H "Authorization: Bearer <access_token>"

# Meldingsvoorkeuren bijwerken
curl -X PUT http://localhost:8000/users/me/notification-preferences \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"notify_new_participant":true,"notify_chat_messages":false,"notify_reminder":true,"notify_activity_updates":true}'
```

## 10. Gekende beperkingen (bewust, voor nu)

- Geen websockets/push voor meldingen — enkel polling elke 30 seconden, dus
  in het slechtste geval tot 30 seconden vertraging voor je een nieuwe
  melding of toast ziet.
- Geen paginatie op `GET /users/me/notifications`: de volledige
  meldingengeschiedenis van een gebruiker wordt telkens in één keer
  opgehaald.
- De "herinnering"-melding wordt écht enkel aangemaakt op het moment dat
  er gepolld wordt terwijl de activiteit binnen het venster van
  `REMINDER_WINDOW` (60 minuten) valt. Staat de app niet open in die
  periode (geen actieve poll), dan wordt er voor die activiteit nooit een
  herinnering aangemaakt — eenmaal `start_time` voorbij is, faalt de
  `start_time > nu`-filter en komt de activiteit niet meer in aanmerking.
- `_SUBJECTS` in `notifications.py` dekt niet elk type: `activiteit_bijgewerkt`
  en `activiteit_verwijderd` krijgen als e-mailonderwerp gewoon de
  generieke fallback `"CampusMeetup"` in plaats van een eigen titel.
- Eén schakelaar per type voor zowel in-app als e-mail — geen fijnere
  controle (bv. wel in-app, geen mail) zonder de datamodel/UI uit te
  breiden.
- Geen rate limiting op de meldingen-endpoints zelf.

Dit zijn geen "vergeten" punten maar bewuste keuzes om de scope behapbaar
te houden — mocht dit relevant worden voor een latere sprint, dan weten we
tenminste waar we moeten beginnen.

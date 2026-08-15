# Groepschat — WebSocket-chat per activiteit in detail

Dit document gaat dieper in op hoe de groepschat van een activiteit precies
werkt: hoe de WebSocket-verbinding tot stand komt (en hoe authenticatie
daarbij werkt), hoe berichten versleuteld worden opgeslagen, hoe
afbeeldingen en de typtekst-indicator werken, en hoe het chatoverzicht zijn
ongelezen-tellers berekent. Voor login/registratie in het algemeen, zie
[authenticatie.md](authenticatie.md).

## 1. Kort overzicht

Elke activiteit heeft één groepschat, enkel bereikbaar voor wie er ook
effectief aan deelneemt (`Participation`). De chat bestaat uit twee
sporen die samenwerken:

```
Geschiedenis ophalen:  GET  /activities/{id}/messages   → alle berichten, oudste eerst
Live berichten:        WS   /activities/{id}/ws          → nieuwe berichten, verwijderingen, typtekst
Afbeelding versturen:  POST /activities/{id}/messages/image → gewone multipart-upload
Bericht verwijderen:   DELETE /activities/{id}/messages/{message_id}
```

Backend: `backend/app/routers/chat.py` (routes), `backend/app/chat.py`
(`ConnectionManager`), `backend/app/crypto.py` (versleuteling),
`backend/app/uploads.py` (opslagpad voor afbeeldingen).
Frontend: `frontend/src/hooks/useActivityChat.js` (alle chat-logica),
`frontend/src/pages/ActiviteitChat.jsx` (volledige-scherm chatvenster),
`frontend/src/pages/ChatOverzicht.jsx` (lijst van alle chats + ongelezen).

## 2. Authenticatie over WebSocket

Bij een gewone HTTP-aanvraag stuurt de frontend het JWT-token mee in een
`Authorization: Bearer <token>`-header. Dat kan niet bij een WebSocket: de
browser laat geen custom headers toe tijdens de WS-handshake (het
`new WebSocket(url)`-object heeft daar simpelweg geen optie voor). De
oplossing hier is het token als querystring-parameter mee te geven:

```js
// frontend/src/hooks/useActivityChat.js
const ws = new WebSocket(
  `${WS_BASE_URL}/activities/${activityId}/ws?token=${encodeURIComponent(token)}`
);
```

Aan de backend-kant bindt FastAPI een niet-pad-parameter van een
websocket-dependency automatisch aan de querystring, net zoals bij een
gewone route. `get_current_user_ws` (`backend/app/dependencies.py`) haalt
dat `token`-argument op en hergebruikt dezelfde decodeerlogica
(`_decode_user`) als de HTTP-variant:

```python
# backend/app/dependencies.py
def get_current_user_ws(
    websocket: WebSocket,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> models.User:
    user = _decode_user(token, db) if token else None
    if user is None:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    return user
```

Belangrijk: deze check — én de controle of de activiteit bestaat, én of de
gebruiker er wel degelijk aan deelneemt — gebeurt allemaal **voordat**
`manager.connect()` (en dus `websocket.accept()`) wordt aangeroepen in
`activity_chat_ws` (`backend/app/routers/chat.py`). Zolang FastAPI een
`WebSocketException` kan opvangen vóór de accept, sluit het de socket zelf
netjes af met die statuscode. Er bestaat dus geen moment waarop iemand die
nooit deelnemer was een "open" verbinding heeft, ook al maar heel even.

Die eenmalige check bij het opzetten van de verbinding volstaat echter niet
voor iemand die **tijdens** een openstaande sessie de activiteit verlaat
(`DELETE /activities/{id}/join`) — die actie sluit de WebSocket niet zelf
af. Daarom herhaalt de berichtenlus in `activity_chat_ws` dezelfde
deelname-check bij **elk binnenkomend bericht** (tekst én typtekst-events):

```python
# backend/app/routers/chat.py, activity_chat_ws
while True:
    data = await websocket.receive_json()
    nog_steeds_deelnemer = (
        db.query(models.Participation)
        .filter_by(activity_id=activity_id, user_id=current_user.id)
        .first()
        is not None
    )
    if not nog_steeds_deelnemer:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        break
    ...
```

Wie de activiteit verlaat terwijl de chat nog openstaat, wordt dus pas bij
zijn *volgende* verzendpoging geweigerd en losgekoppeld — niet meteen op
het moment van verlaten. Zolang die persoon niets verstuurt, blijft de
socket nog even openstaan en kan die in theorie nieuwe berichten van
anderen blijven ontvangen tot de eerstvolgende eigen zendactie. Zie ook §9.

Dit is een bewust aanvaarde vereenvoudiging voor een schoolproject: een
token in de URL kan in serverlogs of browsergeschiedenis terechtkomen. Zie
ook §9.

## 3. `ConnectionManager` — wie krijgt welk bericht?

`backend/app/chat.py` houdt in het geheugen bij welke WebSocket-verbindingen
open staan, per activiteit:

```python
class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = {}
```

- `connect(activity_id, websocket)`: accepteert de socket en voegt ze toe
  aan de lijst van die activiteit.
- `disconnect(activity_id, websocket)`: haalt de socket uit de lijst; is de
  lijst daarna leeg, dan verdwijnt ook de sleutel voor die activiteit.
- `broadcast(activity_id, payload)`: stuurt het `payload`-dict (al
  JSON-veilig gemaakt via `MessageOut.model_dump(mode="json")`) naar élke
  open verbinding van die activiteit — dus ook naar de verzender zelf. Dat
  is precies waarom de frontend na het versturen van een bericht niets
  lokaal moet toevoegen: het bericht komt gewoon terug via de eigen open
  socket.

Bij een mislukte `send_json` (bv. de client heeft de tab hard gesloten
zonder nette WebSocket-close) vangt `broadcast` de fout stilzwijgend op en
gaat verder met de volgende verbinding — de opruiming van die dode socket
gebeurt niet daar, maar in de eigen route van die client: zodra die
merkt dat de verbinding weg is (`WebSocketDisconnect`), roept de `finally`
in `activity_chat_ws` `manager.disconnect()` aan.

Dit is bewust een simpele in-memory registry, geen Redis of ander
pub/sub-systeem: het project draait single-process (`uvicorn --reload`,
geen meerdere workers), dus elk Python-proces heeft toch maar één
volledig beeld van wie er verbonden is. Bij een herstart van de server
verliezen alle clients hun verbinding en moet de frontend gewoon opnieuw
connecteren (zie ook §9).

## 4. Berichtversleuteling

Chatberichten worden **versleuteld opgeslagen** in de `messages`-tabel.
Dat gebeurt met [Fernet](https://cryptography.io/en/latest/fernet/) uit de
`cryptography`-library — symmetrische encryptie (AES-128 in CBC-modus,
met een HMAC voor integriteit) op basis van één geheime sleutel:

```python
# backend/app/crypto.py
_fernet = Fernet(settings.message_encryption_key.encode())

def encrypt_text(text: str) -> str:
    return _fernet.encrypt(text.encode()).decode()

def decrypt_text(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()
```

De sleutel zelf (`MESSAGE_ENCRYPTION_KEY`) komt uit de omgevingsvariabelen
(`backend/app/config.py`) en wordt gegenereerd met `Fernet.generate_key()`.

**Wanneer wordt er ontsleuteld?** Niet expliciet ergens in de router-code —
het gebeurt volledig transparant op databaseniveau via een SQLAlchemy
`TypeDecorator`:

```python
# backend/app/models.py
class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_text(value)   # bij elke schrijfactie naar de DB

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_text(value)   # bij elke leesactie uit de DB
```

`Message.content` gebruikt dit type (`content = Column(EncryptedText,
nullable=True)`). Voor de rest van de applicatie (routers, schemas,
frontend) gedraagt dat veld zich gewoon als een normale string-kolom: je
leest `message.content` en krijgt gewoon leesbare tekst, je schrijft er een
string naartoe en die wordt automatisch versleuteld voor hij de database
raakt. Wie rechtstreeks in de database kijkt (bv. via een dump of een
gecompromitteerd databasewachtwoord) ziet enkel cijfergebrabbel, geen
leesbare gespreksinhoud.

Eén plek waar hiermee bewust rekening gehouden wordt: de
meldingentekst bij een nieuw bericht (`_notify_new_message` in
`backend/app/routers/chat.py`) bevat expres **niet** de berichttekst zelf
— enkel de activiteitsnaam. Zou de meldingentekst de berichttekst
kopiëren, dan stond er alsnog een leesbare tweede kopie van het bericht in
de (onversleutelde) `notifications`-tabel, en zou de versleuteling van
`Message.content` weinig voorstellen.

Afbeeldingen (`image_url`) worden **niet** versleuteld — het is gewoon een
relatief pad zoals `/uploads/<uuid>.jpg`, geen gespreksinhoud.

## 5. Afbeeldingen versturen

Een afbeelding gaat niet over de WebSocket (die is bedoeld voor kleine
JSON-payloads), maar via een gewone multipart POST:

```
POST /activities/{activity_id}/messages/image   (multipart/form-data, veld "file")
```

Toegelaten bestandstypes en limiet, gedefinieerd in
`backend/app/routers/chat.py`:

| Content-Type | Extensie | Toegelaten |
|---|---|---|
| `image/jpeg` | `.jpg` | ✅ |
| `image/png` | `.png` | ✅ |
| `image/gif` | `.gif` | ✅ |
| `image/webp` | `.webp` | ✅ |
| eender wat anders | — | ❌ → `400 Bad Request` |

Maximale bestandsgrootte: **5 MB** (`MAX_IMAGE_SIZE_BYTES = 5 * 1024 *
1024`). Een groter bestand geeft `413 Request Entity Too Large`.

Verloop van de upload:

1. Controle: bestaat de activiteit, is de gebruiker deelnemer (zelfde
   regels als bij de WebSocket).
2. `content_type` van de upload wordt opgezocht in `ALLOWED_IMAGE_TYPES`.
   De bestandsextensie wordt afgeleid van dát gevalideerde content-type,
   niet van de (onbetrouwbare) bestandsnaam die de client meestuurt — zo
   is gegarandeerd dat `StaticFiles` nadien de juiste `Content-Type` kan
   afleiden bij het terugserveren van het bestand.
3. Het bestand wordt volledig ingelezen in het geheugen (begrensd door de
   5 MB-check) en weggeschreven onder een willekeurige bestandsnaam
   (`uuid4().hex` + extensie) in `UPLOADS_DIR` (`backend/app/uploads.py`,
   een map die absoluut bepaald wordt t.o.v. de locatie van dat bestand,
   ongeacht vanuit welke working directory `uvicorn` gestart wordt).
4. Er komt een `Message`-rij met `content=None` en `image_url=
   "/uploads/<bestand>"`.
5. Die wordt gebroadcast via dezelfde `ConnectionManager` als
   tekstberichten, en er gaat een melding naar de andere deelnemers.

Er zit geen Pillow (of gelijkaardige beeldbewerkingslibrary) in dit
project: er gebeurt geen server-side compressie of resizing, het bestand
wordt exact zoals ontvangen opgeslagen.

`GET /uploads/<bestand>` wordt uitgeserveerd via FastAPI's `StaticFiles`
(gemount in `backend/app/main.py`), en de frontend bouwt de volledige
URL simpelweg als `${API_URL}${m.image_url}` (`ActiviteitChat.jsx`).

## 6. Typtekst-indicator

Volledig additief bovenop de gewone berichten-flow: een typtekst-event
heeft geen `content`-sleutel, dus het beïnvloedt de normale
berichtenafhandeling niet.

**Versturen** (`useActivityChat.js`, `notifyTyping`): bij elke wijziging
van het invoerveld wordt een `{"type": "typing"}`-bericht over de
WebSocket gestuurd — maar **maximaal één keer per 2 seconden**, ook al
typt de gebruiker ononderbroken door:

```js
const notifyTyping = useCallback(() => {
  const ws = wsRef.current;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  if (now - lastTypingSentRef.current < 2000) return;
  lastTypingSentRef.current = now;
  ws.send(JSON.stringify({ type: "typing" }));
}, []);
```

**Ontvangen** (backend, `activity_chat_ws`): de server stuurt zo'n event
gewoon door naar iedereen in de room, met de afzender erbij:

```python
if data.get("type") == "typing":
    payload = {
        "type": "typing",
        "user": schemas.ParticipantOut.model_validate(current_user).model_dump(),
    }
    await manager.broadcast(activity_id, payload)
    continue
```

**Weergave** (frontend): omdat de server naar iedereen broadcast, inclusief
de verzender zelf, filtert de hook eigen typtekst-events er expliciet uit
(`if (data.user.id === currentUserId) return`). Voor elke andere gebruiker
die "aan het typen" is, wordt een timer van 3 seconden gezet; komt er
binnen die 3 seconden geen nieuw typtekst-event van diezelfde gebruiker,
dan verdwijnt die naam automatisch uit `typingUsers`. Er is dus geen
expliciet "gestopt met typen"-bericht — enkel een aflopende timer per
gebruiker. Komt er van diezelfde gebruiker intussen een echt bericht
binnen, dan wordt die meteen uit `typingUsers` gehaald (in plaats van te
wachten tot de timer verloopt).

In de UI (`ActiviteitChat.jsx`) toont dit zich als "X typt..." of "N
mensen zijn aan het typen..." onderaan het scherm.

## 7. Chatoverzicht — ongelezen-tellers

`ChatOverzicht.jsx` haalt `GET /users/me/conversations` op
(`backend/app/main.py`, `read_my_conversations`) — één rij per activiteit
waaraan de gebruiker deelneemt, gesorteerd op recentste bericht.

Per deelname (`Participation`) wordt bijgehouden wanneer de gebruiker de
chat voor het laatst geopend heeft: `last_read_at`. Dat veld wordt
bijgewerkt telkens `GET /activities/{id}/messages` wordt aangeroepen (dus
telkens de chat geopend wordt):

```python
# backend/app/routers/chat.py — get_messages
participation.last_read_at = datetime.now(timezone.utc)
db.commit()
```

De ongelezen-teller per activiteit telt simpelweg de berichten die
**niet van de gebruiker zelf** zijn en **na** `last_read_at` verstuurd
zijn:

```python
# backend/app/main.py — read_my_conversations
is_unread = m.user_id != current_user.id and (
    participation.last_read_at is None or m.created_at > participation.last_read_at
)
```

Is `last_read_at` nog `None` (chat nog nooit geopend), dan telt élk
bericht van iemand anders als ongelezen. Het chatvoorbeeld
(`last_message`) toont "📷 Afbeelding" voor een afbeeldingsbericht (er is
immers geen tekst om te tonen), en krijgt het voorvoegsel "Jij: " als de
laatste boodschap van de ingelogde gebruiker zelf komt.

De teller wordt dus enkel bijgewerkt bij het **ophalen van de
geschiedenis** (het openen van het chatscherm) — niet bij het simpelweg
ontvangen van een live bericht via de WebSocket terwijl het chatoverzicht
open staat. Zolang je het chatscherm zelf niet opent, blijft een bericht
als ongelezen meetellen.

## 8. Een eigen bericht verwijderen

`DELETE /activities/{activity_id}/messages/{message_id}`
(`backend/app/routers/chat.py`, `delete_message`):

- Enkel de **verzender zelf** mag zijn/haar bericht verwijderen —
  `message.user_id != current_user.id` geeft een `403`. Er is geen
  uitzondering voor de organisator van de activiteit: die kan dus niet
  andermans berichten verwijderen via deze route.
- Hoort het bericht niet bij deze activiteit, of bestaat het niet, dan is
  het een `404`.
- Gaat het om een afbeeldingsbericht, dan wordt ook het bestand op schijf
  verwijderd (`UPLOADS_DIR / ... .unlink(missing_ok=True)`) — niet enkel
  de databaserij.
- De `Message`-rij wordt volledig uit de database verwijderd (geen
  "soft delete" met een `deleted`-vlag of vervangende tekst zoals
  "Dit bericht is verwijderd").
- Er wordt een `{"type": "delete", "id": message_id}`-event gebroadcast
  naar iedereen in de room — inclusief de verzender zelf. Aan de
  frontend-kant (`useActivityChat.js`) haalt élke open verbinding het
  bericht dan gewoon uit zijn lokale `messages`-lijst; er is dus geen
  aparte code nodig om het bericht lokaal te verwijderen bij de
  gebruiker die op "verwijderen" klikte.

In `ActiviteitChat.jsx` verschijnt de verwijderknop enkel bij eigen
berichten (`m.user.id === user.id`), met een `window.confirm(...)` als
laatste bevestiging vóór het effectief verwijderd wordt.

## 9. Gekende beperkingen (bewust, voor nu)

- **Geen berichten bewerken.** Enkel versturen en verwijderen; een
  verstuurd bericht kan niet achteraf aangepast worden.
- **Geen paginatie/"laad meer".** `GET /activities/{id}/messages` geeft
  altijd de volledige geschiedenis in één keer terug (oudste eerst, geen
  `limit`/`offset`). Bij een activiteit met een erg lange chatgeschiedenis
  wordt dus alles in één keer opgehaald.
- **Geen leesbevestigingen per gebruiker.** Er wordt enkel bijgehouden
  wanneer de ingelogde gebruiker zelf de chat het laatst opende
  (`last_read_at`) voor de eigen ongelezen-teller — niet wie van de
  andere deelnemers een bericht al gezien heeft ("gelezen door"-vinkjes
  zoals in WhatsApp bestaan niet).
- **Geen afbeeldingscompressie/resizing.** Zonder Pillow wordt elke
  toegelaten afbeelding exact zoals geüpload opgeslagen (tot 5 MB).
- **In-memory `ConnectionManager`, geen pub/sub.** Werkt enkel correct
  binnen één Python-proces (`uvicorn --reload`, geen meerdere workers).
  Bij een herstart van de server verliest iedereen zijn verbinding en
  moet de frontend opnieuw connecteren; met meerdere workers/processen
  zou een broadcast enkel de clients bereiken die toevallig met datzelfde
  proces verbonden zijn.
- **JWT-token in de WebSocket-querystring.** Nodig omdat de browser geen
  custom headers kan zetten tijdens de WS-handshake (zie §2), maar
  betekent wel dat het token in serverlogs of browsergeschiedenis kan
  terechtkomen — een bewust aanvaarde vereenvoudiging voor dit
  schoolproject.
- **Geen reacties/emoji op berichten, geen threads/replies.**

Dit zijn geen "vergeten" punten maar bewuste keuzes om de scope van dit
onderdeel behapbaar te houden — mocht dit relevant worden voor een latere
sprint, dan weten we tenminste waar we moeten beginnen.

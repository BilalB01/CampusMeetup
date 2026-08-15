# Badges — live berekend, geen aparte tabel

Dit document legt uit hoe badges op het profielscherm werken: welke er
zijn, wanneer ze "verdiend" zijn, en waarom ze bij elke aanvraag opnieuw
berekend worden in plaats van ergens opgeslagen te staan. Voor een
vergelijkbaar diepgaand document over een ander onderdeel, zie
[authenticatie.md](authenticatie.md).

## 1. Kort overzicht

Er bestaat geen `Badge`-tabel in de database. Alles gebeurt in één
endpoint, dat bij elke aanvraag een paar tellingen uit de bestaande
tabellen (`activities`, `participations`, `messages`) opvraagt en die
tellingen vergelijkt met de voorwaarden die vast in de Python-code staan:

```
GET /users/me/badges
  → tel activiteiten die je organiseerde
  → tel keer dat je deelnam aan andermans activiteit
  → tel je chatberichten
  → verzamel de categorieën waarin je actief was (georganiseerd of deelgenomen)
  → vergelijk elke telling met de vaste badge-definities
  → geef de volledige lijst badges terug, elk met earned: true/false
```

## 2. Het endpoint en de berekening

`GET /users/me/badges` (`backend/app/main.py`, `read_my_badges`):

```python
organized_count = (
    db.query(func.count(models.Activity.id))
    .filter(models.Activity.organizer_id == current_user.id)
    .scalar()
)

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
```

`joined_elsewhere_count` sluit activiteiten uit waar je zelf organisator
van bent (`Activity.organizer_id != current_user.id`) — dezelfde
uitsluiting als bij `read_my_activities` elders in `main.py`, om te
vermijden dat je eigen activiteit meetelt als "deelgenomen aan andermans
activiteit". `distinct_categories` telt een categorie maar één keer, of je
er nu meerdere keren in georganiseerd/deelgenomen hebt — het gaat om
*welke* categorieën je hebt aangeraakt, niet hoe vaak.

## 3. De badges zelf

Alle zes badge-definities staan als vaste lijst in `read_my_badges`
(`backend/app/main.py`). Rechtstreeks uit de code, exact zoals ze daar
staan:

| Sleutel (`key`) | Label | Voorwaarde | Icoon |
|---|---|---|---|
| `eerste_organisatie` | Eerste activiteit | Je hebt je eerste activiteit georganiseerd (≥ 1 georganiseerd) | 🎉 |
| `drukbezet_organisator` | Drukbezet organisator | 5 activiteiten georganiseerd (≥ 5 georganiseerd) | 🗓️ |
| `nieuwsgierig` | Nieuwsgierig | Deelgenomen aan andermans activiteit (≥ 1 keer, niet je eigen activiteit) | 👋 |
| `sociale_vlinder` | Sociale vlinder | 5 keer deelgenomen aan andermans activiteiten (≥ 5 keer) | 🦋 |
| `prater` | Prater | 10 chatberichten verstuurd (≥ 10) | 💬 |
| `alleskunner` | Alleskunner | Actief in alle 6 categorieën (georganiseerd of deelgenomen, samen ≥ 6 unieke categorieën) | 🌟 |

De response bevat altijd alle zes badges, ook de niet-verdiende — elke
badge krijgt een `earned: true`/`false`. Het is dus aan de frontend om te
kiezen hoe een onverdiende badge getoond wordt (bv. grijs/vervaagd), niet
aan de backend om ze weg te laten.

```python
schemas.BadgeOut(key=k, label=l, description=d, icon=i, earned=e)
```

`schemas.BadgeOut` (`backend/app/schemas.py`) legt die vorm vast: `key`,
`label`, `description`, `icon` (een emoji als string) en `earned`
(boolean).

## 4. Waarom live berekenen in plaats van een aparte tabel

De comment direct boven het endpoint in `backend/app/main.py` verwoordt de
keuze zo:

```python
# Badges voor het profielscherm — de definities liggen vast in code,
# "earned" wordt hier telkens live berekend uit de echte tellingen,
# geen aparte databasetabel of achtergrondjob nodig
```

Concreet betekent dit: er is geen `user_badges`-tabel om synchroon te
houden, en geen achtergrondtaak die na elke activiteit/elk bericht moet
controleren of er een nieuwe badge "verdiend" is. Een badge is op elk
moment gewoon een afgeleide van bestaande data (hoeveel activiteiten,
berichten, categorieën) — dezelfde aanpak als bij `read_my_conversations`
in hetzelfde bestand, waar ook alles per aanvraag opnieuw uit de
brontabellen wordt opgebouwd in plaats van een aparte, bij te houden kopie.
Het keerzijde daarvan: elke aanvraag naar `/users/me/badges` doet
meerdere `COUNT`-queries; bij een klein aantal activiteiten/berichten per
gebruiker (het huidige schaalniveau van dit project) weegt dat niet op
tegen de eenvoud van geen extra tabel of achtergrondjob te moeten
onderhouden.

## 5. Waar badges getoond worden

Het profielscherm (`frontend/src/pages/Profiel.jsx`) haalt de badges op
via `getMyBadges(token)` (`GET /users/me/badges`) en toont ze in een
`badges-grid`, één tegel per badge met icoon en label; onverdiende badges
krijgen de CSS-klasse `badge-tegel--onverdiend`. De volledige UI-details
(lay-out, kleuren, verdere schermopbouw) horen niet in dit document thuis
— zie [profiel-en-instellingen.md](profiel-en-instellingen.md).

## 6. Voorbeeldverzoek

```bash
curl http://localhost:8000/users/me/badges \
  -H "Authorization: Bearer <access_token>"
```

Voorbeeldresponse (verkort):

```json
[
  {
    "key": "eerste_organisatie",
    "label": "Eerste activiteit",
    "description": "Je hebt je eerste activiteit georganiseerd",
    "icon": "🎉",
    "earned": true
  },
  {
    "key": "alleskunner",
    "label": "Alleskunner",
    "description": "Actief in alle 6 categorieën",
    "icon": "🌟",
    "earned": false
  }
]
```

## 7. Gekende beperkingen (bewust, voor nu)

- Geen geschiedenis: je ziet enkel of een badge nu verdiend is, niet
  wanneer dat precies gebeurde (er is geen `earned_at`-tijdstip, want er
  wordt niets opgeslagen).
- Geen melding/toast wanneer je een nieuwe badge verdient — dat zou een
  vergelijking tussen twee momentopnames vereisen, en die worden nergens
  bijgehouden.
- De badge-definities (drempelwaarden, aantal categorieën) staan hard
  gecodeerd in `read_my_badges`; een nieuwe badge toevoegen betekent een
  codewijziging, geen configuratie of databasewijziging.
- Bij een groot aantal gebruikers/activiteiten zou het live berekenen bij
  elke aanvraag zwaarder gaan wegen — voor de huidige schaal van dit
  project is dat geen probleem.

Dit zijn geen "vergeten" punten maar bewuste keuzes om de scope behapbaar
te houden — mocht dit relevant worden voor een latere sprint, dan weten we
tenminste waar we moeten beginnen.

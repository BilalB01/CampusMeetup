# Activiteiten — aanmaken, bewerken, deelnemen en de kaart

Dit document beschrijft de volledige activiteiten-flow: van de categorieën
op het startscherm tot een individuele activiteit waar je aan deelneemt.
Het gaat over de code achter `/activities/*` in de backend en de bijhorende
schermen/componenten in de frontend. Voor de admin-acties op activiteiten
(beheerder verwijdert een activiteit van iemand anders), zie
[admin.md](admin.md) — hier komt enkel het stukje "beheerder kan hier ook
verwijderen" op de detailpagina zelf aan bod, niet de volledige adminflow.

## 1. Kort overzicht

```
Categorieën (Categorieen.jsx)
  → Activiteitenlijst per categorie of "Alles" (ActiviteitenLijst.jsx), met filters + kaartweergave
    → Activiteitdetail (ActiviteitDetail.jsx)
      → Deelnemen / afmelden
      → (enkel organisator) Bewerken / Verwijderen
      → (enkel beheerder, niet-organisator) Verwijderen — zie [admin.md](admin.md)
```

`Categorieen.jsx` is het startscherm: het toont per categorie een tegel met
telling, een "eerstvolgende activiteit"-kaart voor de ingelogde gebruiker,
en een lijstje "Binnenkort op de campus". Al deze cijfers worden client-side
berekend uit dezelfde twee opgehaalde datasets (`listActivities()` en
`getMyActivities()`) — er is geen apart tellingen-endpoint.

`ActiviteitenLijst.jsx` is zowel het scherm voor "Alles" (`isOntdek`, geen
`slug`) als voor een specifieke categorie (`/activiteiten/categorie/:slug`).
Het heeft een lijst- en een kaartweergave, en vier lokale filters (zie §3).

## 2. Endpoints in `activities.py`

| Methode + pad | Rechten | Doel |
|---|---|---|
| `GET /activities` | publiek | Lijst van activiteiten, optioneel gefilterd op `category`. Verlopen activiteiten vallen weg (zie §3). Voor niet-ingelogde bezoekers bevat elk item geen deelnemersnamen (zie §2.2). |
| `GET /activities/{id}` | publiek | Detail van één activiteit. `is_joined` is enkel `true` als er een geldig token werd meegestuurd. Voor niet-ingelogde bezoekers worden organisator/deelnemers geredigeerd (zie §2.2). |
| `GET /activities/{id}/ics` | publiek | Genereert een `.ics`-bestand voor de agenda-app van de gebruiker. Zie `docs/agenda-export.md`. |
| `POST /activities` | ingelogd, niet-beheerder | Nieuwe activiteit aanmaken. De aanmaker wordt organisator én automatisch eerste deelnemer. |
| `PUT /activities/{id}` | enkel organisator | Activiteit bijwerken (zie §2.1 voor het aparte, ruimere schema). |
| `DELETE /activities/{id}` | enkel organisator | Activiteit verwijderen. |
| `POST /activities/{id}/join` | ingelogd, niet-beheerder | Inschrijven voor de activiteit. |
| `DELETE /activities/{id}/join` | ingelogd, niet-beheerder | Uitschrijven voor de activiteit. |
| `POST /activities/{id}/share` | ingelogd, 5/uur | Stuurt een uitnodigingsmail naar een willekeurig e-mailadres. |

Een beheerder (`user.is_admin`) organiseert of neemt zelf nooit deel aan
activiteiten — dat wordt niet enkel in de UI verborgen, maar ook
server-side afgedwongen: `create_activity`, `POST .../join` en
`DELETE .../join` roepen elk `_ensure_not_admin()` aan en geven een `403`
("Beheerders kunnen geen activiteiten organiseren" / "...niet deelnemen
aan activiteiten") als een beheerdersaccount het toch probeert.

Rechtencontrole gebeurt via `_ensure_organizer()` in `backend/app/routers/activities.py`:
enkel wanneer `activity.organizer_id == current_user.id` mag je bewerken of
verwijderen. Wie dat probeert zonder organisator te zijn, krijgt een `403`
met als melding *"Enkel de organisator kan deze activiteit bewerken of
verwijderen"*. Een beheerder omzeilt deze check niet via dit endpoint — die
gebruikt een apart admin-endpoint (`DELETE /admin/activities/{id}`, zie
[admin.md](admin.md)) met een verplichte reden.

### 2.1 PUT in plaats van PATCH

`update_activity` gebruikt niet hetzelfde schema als aanmaken: `POST
/activities` valideert via `schemas.ActivityCreate` (strikt — `description`
verplicht, `max_participants` minstens 2), maar `PUT /activities/{id}`
gebruikt een apart, ruimer schema `schemas.ActivityUpdate` (`description`
optioneel, `max_participants` minstens 1). Zonder dat onderscheid zou een
activiteit die van vóór deze strengere regels dateert (bv.
`max_participants=1`, of een lege beschrijving) via de UI nooit meer
bewerkbaar zijn — ook niet voor een wijziging die niets met die twee velden
te maken heeft. Het bewerkformulier (`ActiviteitForm.jsx`) stuurt wel nog
steeds altijd alle velden mee, dus blijft `PUT` een volledige vervanging,
geen gedeeltelijke `PATCH`. Bij een succesvolle bewerking krijgen alle
andere deelnemers (organisator uitgesloten) een melding
(`activiteit_bijgewerkt`); bij verwijderen krijgen ze `activiteit_verwijderd`.
Zie `backend/app/notifications.py` voor hoe die meldingen verder verwerkt worden.

### 2.2 Wat een niet-ingelogde bezoeker te zien krijgt

`GET /activities` en `GET /activities/{id}` blijven bewust bereikbaar
zonder account — rondkijken zonder in te loggen kan gewoon. Maar sinds een
privacyfix redigeert `_to_detail()` (en de preview-opbouw in
`list_activities`) namen voor wie niet ingelogd is: `organizer` wordt dan
een vaste placeholder (`{"name": "Organisator"}`) en `participants`/
`participants_preview` komen leeg terug — `participant_count`,
`location_name` en `start_time` blijven wél gewoon zichtbaar. Reden: elk
account heeft een vast schoolmailformaat
(`voornaam.achternaam@student.ehb.be`), dus een echte naam is voor eender
wie zonder account meteen om te zetten naar een echt adres. Ingelogde
gebruikers zien organisator/deelnemers wel gewoon voluit, zoals voorheen.

### 2.3 Wie is deelnemer, wie is organisator

Bij aanmaken (`create_activity`) wordt de organisator via
`db.add(models.Participation(...))` meteen ook als deelnemer geregistreerd
— hij telt dus mee in "1 / 10 deelnemers" en staat mee in de deelnemerslijst.
Er is met andere woorden geen apart concept "organisator die niet meedoet".

## 3. De "verlopen activiteiten"-filter

In `list_activities` (`backend/app/routers/activities.py`):

```python
verlopen_grens = datetime.now(timezone.utc) - timedelta(hours=1)
query = (
    db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
    .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
    .filter(models.Activity.start_time >= verlopen_grens)
    ...
)
```

Een activiteit blijft dus zichtbaar in de lijst tot **een uur ná** haar
starttijd — niet tot het exacte startmoment. Dat wordt nergens toegelicht als
zomaar een marge, maar de code laat wel zien wat de consequentie is: dit
filter zit enkel op `GET /activities` (de lijst achter Ontdek/Start/
categorieën/kaart). De activiteit zelf blijft gewoon bestaan en bereikbaar —
`GET /activities/{id}` filtert niet op tijd, dus de detailpagina, de
groepschat en de profielgeschiedenis (georganiseerd/deelgenomen) blijven
werken voor activiteiten die al (ruim) voorbij zijn. Er is dus geen
"archivering" of opruiming van oude activiteiten: ze verdwijnen enkel uit de
ontdekkingsschermen.

Let op: dit is een filter aan de **backend**-kant. De vier lokale filters in
`ActiviteitenLijst.jsx` ("Vandaag", "Deze week", "< 1 km", "Plek vrij", zie
`matchesFilter()`) werken bovenop een resultaat dat al verlopen activiteiten
mist — ze kunnen dat gedrag niet ongedaan maken.

## 4. Locatiekiezer: adres-autocomplete, kaart en afstand

### 4.1 Adres invoeren (`useAddressAutocomplete.js`)

Het locatieveld in `ActiviteitForm.jsx` gebruikt Google's (nieuwe)
Places-API rechtstreeks, niet de kant-en-klare Autocomplete-widget: die
laatste is niet meer beschikbaar voor nieuw aangemaakte Google Cloud-
projecten, dus de suggestielijst wordt hier zelf getekend
(`locatie-suggesties` in de CSS) zodat ze bij de rest van de app past. De
hook houdt drie dingen bij:

- `search(input)` — debounced met 300ms via `setTimeout`/`clearTimeout`,
  zodat niet bij elke toetsaanslag een aanvraag naar Google vertrekt (elke
  aanvraag aan de Places-API kost geld en een halve seconde typen genereert
  anders tientallen aanvragen voor niets).
- Een `AutocompleteSessionToken` wordt hergebruikt over opeenvolgende
  zoekopdrachten heen, en pas na `selectSuggestion()` weggegooid — dat is
  hoe Google's facturatie sessies afbakent: alle suggestie-aanvragen +
  de uiteindelijke plaatsdetails samen tellen dan als één sessie in plaats
  van als losse (duurdere) aanvragen.
- `selectSuggestion(suggestion)` haalt pas de volledige plaatsgegevens
  (naam, coördinaten) op nádat de gebruiker een suggestie aanklikt —
  `fetchFields()` is een aparte, betaalde aanroep, dus die gebeurt niet
  voor elke gesuggereerde optie.

Bij het kiezen van een suggestie (`handleSelectSuggestion` in
`ActiviteitForm.jsx`) worden zowel `locationName` als de kaartpositie
bijgewerkt, en pant `KaartPanner` de kaart mee naar die nieuwe positie
(`map.panTo`, want `defaultCenter` werkt enkel bij de eerste render). Een
gebruiker kan de positie ook manueel verfijnen door op de kaart te klikken
(`handleMapClick`) — het geselecteerde adres is dus een startpunt, geen
onwrikbare waarheid.

### 4.2 Afstand tot de gebruiker (`distance.js`, `useUserLocation.js`)

`useUserLocation(enabled)` roept `navigator.geolocation.getCurrentPosition`
één keer op bij het laden van een scherm (Categorieën, Activiteitenlijst,
Activiteitdetail) en geeft `null` terug bij weigering, een fout, of als de
browser geolocatie niet ondersteunt. De UI toont in dat geval gewoon geen
afstand-badge — er verschijnt geen foutmelding, want het ontbreken van een
locatie is een normale, verwachte toestand, geen probleem dat de gebruiker
moet oplossen.

Belangrijk: de hook wordt overal aangeroepen met `user?.share_location` als
`enabled`-parameter. Staat "Locatie delen" uit in de instellingen van de
gebruiker, dan wordt `navigator.geolocation` **niet eens aangesproken** —
de browser vraagt dus geen toestemming en er gebeurt geen enkele
locatie-opvraging.

Staat de instelling wel aan, dan checkt de hook eerst via de Permissions
API (`navigator.permissions.query({name: "geolocation"})`) of de browser
al een eerdere keuze onthouden heeft:
- `"granted"` → meteen `getCurrentPosition` aanroepen, geen extra stap.
- `"denied"` → bewust stil niets doen, geen dialoog (de browser zou toch
  zwijgend weigeren).
- `"prompt"` (nog geen keuze gemaakt) → toont eerst een eigen, gestylede
  uitleg (`useConfirm()` uit `ConfirmDialog.jsx`) vóórdat de niet-
  aanpasbare native browserprompt zelf verschijnt. Enkel bij "Toestaan"
  wordt `getCurrentPosition` effectief aangeroepen. Zonder dit zou de
  native prompt bij het eerste bezoek onaangekondigd opduiken, zonder dat
  de gebruiker weet waarom CampusMeetup zijn locatie wil.

Ondersteunt de browser de Permissions API niet voor deze naam (zeldzaam),
dan valt de hook terug op meteen `getCurrentPosition` aanroepen zonder
eigen dialoog — hetzelfde gedrag als voorheen.

De afstand zelf wordt berekend met de Haversine-formule
(`distanceInMeters` in `distance.js`) en in **meters** teruggegeven, niet in
kilometer: dat is de kleinste eenheid die alle schermen nodig hebben — zowel
de "< 1 km"-filter in `ActiviteitenLijst.jsx` (vergelijkt rechtstreeks met
`1000`) als de weergave-tekst. `formatDistance()` zet dat resultaat pas op
het allerlaatste moment om naar een leesbare tekst ("900 m" onder de 1 km,
anders "1,4 km" met een komma i.p.v. een punt, voor het Nederlandse
notatieformaat).

## 5. Deelnemerslimiet, "volzet" en de avatar-stapel

`max_participants` wordt bij aanmaken ingesteld (2 t.e.m. 500, afgedwongen
door Pydantic in `schemas.ActivityCreate` — minstens 2, want een activiteit
met plek voor maar 1 persoon is geen "meetup"; bij bewerken via
`schemas.ActivityUpdate` mag het ook 1 blijven, zie §2.1) en is daarna een
vast plafond.
`POST /activities/{id}/join` (zie `backend/app/routers/activities.py`)
controleert bij elke aanvraag opnieuw of `participant_count >=
max_participants`, en weigert met een `400` als de activiteit al vol zit.

```python
if participant_count >= activity.max_participants:
    raise HTTPException(status_code=400, detail="Deze activiteit zit vol")
```

Er zijn hier twee losse race-conditie-vangnetten, elk voor een ander
scenario. Vóór de capaciteitscheck haalt `join_activity` de activiteitsrij
op met `db.get(..., with_for_update=True)`: dat vergrendelt de rij voor de
duur van de transactie, zodat twee gelijktijdige aanvragen op de laatste
vrije plek elkaar niet allebei via de `participant_count`-check hierboven
kunnen glippen — de tweede wacht op de eerste en ziet dan de al bijgewerkte
telling. Om daarnaast een dubbele inschrijving (bv. een dubbelklik die twee
gelijktijdige aanvragen genereert) netjes af te handelen, staat er ook een
`UniqueConstraint` op `(user_id, activity_id)` in de database. Als die
constraint alsnog geraakt wordt ondanks de voorafgaande check, vangt de
router de `IntegrityError` op en geeft een propere `400` terug in plaats van
een kale serverfout.

Aan de frontend-kant (`ActiviteitDetail.jsx`) wordt de knop uitgeschakeld en
toont die "Volzet" zodra `participant_count >= max_participants` én de
gebruiker zelf nog niet is aangesloten (`joinDisabled`). Is de gebruiker al
aangesloten, dan blijft "Afmelden" altijd klikbaar, ook als de activiteit
ondertussen volzet is — vol-zijn mag iemand die al meedoet nooit verhinderen
om zich weer uit te schrijven.

`AvatarStack.jsx` toont de eerste 3 deelnemers als overlappende
initialen-cirkels (`getInitials()` uit `initials.js`), met een `title` per
cirkel zodat de volledige naam bij hover zichtbaar blijft. Zijn er meer dan
3 deelnemers, dan komt er een `+N`-badge bij. Die eerste 3 deelnemers per
activiteit worden in de backend in bulk opgehaald
(`_participants_preview_by_activity` in `activities.py`) als aparte query
naast de telling — een `joinedload` in dezelfde query als de `COUNT`/
`GROUP BY` zou die aggregatie verstoren, vandaar de aparte query.

## 6. Foutgevallen — overzicht

| Situatie | HTTP-status | Melding |
|---|---|---|
| Activiteit bestaat niet (detail, bewerken, verwijderen, deelnemen, afmelden, delen) | 404 | "Activiteit niet gevonden" |
| Niet-organisator probeert te bewerken of te verwijderen | 403 | "Enkel de organisator kan deze activiteit bewerken of verwijderen" |
| Beheerder probeert aan te maken, deel te nemen of af te melden | 403 | "Beheerders kunnen geen activiteiten organiseren" / "...niet deelnemen aan activiteiten" |
| Al ingeschreven en opnieuw `join` aanroepen | 400 | "Je neemt al deel aan deze activiteit" |
| Activiteit is volzet | 400 | "Deze activiteit zit vol" |
| Race condition bij gelijktijdig inschrijven (vangnet via UniqueConstraint) | 400 | "Je neemt al deel aan deze activiteit" |
| Uitschrijven terwijl je niet deelneemt | 400 | "Je neemt niet deel aan deze activiteit" |
| Ongeldige/ontbrekende velden bij aanmaken of bewerken | 422 | Pydantic-foutmelding (bv. titel te lang, `max_participants` buiten bereik) |
| Delen via e-mail mislukt (mailserver onbereikbaar e.d.) | 502 | "Kon de uitnodiging niet versturen. Probeer het later opnieuw." |
| Meer dan 5 deel-e-mails per uur | 429 | Ratelimiet-foutmelding van `slowapi` |
| Geen ingelogde gebruiker bij aanmaken/bewerken/verwijderen/deelnemen/afmelden/delen | 401 | "Kon inloggegevens niet valideren" (zie `docs/authenticatie.md`) |

## 7. Voorbeeldverzoeken

```bash
# Lijst van activiteiten, optioneel gefilterd op categorie
curl "http://localhost:8000/activities?category=Sporten"

# Detail van één activiteit
curl http://localhost:8000/activities/1

# Nieuwe activiteit aanmaken (ingelogd)
curl -X POST http://localhost:8000/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
        "title": "Voetbal op de campus",
        "description": "Vriendschappelijk potje, iedereen welkom",
        "location_name": "Sportterrein EhB",
        "latitude": 50.8466,
        "longitude": 4.3528,
        "start_time": "2026-08-20T18:00:00Z",
        "max_participants": 10,
        "category": "Sporten"
      }'

# Inschrijven voor een activiteit
curl -X POST http://localhost:8000/activities/1/join \
  -H "Authorization: Bearer <access_token>"

# Uitschrijven
curl -X DELETE http://localhost:8000/activities/1/join \
  -H "Authorization: Bearer <access_token>"

# Activiteit verwijderen (enkel organisator)
curl -X DELETE http://localhost:8000/activities/1 \
  -H "Authorization: Bearer <access_token>"
```

## 8. Gekende beperkingen (bewust, voor nu)

- Geen paginering op `GET /activities` — bij een groeiend aantal activiteiten
  haalt de frontend gewoon alles op en filtert/sorteert client-side.
- Geen wachtlijst zodra een activiteit volzet is; je krijgt enkel te horen
  dat ze vol zit.
- Verlopen activiteiten worden nergens automatisch opgeruimd of gearchiveerd
  — ze blijven voor altijd bestaan, enkel de ontdekkingsschermen filteren ze
  weg (zie §3).
- Geen bewerkingsgeschiedenis: een organisator kan een activiteit bijwerken
  zonder dat er ergens een audit trail van "wat is er precies gewijzigd"
  bijgehouden wordt — deelnemers krijgen enkel een algemene melding dat er
  iets veranderd is.
- `max_participants` kan bij bewerken ook verlaagd worden tot onder het
  huidige aantal deelnemers — er is geen check die dat verhindert; bestaande
  deelnemers worden dan niet verwijderd, maar er kunnen ook geen nieuwe meer
  bijkomen tot het aantal weer onder de nieuwe limiet zakt.
- Locatie is optioneel op schemaniveau (`latitude`/`longitude` mogen `None`
  zijn), maar het formulier dwingt in de praktijk altijd een locatie af
  (de kaart heeft steeds een positie, standaard het midden van de campus).

Dit zijn bewuste keuzes om de scope van het project behapbaar te houden,
geen vergeten punten.

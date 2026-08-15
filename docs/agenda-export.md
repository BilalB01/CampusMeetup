# Agenda-export — .ics-download en "Voeg toe aan Google Agenda"

Dit document beschrijft hoe een activiteit vanuit CampusMeetup in de eigen
agenda-app van een gebruiker terechtkomt. Er zijn twee knoppen op de
detailpagina (`ActiviteitDetail.jsx`, onder "📅 Agenda"): downloaden als
`.ics`-bestand, en een rechtstreekse link naar Google Agenda. Ze werken
allebei anders onder de motorkap.

## 1. Overzicht

```
ActiviteitDetail.jsx ("📅 Agenda"-paneel)
  ├─ 📥 Downloaden (.ics)   → <a href="{API_URL}/activities/{id}/ics">   → backend genereert het bestand
  └─ 🗓️ Google Agenda        → getGoogleAgendaUrl() in calendar.js       → puur client-side opgebouwde URL
```

Belangrijk om vooraf te verifiëren (en niet zomaar aan te nemen): het
`.ics`-bestand komt **wél** van een backend-endpoint — `GET
/activities/{id}/ics` in `backend/app/routers/activities.py` — en wordt dus
niet lokaal in de browser samengesteld. Enkel de Google Agenda-link wordt
volledig client-side gebouwd, in `frontend/src/utils/calendar.js`. Dat
onderscheid staat ook zo in het bestand zelf gedocumenteerd:

```js
// Bouwt een "Voeg toe aan Google Agenda"-link puur client-side (geen API-key
// of OAuth nodig) -- Google ondersteunt een vooringevulde-aanmaakpagina via
// URL-parameters. Het .ics-bestand zelf komt van de backend (zie
// GET /activities/{id}/ics in activities.py) voor Outlook/Apple Calendar/etc.
```

De reden voor dat onderscheid: Google Agenda ondersteunt een openbare,
vooraf ingevulde aanmaakpagina via louter URL-parameters (geen API-sleutel
of authenticatie nodig), dus daarvoor volstaat een link die de browser puur
lokaal samenstelt. Andere agenda-apps (Outlook, Apple Calendar, en Google
Agenda's eigen "importeren"-functie) hebben zo'n truc niet — daarvoor is een
downloadbaar, standaard `.ics`-bestand nodig, en dat genereren gebeurt in de
backend omdat dat de plek is waar de activiteitsgegevens toch al opgehaald
worden voor het detail-endpoint.

## 2. Het `.ics`-bestand (backend)

`GET /activities/{id}/ics` (zie `backend/app/routers/activities.py`) is
publiek toegankelijk — net als het gewone detail-endpoint — en geeft geen
JSON terug, maar een `text/calendar`-response met een
`Content-Disposition: attachment`-header, zodat de browser het meteen als
downloadbaar bestand behandelt in plaats van het te tonen.

De gegenereerde inhoud volgt het iCalendar-formaat (RFC 5545), met deze velden:

| ICS-veld | Waarde | Opmerking |
|---|---|---|
| `UID` | `activiteit-{id}@campusmeetup.ehb` | Uniek en stabiel per activiteit — agenda-apps gebruiken dit om updates van dezelfde afspraak te herkennen. |
| `DTSTAMP` | huidig moment (UTC) | Wanneer het bestand gegenereerd werd, niet wanneer de activiteit plaatsvindt. |
| `DTSTART` | `activity.start_time` (UTC) | |
| `DTEND` | `activity.start_time + 2 uur` | Zie §2.1 — er is geen einduur opgeslagen. |
| `SUMMARY` | `activity.title` | |
| `LOCATION` | `activity.location_name` | |
| `DESCRIPTION` | `activity.description` | Enkel toegevoegd als er een beschrijving is. |

Alle tekstvelden gaan door `_ics_escape()`, dat backslashes, puntkomma's,
komma's en newlines escaped zoals het ICS-formaat voorschrijft — een titel
of beschrijving met bv. een komma of puntkomma zou zonder die stap het
bestand structureel breken (die tekens hebben een speciale betekenis in
ICS-regels).

### 2.1 Waarom 2 uur duur

Er ligt geen einduur of duur opgeslagen op een `Activity` — enkel
`start_time`. Zowel het `.ics`-bestand (`ICS_STANDAARD_DUUR` in
`activities.py`) als de Google Agenda-link (`STANDAARD_DUUR_MS` in
`calendar.js`) gebruiken daarom dezelfde vaste aanname van 2 uur om een
einduur te kunnen tonen. Beide constanten staan afzonderlijk gedefinieerd
(één in Python, één in JavaScript) maar volgen bewust dezelfde waarde, zodat
een activiteit er niet verschillend uitziet naargelang je ze downloadt of
via Google Agenda toevoegt.

## 3. De Google Agenda-link (frontend)

`getGoogleAgendaUrl(activity)` in `frontend/src/utils/calendar.js` bouwt een
URL naar `https://calendar.google.com/calendar/render` met deze
querystring-parameters:

| Parameter | Waarde |
|---|---|
| `action` | `TEMPLATE` (vast — vertelt Google dat dit een vooringevulde aanmaakpagina is) |
| `text` | `activity.title` |
| `dates` | `{start}/{eind}`, in het formaat `YYYYMMDDTHHMMSSZ` (via `naarGoogleDatum()`) |
| `location` | `activity.location_name` |
| `details` | `activity.description`, enkel gezet als die er is |

`naarGoogleDatum()` zet een `Date` om naar Google's compacte UTC-notatie
door `toISOString()` te nemen en de koppeltekens, dubbele punten en
milliseconden eruit te halen (`2026-08-20T18:00:00.000Z` wordt
`20260820T180000Z`). De link opent in een nieuw tabblad
(`target="_blank" rel="noopener noreferrer"` in `ActiviteitDetail.jsx`) en
vereist dat de gebruiker al ingelogd is bij Google in die browser — er is
geen koppeling met een CampusMeetup-account nodig, want Google Agenda krijgt
enkel de kale gegevens via de URL, niets wordt teruggestuurd naar de backend.

## 4. Gekende beperkingen (bewust, voor nu)

- Vaste duur van 2 uur voor beide exportvormen — een activiteit die langer
  of korter duurt, komt met een onjuist einduur in de agenda van de
  gebruiker terecht. Er is geen veld om dat aan te passen.
- Geen herinneringen/reminders ingesteld in het `.ics`-bestand (geen
  `VALARM`-blok) — de standaardherinnering van de agenda-app van de
  gebruiker geldt.
- Geen automatische update: wijzigt een organisator de activiteit nadat
  iemand ze al aan zijn agenda toevoegde, dan verandert die reeds
  gedownloade/toegevoegde afspraak niet mee. Enkel `UID` blijft stabiel,
  dus een gebruiker die het `.ics`-bestand opnieuw downloadt en opnieuw
  importeert, kan (afhankelijk van zijn agenda-app) de bestaande afspraak
  laten bijwerken in plaats van een dubbele aan te maken — dat gebeurt niet
  automatisch vanuit CampusMeetup zelf.
- Enkel Google Agenda heeft een rechtstreekse "toevoegen"-link; voor Outlook
  of Apple Calendar moet de gebruiker altijd via het gedownloade
  `.ics`-bestand gaan.

Dit zijn bewuste keuzes om de scope van het project behapbaar te houden,
geen vergeten punten.

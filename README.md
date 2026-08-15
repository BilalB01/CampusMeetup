# CampusMeetup

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

**CampusMeetup** is een platform waarmee studenten van de Erasmushogeschool
Brussel (EHB) activiteiten kunnen organiseren en er samen aan kunnen
deelnemen — samen studeren, sporten, gamen of gewoon afspreken tussen de
lessen door. Toegang is beperkt tot studenten met een geldig
`@student.ehb.be`-adres (of een gekoppeld Microsoft-schoolaccount).

De applicatie is volledig ontwikkeld en kan zowel lokaal als via de
live omgeving getest worden.

🔗 **Live**: [campusmeetup.site](https://campusmeetup.site)
*(meteen testbaar met de kant-en-klare student-/adminaccounts hieronder
— geen registratie nodig. Zie
[Testen van de applicatie](#testen-van-de-applicatie).)*

## Inhoud

- [Functionaliteiten](#functionaliteiten)
- [Testen van de applicatie](#testen-van-de-applicatie)
- [Techstack](#techstack)
- [Architectuur](#architectuur)
- [Projectstructuur](#projectstructuur)
- [Installatie (lokaal draaien)](#installatie-lokaal-draaien)
- [Omgevingsvariabelen](#omgevingsvariabelen)
- [Beschikbare scripts](#beschikbare-scripts)
- [API-endpoints](#api-endpoints)
- [Testing Guide (PowerShell)](#testing-guide-powershell)
- [Documentatie](#documentatie)
- [Interne testaanpak](#interne-testaanpak)
- [Deployment](#deployment)
- [Beveiliging](#beveiliging)
- [Credits](#credits)

## Functionaliteiten

- **Account & login** — registreren met schoolmail (met verplichte
  e-mailbevestiging), of inloggen via het Microsoft-schoolaccount (MSAL).
  Wachtwoorden worden gehasht met bcrypt, sessies lopen via JWT.
- **Activiteiten** — aanmaken, bewerken, verwijderen, filteren per
  categorie (Sporten, Studeren, Gamen, Sociaal, Cultuur & creatief,
  Overige), deelnemen/afmelden met een harde limiet op het aantal
  plaatsen, en delen via een gedeelde link.
- **Locatie & kaart** — een locatie kiezen via Google Maps
  (adres-autocomplete), met de afstand tot de gebruiker berekend en
  getoond op de activiteitenkaarten.
- **Groepschat per activiteit** — realtime via WebSockets, inclusief
  typindicator; berichten staan **versleuteld** in de database
  (Fernet, transparant via een SQLAlchemy `TypeDecorator`).
- **Meldingen** — in-app meldingen (nieuwe deelnemer, activiteit
  aangepast/geannuleerd, nieuw bericht, ...) plus optioneel een
  meldingsmail via Resend.
- **Agenda-export** — een activiteit downloaden als `.ics`-bestand
  (Outlook/Apple Calendar) of in één klik toevoegen aan Google Agenda.
- **Badges** — live berekende profielbadges op basis van deelname-,
  organisatie- en chatactiviteit, zonder aparte databasetabel.
- **Profiel & instellingen** — naam wijzigen, wachtwoord wijzigen,
  account verwijderen, meldingsvoorkeuren.
- **Adminpaneel** — gebruikers- en activiteitenbeheer (bekijken,
  filteren, permanent verwijderen) voor beheerders, met een aparte,
  backend-afgedwongen rol die niet zelf kan deelnemen aan activiteiten.
- **Volledig responsive** — eigen mobiele (onderbalk) en desktop-lay-out
  (zijbalk/topbalk), geen simpelweg uitgerekte mobiele weergave.

## Testen van de applicatie

Twee kant-en-klare testaccounts staan al klaar — zowel lokaal als op de
live omgeving — zodat er **geen registratie nodig is** om te beginnen
testen:

| Rol | E-mail | Wachtwoord |
|---|---|---|
| Student (normale gebruiker) | `test.student@student.ehb.be` | `Testen123!` |
| Beheerder | `admin@campusmeetup.site` | `Password123!` |

Log hiermee in op [campusmeetup.site](https://campusmeetup.site), of
start de app lokaal (zie [Installatie](#installatie-lokaal-draaien)) en
gebruik dezelfde gegevens.

1. **Als student** — doorloop de kernscenario's:
   - Een activiteit aanmaken (met locatie via de kaart) en die daarna
     bewerken/verwijderen.
   - Deelnemen aan/afmelden voor een activiteit, en de deelnemerslimiet
     testen.
   - De groepschat openen en een bericht sturen (in een tweede
     browser/incognitovenster met een tweede account zie je het bericht
     live binnenkomen).
   - Een activiteit exporteren naar `.ics` of Google Agenda.
   - De profielbadges en statistieken bekijken.
   - Meldingen bekijken en "alles gelezen" gebruiken.
   - Naam/wachtwoord wijzigen via Instellingen.
2. **Als beheerder** — ga naar `/admin/gebruikers` of
   `/admin/activiteiten` om gebruikers-/activiteitenbeheer te testen.
   Er is bewust geen registratieformulier voor een beheerdersaccount
   (`is_admin` kan enkel rechtstreeks in de database gezet worden, zie
   [admin.md](docs/admin.md)) — vandaar het vaste testaccount hierboven.
3. **Een eigen, nieuw account registreren** kan ook, het makkelijkst
   **lokaal**: het e-mailadres moet het formaat
   `voornaam.achternaam@student.ehb.be` volgen (enkel letters/
   koppeltekens, geen cijfers) en het wachtwoord minstens 8 tekens met
   een hoofdletter, een cijfer en een speciaal teken bevatten. Zonder
   een `RESEND_API_KEY` in `backend/.env` wordt zo'n nieuw account
   automatisch als bevestigd aangemaakt — geen echte mailbox nodig, meteen
   inloggen. Op de live omgeving is e-mailverificatie via een echte
   `@student.ehb.be`-mailbox wel verplicht voor nieuwe accounts.

> Microsoft-login en Google Maps vereisen een eigen Azure- resp.
> Google-sleutel (zie [Omgevingsvariabelen](#omgevingsvariabelen)) en
> werken dus niet zonder die configuratie — voor het testen van de
> kernfunctionaliteit is dat niet nodig.

## Techstack

**Backend** — Python, [FastAPI](https://fastapi.tiangolo.com/),
[SQLAlchemy](https://www.sqlalchemy.org/) + [Alembic](https://alembic.sqlalchemy.org/)
(migraties), PostgreSQL, JWT (`python-jose`) + bcrypt (`passlib`),
Fernet-versleuteling (`cryptography`) voor chatberichten, WebSockets
voor realtime chat, [Resend](https://resend.com/) voor transactionele
e-mail, `slowapi` voor rate limiting op gevoelige endpoints.

**Frontend** — React 19 + Vite, React Router v6, `@azure/msal-react`
(Microsoft-login), `@vis.gl/react-google-maps`, `lucide-react`
(iconen), puur CSS (geen UI-framework).

**Infrastructuur** — [Vercel](https://vercel.com/) (frontend, CDN +
SPA-routing) en [Railway](https://railway.app/) (backend + PostgreSQL +
persistent volume voor uploads), eigen domein via Hostinger-DNS.

## Architectuur

```
Gebruiker's browser
      │
      ▼
Vercel (frontend)              ──►  Railway (backend + database)
https://campusmeetup.site           https://api.campusmeetup.site
React/Vite, statisch + CDN          FastAPI + PostgreSQL
                                     WebSockets voor chat
                                     persistent volume voor uploads
```

Frontend en backend zijn bewust twee losse services (geen monoliet die
de React-build meeserveert) — de volledige afweging staat in
[docs/deployment.md](docs/deployment.md) §2.

## Projectstructuur

```
CampusMeetup/
├── backend/
│   ├── app/
│   │   ├── main.py            → FastAPI-app, /health, /stats, /users/me/*
│   │   ├── models.py          → User, Activity, Participation, Message, Notification
│   │   ├── schemas.py         → Pydantic-schema's (request/response-validatie)
│   │   ├── security.py        → wachtwoord-hashing + JWT
│   │   ├── dependencies.py    → auth-dependencies (o.a. get_current_admin)
│   │   ├── crypto.py          → Fernet-versleuteling voor chatberichten
│   │   ├── ms_auth.py         → verificatie van Microsoft-ID-tokens (JWKS)
│   │   ├── notifications.py   → in-app meldingen + e-mail
│   │   ├── email.py           → Resend-integratie
│   │   ├── rate_limit.py      → slowapi-configuratie
│   │   ├── uploads.py         → afbeeldingen bij chatberichten
│   │   └── routers/           → auth, activities, chat (+ websocket), admin
│   └── alembic/versions/      → 12 migraties, chronologisch
├── frontend/
│   └── src/
│       ├── pages/             → route-per-scherm (Login, ActiviteitenLijst, Admin*, ...)
│       ├── components/        → Sidebar, BottomNav, ActiviteitForm, ...
│       ├── auth/               → AuthContext, ProtectedRoute, msalInstance
│       ├── notifications/     → NotificationsContext (meldingen + toasts)
│       ├── hooks/              → useActivityChat, useUserLocation, ...
│       ├── api/client.js      → alle backend-aanroepen op één plek
│       └── constants/         → categorieën, Google Maps-config
├── docs/                      → featuredocumentatie + sprintlogs (zie hieronder)
└── docker-compose.yml         → lokale PostgreSQL
```

## Installatie (lokaal draaien)

**Vereisten**: Python 3.12+, Node 20+, Docker (voor de lokale database).

### 1. Repository ophalen

```bash
git clone https://github.com/BilalB01/CampusMeetup.git
cd CampusMeetup
```

### 2. Database starten

```bash
docker compose up -d
```

Start een lokale PostgreSQL-container (`localhost:5432`, zie
`docker-compose.yml`) — geen eigen PostgreSQL-installatie nodig.

### 3. Backend opzetten en starten

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows — gebruik `source .venv/bin/activate` op macOS/Linux
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

De standaardwaarden in `.env.example` volstaan om lokaal te testen
(zie [Omgevingsvariabelen](#omgevingsvariabelen) voor wat elke
variabele doet en wat optioneel is). De API draait nu op
`http://localhost:8000` (Swagger UI op `http://localhost:8000/docs`).

### 4. Frontend opzetten en starten

Open een **nieuwe terminal**:

```bash
cd frontend
npm install
copy .env.example .env            # macOS/Linux: cp .env.example .env
npm run dev
```

De app draait nu op `http://localhost:5173`. Backend, frontend en
database zijn drie losse processen die alle drie moeten draaien.

## Omgevingsvariabelen

**`backend/.env`** (zie `backend/.env.example`):

| Variabele | Omschrijving |
|---|---|
| `DATABASE_URL` | PostgreSQL-connectiestring |
| `JWT_SECRET_KEY` | willekeurige geheime sleutel voor tokens |
| `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | tokenconfiguratie |
| `UPLOADS_DIR` | map voor chatafbeeldingen |
| `MICROSOFT_CLIENT_ID` | *(optioneel)* Azure App Registration-ID voor Microsoft-login — zonder deze geeft de Microsoft-knop een duidelijke foutmelding, de rest van de app blijft werken |
| `MESSAGE_ENCRYPTION_KEY` | Fernet-sleutel voor versleutelde chatberichten |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | *(optioneel)* e-mailverzending — zonder key wordt een nieuw account meteen als bevestigd aangemaakt (handig om lokaal te testen), en blijven meldingsmails gewoon achterwege |
| `FRONTEND_URL` | gebruikt in verificatie-/meldingsmails |
| `ALLOWED_ORIGINS` | komma-gescheiden CORS-lijst |

**`frontend/.env`** (zie `frontend/.env.example`):

| Variabele | Omschrijving |
|---|---|
| `VITE_API_URL` | adres van de backend-API |
| `VITE_GOOGLE_MAPS_API_KEY` | *(optioneel)* voor de kaart en adres-autocomplete |
| `VITE_MICROSOFT_CLIENT_ID` | *(optioneel)* zelfde Azure App Registration-ID als backend |

## Beschikbare scripts

**Backend** (in `backend/`, virtuele omgeving actief):

| Commando | Werking |
|---|---|
| `python -m uvicorn app.main:app --reload --port 8000` | dev-server met auto-reload |
| `python -m alembic upgrade head` | database-schema bijwerken naar de laatste migratie |
| `python -m alembic revision --autogenerate -m "..."` | nieuwe migratie genereren na een modelwijziging |

**Frontend** (in `frontend/`):

| Commando | Werking |
|---|---|
| `npm run dev` | dev-server (`localhost:5173`) |
| `npm run build` | productie-build naar `dist/` |
| `npm run preview` | de productie-build lokaal bekijken |
| `npm run lint` | linting via `oxlint` |

## API-endpoints

Volledige, interactieve documentatie staat op `/docs` (Swagger UI) zodra
de backend draait. Overzicht per groep:

**Auth** (`/auth`)

| Endpoint | Omschrijving |
|---|---|
| `POST /auth/register` | account aanmaken (schoolmail + wachtwoord) |
| `POST /auth/login` | inloggen, geeft een JWT terug |
| `POST /auth/verify` | e-mailadres bevestigen via het token uit de mail |
| `POST /auth/microsoft` | inloggen/registreren via een Microsoft-ID-token |

**Activiteiten** (`/activities`)

| Endpoint | Omschrijving |
|---|---|
| `POST /activities` | nieuwe activiteit aanmaken |
| `GET /activities` | lijst van activiteiten (filterbaar) |
| `GET /activities/{id}` | detail van één activiteit |
| `PUT /activities/{id}` | activiteit bewerken (enkel organisator) |
| `DELETE /activities/{id}` | activiteit verwijderen (enkel organisator) |
| `POST /activities/{id}/join` | deelnemen |
| `DELETE /activities/{id}/join` | deelname annuleren |
| `POST /activities/{id}/share` | uitnodiging versturen via e-mail |
| `GET /activities/{id}/ics` | activiteit downloaden als `.ics`-bestand |

**Chat** (`/activities/{id}`)

| Endpoint | Omschrijving |
|---|---|
| `GET /activities/{id}/messages` | berichtengeschiedenis ophalen |
| `POST /activities/{id}/messages` | bericht versturen (optioneel met afbeelding) |
| `DELETE /activities/{id}/messages/{message_id}` | eigen bericht verwijderen |
| `WS /activities/{id}/ws` | realtime chatverbinding |

**Admin** (`/admin`, enkel voor beheerders)

| Endpoint | Omschrijving |
|---|---|
| `GET /admin/users` | alle gebruikers |
| `GET /admin/users/{id}` | detail van één gebruiker |
| `DELETE /admin/users/{id}` | gebruiker permanent verwijderen |
| `GET /admin/activities` | alle activiteiten, ongefilterd op verlooptijd |
| `DELETE /admin/activities/{id}` | activiteit permanent verwijderen |

**Overig**

| Endpoint | Omschrijving |
|---|---|
| `GET /health` | health check, gebruikt door Railway |
| `GET /stats` | publieke platformstatistieken (login-/registratiescherm) |
| `GET /users/me` | ingelogde gebruiker |
| `GET /users/me/activities` | eigen georganiseerde/deelgenomen activiteiten |
| `GET /users/me/badges` | live berekende profielbadges |
| `GET /users/me/conversations` | overzicht van alle groepschats |
| `GET /users/me/notifications` | in-app meldingen |

Volledige uitleg per endpoint (autorisatieregels, statuscodes, randgevallen)
staat in de bijhorende documenten onder [`docs/`](docs/).

## Testing Guide (PowerShell)

De backend rechtstreeks testen zonder de UI — handig om snel te
controleren of alles lokaal correct draait (zie
[Installatie](#installatie-lokaal-draaien) om de backend eerst op
`localhost:8000` te starten).

**1. Registreren**

```powershell
$body = @{
    name     = "Test Student"
    email    = "test.student@student.ehb.be"
    password = "Testen123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/auth/register" `
  -Method POST -ContentType "application/json" -Body $body
```

Zonder `RESEND_API_KEY` in `backend/.env` is dit account meteen
bevestigd — geen verdere stap nodig (zie
[Testen van de applicatie](#testen-van-de-applicatie)).

**2. Inloggen en het token bewaren**

```powershell
$loginBody = @{
    email    = "test.student@student.ehb.be"
    password = "Testen123!"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" `
  -Method POST -ContentType "application/json" -Body $loginBody
$token = $login.access_token
```

**3. Een beveiligde route aanroepen**

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/users/me" `
  -Headers @{ Authorization = "Bearer $token" }
```

**4. Een activiteit aanmaken**

```powershell
$activityBody = @{
    title            = "Testactiviteit"
    description      = "Aangemaakt via de Testing Guide"
    location_name    = "EhB Campus Kaai"
    start_time       = (Get-Date).AddDays(3).ToString("o")
    max_participants = 10
    category         = "Sociaal"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/activities" -Method POST `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } -Body $activityBody
```

**5. De activiteitenlijst ophalen**

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/activities" `
  -Headers @{ Authorization = "Bearer $token" }
```

## Documentatie

Elke feature heeft een eigen, diepgaand document in [`docs/`](docs/) —
niet enkel *wat* iets doet, maar ook *waarom* het zo gebouwd is:

- [authenticatie.md](docs/authenticatie.md) — registratie, login,
  e-mailverificatie, Microsoft-login, tokens
- [activiteiten.md](docs/activiteiten.md) — CRUD, deelname, categorieën
- [chat.md](docs/chat.md) — WebSockets, versleuteling, autorisatie
- [meldingen.md](docs/meldingen.md) — in-app meldingen + e-mail
- [badges.md](docs/badges.md) — live berekende profielbadges
- [agenda-export.md](docs/agenda-export.md) — `.ics` en Google Agenda
- [admin.md](docs/admin.md) — adminpaneel en -rechten
- [profiel-en-instellingen.md](docs/profiel-en-instellingen.md) — profiel,
  instellingen, account verwijderen
- [deployment.md](docs/deployment.md) — hosting, domein, back-ups

Daarnaast een chronologische **sprintlog** per sprint
([sprint1](docs/sprint1-backend-log.md) t/m
[sprint8](docs/sprint8-log.md)) die het project van setup tot live
productie-app volgt, inclusief de afwegingen die onderweg gemaakt zijn.

## Interne testaanpak

Elke feature is bij oplevering écht getest, niet enkel aangenomen:
rechtstreeks via curl/Swagger UI voor de backend, en met
[Playwright](https://playwright.dev/) end-to-end-tests voor de volledige
gebruikersflows in de browser (registreren → e-mail bevestigen →
activiteit aanmaken → deelnemen → chatten → meldingen). Details en
resultaten per sprint staan in de sprintlogs onder `docs/`.

## Deployment

Frontend op Vercel, backend + PostgreSQL op Railway, gekoppeld aan een
eigen domein (`campusmeetup.site`) via Hostinger-DNS. Elke push naar
`main` deployt automatisch naar beide platformen. Het volledige
stappenplan — inclusief omgevingsvariabelen per platform, DNS-records
en het back-upproces voor de database — staat in
[docs/deployment.md](docs/deployment.md).

## Beveiliging

- Wachtwoorden gehasht met bcrypt, nooit in platte tekst opgeslagen.
- JWT-tokens zijn doel-gebonden (`purpose`-claim): een
  e-mailverificatietoken kan niet hergebruikt worden als inlogtoken.
- Verplichte e-mailverificatie vóór een account bruikbaar is; de
  bevestigingslink is eenmalig geldig en verloopt na 1 uur.
- Chatberichten staan versleuteld in de database (Fernet).
- Rate limiting op login/registratie tegen brute-force.
- Backend-afgedwongen autorisatie op elk gevoelig endpoint (niet enkel
  UI-elementen verbergen) — o.a. de adminrol kan zelf niet deelnemen
  aan activiteiten, en dat wordt ook server-side geblokkeerd.

Zie [docs/authenticatie.md](docs/authenticatie.md) voor de volledige
uitleg per mechanisme.

## Credits

Gemaakt door **Bilal Bouchta**, in het kader van het vak *IT Project*
(eerste semester) aan de Erasmushogeschool Brussel (EHB).

# Sprint 1 — Backend + Frontend log

Dit document beschrijft wat we in Sprint 1 hebben opgezet, zowel in
`backend/` als in `frontend/`. Staat intussen ook gewoon in git (zie de
commits) — dit is dus eerder een overzicht voor later, mocht iemand
(inclusief onszelf binnen een paar weken) willen weten wat er precies
gebeurd is en waarom we bepaalde keuzes maakten.

## 1. Wat is het doel van dit stuk?

Sprint 1 uit onze planning was: "Setup + login/registratie". Dat staat
er nu: een werkende backend (API) én een React-frontend waarmee je kan
registreren en inloggen, met een echte PostgreSQL-database erachter.

## 2. Projectstructuur

```
CampusMeetup/
├── .gitignore                  → bestanden die NIET naar git mogen (zie §5)
├── docker-compose.yml          → start PostgreSQL in een container
├── docs/
│   └── sprint1-backend-log.md  → dit bestand
├── backend/
│   ├── .env.example            → template voor geheime instellingen (WEL in git)
│   ├── .env                    → jouw echte geheime instellingen (NIET in git)
│   ├── requirements.txt        → lijst van Python-packages die nodig zijn
│   ├── alembic.ini              → configuratie voor database-migraties
│   ├── alembic/
│   │   ├── env.py               → koppelt Alembic aan onze modellen
│   │   └── versions/
│   │       └── c0e197b219f3_..._.py   → de eerste migratie (maakt de 4 tabellen aan)
│   ├── .venv/                   → Python virtual environment (NIET in git)
│   └── app/
│       ├── __init__.py
│       ├── config.py             → leest instellingen uit .env
│       ├── database.py           → verbinding met PostgreSQL (SQLAlchemy)
│       ├── models.py              → de 4 databasetabellen (User, Activity, Participation, Message)
│       ├── schemas.py             → validatie van inkomende/uitgaande JSON-data
│       ├── security.py            → wachtwoord-hashing (bcrypt) + JWT-tokens aanmaken
│       ├── dependencies.py        → controleert of een JWT-token geldig is
│       ├── main.py                → de FastAPI-app zelf, met /health en /users/me
│       └── routers/
│           └── auth.py            → /auth/register en /auth/login endpoints
└── frontend/
    ├── .env.example             → template voor VITE_API_URL (WEL in git)
    ├── package.json              → dependencies (React, react-router-dom, Vite)
    ├── node_modules/             → geïnstalleerde packages (NIET in git)
    └── src/
        ├── main.jsx               → entry point, omwikkelt de app met BrowserRouter + AuthProvider
        ├── App.jsx                → routes: /login, /register, / (beveiligd)
        ├── index.css              → basisstijlen
        ├── api/
        │   └── client.js          → fetch-wrapper die met de backend praat (register/login)
        ├── auth/
        │   ├── AuthContext.jsx    → bewaart JWT-token + gebruiker in localStorage
        │   └── ProtectedRoute.jsx → stuurt niet-ingelogde gebruikers naar /login
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Home.jsx           → voorlopig scherm na inloggen (placeholder tot Sprint 2)
            └── Auth.css           → styling voor login/registratie-schermen
```

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| **PostgreSQL via Docker** (niet native geïnstalleerd) | Zelfde database als in ons voorstel, maar makkelijker op te zetten/resetten. Zie `docker-compose.yml`. |
| **SQLAlchemy** als ORM | Vertaalt Python-klassen (`models.py`) naar SQL-tabellen, zodat we geen ruwe SQL moeten schrijven. |
| **Alembic** voor migraties | Elke wijziging aan de database wordt een apart bestand in `alembic/versions/`, traceerbaar in de git-history. |
| **JWT** voor login | Gebruiker blijft "ingelogd" zonder dat de server sessies moet bijhouden — na login krijg je een token dat je meestuurt bij elke aanvraag. |
| **bcrypt** voor wachtwoorden | Wachtwoorden staan nooit in platte tekst in de database, enkel als onomkeerbare hash. |
| **Pydantic schemas** | Foute of onvolledige data (bv. e-mail zonder @) wordt automatisch geweigerd vóór het de database bereikt. |
| **React + Vite** | Snelle dev-server, en het is wat we al kenden/wilden leren. |
| **react-router-dom** | Regelt de navigatie tussen /login, /register en / zonder de pagina te herladen. |
| **Token in localStorage** | Simpelste manier om ingelogd te blijven na een herlaad — voor een project van deze grootte is dat voldoende, geen reden om ingewikkelder te doen. |

## 4. De 4 databasetabellen (`models.py`)

- **users** — id, naam, e-mail, gehasht wachtwoord, aanmaakdatum
- **activities** — titel, beschrijving, locatienaam, latitude/longitude (voor
  Google Maps later), starttijd, max. deelnemers, organisator (link naar users)
- **participations** — koppeltabel: welke user neemt deel aan welke activity
  (voorkomt dubbel inschrijven via een unique-constraint)
- **messages** — chatberichten per activiteit (voor de groepschat later)

## 5. Wat staat er WEL en NIET in git?

`.gitignore` sluit uit:
- `.venv/` — Python-omgeving, iedereen installeert dit zelf via `requirements.txt`
- `.env` — bevat het geheime `JWT_SECRET_KEY`, mag nooit publiek
- `node_modules/` — frontend-packages, iedereen installeert dit zelf via `npm install`
- databasebestanden, logs, editor-instellingen

`.env.example` staat WEL in git (in zowel `backend/` als `frontend/`) —
templates zodat iedereen weet welke variabelen ze moeten instellen, zonder
dat de echte geheimen ergens rondslingeren.

## 6. Wat is er getest?

Alles hieronder hebben we echt uitgevoerd, niet enkel geschreven en
aangenomen dat het wel zal werken.

Backend eerst, rechtstreeks via curl en de Swagger UI (`/docs`): een
account aanmaken werkt en geeft een token terug *(dit gold voor de
registratie-endpoint van Sprint 1 — sinds de e-mailbevestiging van een
latere sprint geeft registreren enkel nog een bevestigingsbericht terug,
geen token meer; zie [authenticatie.md](authenticatie.md) §3 en §6 voor de
huidige flow)*; nog eens registreren met dezelfde mail geeft netjes een
400 met "Er bestaat al een account met dit e-mailadres"; een niet-schoolmail
(bv. een gmail-adres) of een wachtwoord korter dan 8 tekens wordt geweigerd
met een 422; inloggen met een fout wachtwoord geeft een 401 in plaats van
een gewoon account terug
te geven; en `/users/me` doet exact wat het moet — 401 zonder token of
met een vervalst token, en de juiste gebruiker terug bij een geldig
token.

Daarna hetzelfde nog eens via de echte React-app in de browser, deels
met de hand en deels automatisch met Playwright zodat we niet elke keer
alles manueel moeten herhalen: als je niet ingelogd bent stuurt `/` je
gewoon naar `/login`, registreren zet effectief een rij in de database
(gecontroleerd via de PostgreSQL-extensie in VS Code), en de
foutmeldingen bij een fout wachtwoord of een dubbel account komen netjes
in het Nederlands op het scherm terecht in plaats van een kale
API-foutcode. Uitloggen verwijdert het token en stuurt terug naar
`/login`. Geen enkele console-error ergens onderweg.

Onderweg liepen we wel tegen 1 bug aan: de nieuwste versie van het
`bcrypt`-package bleek niet compatibel met `passlib`. Opgelost door
`bcrypt` vast te zetten op versie `4.0.1` in `requirements.txt`.

## 7. Hoe start je dit zelf lokaal?

```bash
# 1. Database starten
docker compose up -d

# 2. Backend-omgeving opzetten (eenmalig)
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env

# 3. Database-tabellen aanmaken
python -m alembic upgrade head

# 4. Backend-server starten
python -m uvicorn app.main:app --reload --port 8000
```

```bash
# 5. Frontend-omgeving opzetten (eenmalig, in een nieuwe terminal)
cd frontend
npm install
copy .env.example .env

# 6. Frontend-server starten
npm run dev
```

Daarna is de API bereikbaar op `http://localhost:8000` (Swagger UI op
`http://localhost:8000/docs`), en de app zelf op `http://localhost:5173`.
Backend, frontend én database moeten alle drie draaien om de volledige
login/registratie-flow te kunnen gebruiken — het zijn 3 losse processen
die niets van elkaar afweten buiten die HTTP-verzoeken.

## 8. Wat is er nog NIET gedaan?

- Geen activiteiten-endpoints (aanmaken/lijst/deelnemen) — dat is Sprint 2
- Geen Google Maps-integratie
- Geen groepschat/WebSockets
- Geen badges
- De Figma-wireframes (Login, Registratie, Categorieën, Activiteitenlijst,
  Activiteit aanmaken, Activiteitendetail, Kaartweergave, Profiel) staan
  al klaar, maar enkel Login, Registratie en een placeholder-homepagina
  zijn effectief gebouwd in de React-app.

# Deployment — CampusMeetup online zetten

Dit document beschrijft hoe CampusMeetup in productie draait: welk stuk
waar gehost wordt, welke instellingen daarvoor nodig zijn, en waarom we
voor deze opdeling gekozen hebben i.p.v. alles op één plek.

## 1. Overzicht: wie hangt waar

```
Gebruiker's browser
      │
      ▼
Vercel (frontend)              ──►  Railway (backend + database)
https://campusmeetup.site           https://api.campusmeetup.site
React/Vite-build, statisch          FastAPI + PostgreSQL, Docker-achtige build
```

De domeinnaam zelf (gekocht via Hostinger) wordt enkel gebruikt om naar
Vercel/Railway door te wijzen via DNS — Hostinger host zelf geen code
(zie §8 voor hoe die koppeling precies staat). De originele gratis adressen
(`*.vercel.app`/`*.up.railway.app`) blijven ook nog werken, als toegevoegde
origin/redirect-doel naast het eigen domein.

## 2. Waarom twee losse platformen i.p.v. alles op één plek

We hebben bewust gekozen voor **Vercel voor de frontend + Railway voor
backend/database**, in plaats van alles op één Railway-service laten
draaien (waarbij FastAPI de gebouwde React-app zou meeserveren). Reden:

| | Twee platformen (gekozen) | Alles op 1 service |
|---|---|---|
| Build-complexiteit | Geen extra werk — elk platform herkent zijn eigen taal (Node/Vite bij Vercel, Python bij Railway) | Vraagt een eigen Dockerfile die zowel Node als Python combineert |
| Redeploy-snelheid | Een CSS-wijziging deployt op Vercel in ~15s, zonder de backend te raken | Elke frontend-wijziging herstart ook de hele Python-app |
| Snelheid voor gebruikers | Vercel serveert via een wereldwijd CDN | Alles komt van één Railway-datacenter |
| SPA-routing | Moet apart geregeld worden (zie §5) | Moet ook apart geregeld worden, plus een correcte route-volgorde in `main.py` |

Voor een project van deze grootte weegt de eenvoud van twee gespecialiseerde
platformen op tegen het "gemak" van één plek.

## 3. Backend + database op Railway

**Broncode**: Railway is gekoppeld aan de GitHub-repo (`BilalB01/CampusMeetup`)
en bouwt automatisch bij elke push naar `main`.

**Belangrijke service-instellingen** (Settings-tabblad van de backend-service):
- **Root Directory**: `/backend` — zonder dit probeert Railway's buildsysteem
  (Railpack) vanuit de hoofdmap te bouwen, waar geen `requirements.txt` staat,
  en faalt de build met "Railpack could not determine how to build the app".
- **Custom Start Command**:
  ```
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  De `alembic upgrade head` zorgt dat het databaseschema bij elke deploy
  automatisch up-to-date is — geen aparte handmatige migratiestap nodig.
  `$PORT` is een variabele die Railway zelf instelt; de app moet daarop
  luisteren, niet op een vast poortnummer.

**Environment variables** (Variables-tabblad), gebaseerd op `backend/.env.example`:

| Variabele | Waarde in productie |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — een referentie naar de Postgres-service in hetzelfde Railway-project, geen letterlijke waarde |
| `JWT_SECRET_KEY` | Eigen, willekeurig gegenereerde waarde — **niet** dezelfde als lokaal |
| `MESSAGE_ENCRYPTION_KEY` | Eigen, geldige Fernet-sleutel (`Fernet.generate_key()`) — **niet** dezelfde als lokaal |
| `JWT_ALGORITHM` | `HS256` |
| `ALLOWED_ORIGINS` | `https://campusmeetup.site,https://www.campusmeetup.site,https://campusmeetup.vercel.app,http://localhost:5173` (zie §5) |
| `FRONTEND_URL` | `https://campusmeetup.site` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Eigen Resend-account-key |
| `MICROSOFT_CLIENT_ID` | Zelfde Azure-app-id als lokaal (zie §6) |

**Database**: een aparte PostgreSQL-service binnen hetzelfde Railway-project
(`+ New` → `Database` → `Add PostgreSQL`). `DATABASE_URL` is enkel bruikbaar
*tussen* Railway-services onderling; voor een externe verbinding (bv. vanuit
een lokale VS Code PostgreSQL-extensie) gebruik je in plaats daarvan de
variabele `DATABASE_PUBLIC_URL` van de Postgres-service zelf.

**Publiek bereikbaar maken**: een nieuwe service heeft standaard geen eigen
URL ("Unexposed service"). Onder Settings → Networking → "Generate Domain"
krijg je een gratis `*.up.railway.app`-adres.

## 4. Frontend op Vercel

**Broncode**: ook hier gekoppeld aan `BilalB01/CampusMeetup`, met **Root
Directory ingesteld op `frontend`** (anders probeert Vercel zowel de
`frontend/`- als `backend/`-map als aparte services te herkennen en
allebei te deployen — dat willen we niet, de backend draait al op Railway).

**Belangrijke valkuil — Vercel GitHub App-rechten**: als de Vercel
GitHub-integratie enkel via de klassieke OAuth-koppeling loopt (zichtbaar
op github.com/settings/installations onder "Authorized GitHub Apps" i.p.v.
"Installed GitHub Apps"), biedt Vercel bij het importeren van een repo aan
om een **volledig nieuwe kopie** van die repo aan te maken i.p.v. te
koppelen aan de bestaande. Oplossing: ga naar github.com/apps/vercel →
"Configure" → geef expliciet toegang tot de `CampusMeetup`-repo. Nadien
toont het importscherm gewoon een normale "Import"-knop naast de
bestaande repo.

**Environment variables**, gebaseerd op `frontend/.env.example`:

| Variabele | Waarde in productie |
|---|---|
| `VITE_API_URL` | `https://api.campusmeetup.site` |
| `VITE_GOOGLE_MAPS_API_KEY` | Zelfde key als lokaal (zie §7 voor de domeinrestrictie) |
| `VITE_MICROSOFT_CLIENT_ID` | Zelfde Azure-app-id als lokaal |

Belangrijk: Vite-omgevingsvariabelen worden bij het **bouwen** in de
JS-bundel gebakken (niet pas bij het uitvoeren gelezen) — een wijziging
aan een `VITE_`-variabele op Vercel vereist dus altijd een nieuwe deploy
om effect te hebben.

## 5. SPA-routing en CORS

**Probleem**: een verse paginalading (bv. via een gedeelde link naar
`/activiteiten/48`, of de terugkeer van een OAuth-redirect naar `/login`)
is een normale HTTP GET-aanvraag naar dat pad. React Router regelt zulke
routes enkel *client-side* — Vercel's statische server kent geen bestand
dat letterlijk `/login` heet en gaf daardoor een 404.

**Oplossing**: `frontend/vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Elke aanvraag valt terug op `index.html`, waarna React Router zelf de
juiste route rendert.

**CORS**: de backend staat enkel verzoeken toe van origins die met
komma's gescheiden in `ALLOWED_ORIGINS` staan (zie §3 en `backend/app/main.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    ...
)
```
Zonder de juiste waarde hier weigert de browser (niet de server zelf)
de API-aanvraag stilzwijgend met een CORS-foutmelding in de console.

## 6. Microsoft-login in productie

MSAL redirect-URI's zijn domeingebonden en moeten expliciet toegevoegd
worden in het Azure-portaal (Microsoft Entra ID → App registrations →
CampusMeetup → Authentication → "Application à page unique" /
Single-page application):
```
http://localhost:5173/login   (lokale ontwikkeling)
https://campusmeetup.vercel.app/login   (productie, gratis Vercel-adres)
https://campusmeetup.site/login   (productie, eigen domein)
```
Zonder de productie-URI hier krijg je `AADSTS50011: The redirect URI ...
does not match the redirect URIs configured for the application`.

Zie [authenticatie.md](authenticatie.md) voor hoe de login-flow zelf werkt,
inclusief hoe een gebruiker na het inloggen teruggestuurd wordt naar de
pagina waar die oorspronkelijk naartoe wilde (bv. een gedeelde activiteit).

## 7. Google Maps-key voor het nieuwe domein

De Google Maps API-key heeft "Website restrictions" (HTTP-referrers).
Zonder het productie-domein toe te voegen laadt de kaart niet en toont de
app een foutmelding ("Google Maps ne s'est pas chargé correctement").

Google Cloud Console → APIs & Services → Credentials → de Maps-key →
Application restrictions → Website restrictions, toevoegen:
```
https://campusmeetup.site/*
https://campusmeetup.vercel.app/*
```

## 8. Domeinnaam koppelen (Hostinger)

De domeinnaam `campusmeetup.site` is gekocht bij Hostinger en volledig
gekoppeld aan Vercel/Railway — Hostinger host zelf geen code, enkel de
DNS. Aanpak:
1. In Vercel: project → Settings → Domains → `campusmeetup.site` (en
   `www.campusmeetup.site`) toevoegen → Vercel toont de exacte
   A/CNAME-records.
2. In Railway: backend-service → Settings → Networking → Custom Domain
   → `api.campusmeetup.site` → toont een CNAME-target + een
   TXT-verificatierecord.
3. Die records ingesteld in Hostinger's hPanel onder "Noms de domaine" →
   DNS:

   | Type | Naam | Waarde |
   |---|---|---|
   | A | `@` | `76.76.21.21` (Vercel) |
   | CNAME | `www` | `campusmeetup.site` (bestond al, werkt via deze keten mee) |
   | CNAME | `api` | het CNAME-target dat Railway toonde |
   | TXT | `_railway-verify.api` | het verificatiewaarde dat Railway toonde |

   Let op: een bestaand A-record op `@` (bv. Hostinger's eigen
   standaard-parkeerpagina-IP) moet **vervangen** worden, niet ernaast
   gezet — twee A-records op dezelfde naam maakt de site onbetrouwbaar
   bereikbaar.
4. Nadien `ALLOWED_ORIGINS`/`FRONTEND_URL` (Railway) en `VITE_API_URL`
   (Vercel) bijgewerkt naar de echte domeinnamen — de oude
   `*.vercel.app`/`*.up.railway.app`-adressen zijn niet verwijderd maar
   als extra toegelaten origin/redirect-doel laten staan, en opnieuw
   gedeployed.
5. Zowel `https://campusmeetup.site` als `https://api.campusmeetup.site`
   draaien nu met een geldig HTTPS-certificaat, automatisch uitgegeven
   door Vercel/Railway zodra de DNS-records klopten.

DNS-wijzigingen zijn hier binnen enkele minuten tot een paar uur zichtbaar
geweest (niet de theoretische 72u die providers vaak vermelden).

## 9. Herdeployen

Beide platformen zijn gekoppeld aan de `main`-branch op GitHub: een
gewone `git push` is voldoende, geen handmatige stap nodig op Railway of
Vercel zelf. Een wijziging aan een environment variable vereist wel
telkens een nieuwe deploy om effect te hebben (kan handmatig getriggerd
worden vanuit het platform zelf, zonder nieuwe commit).

## 10. Databaseback-ups

Railway's eigen automatische backups + point-in-time recovery zitten
enkel op het betalende Pro-plan (zichtbaar in Railway → Postgres-service
→ tabblad "Backups": *"Backups and point-in-time recovery (PITR) are
only available for customers on the Pro plan"*). Dit project draait op
het gratis plan, dus back-ups gebeuren handmatig:

1. Railway CLI installeren en inloggen (eenmalig):
   ```
   npm install -g @railway/cli
   railway login
   railway link
   ```
2. Een lokale tunnel naar de Postgres-service openen — dit vereist géén
   publieke database-toegang, alles loopt via een SSH-tunnel:
   ```
   railway service Postgres
   railway connect postgres --tunnel-only
   ```
   Dit toont een lokaal host/poort/wachtwoord om mee te verbinden, en
   houdt de tunnel open tot je Ctrl+C drukt.
3. `pg_dump` uitvoeren via een tijdelijke Docker-container met dezelfde
   Postgres-versie als de Railway-database (momenteel **18**, controleer
   dit via `railway status` — een pg_dump-versie die ouder is dan de
   servergeeft een foutmelding):
   ```
   docker run --rm --add-host=host.docker.internal:host-gateway \
     -v <lokale-map>:/backup postgres:18 \
     pg_dump "postgresql://postgres:<wachtwoord>@host.docker.internal:<poort>/railway" \
     -F c -f /backup/campusmeetup_backup.dump
   ```
   Terugzetten kan met `pg_restore` op dezelfde manier.
4. **Windows/Git Bash-valkuil**: zet `MSYS_NO_PATHCONV=1` vóór zo'n
   `docker run`-commando, anders herschrijft Git Bash het Unix-pad
   `/backup/...` foutief naar een Windows-pad en faalt `pg_dump` met
   "No such file or directory".

Een back-up bevat echte studentgegevens (namen, e-mails, versleutelde
chatberichten) — nooit committen naar git, enkel lokaal/extern bewaren.

## 11. Gekende beperkingen / openstaande punten

- De frontend-JS-bundel is groter dan 500 kB na minificatie (Vite-
  waarschuwing bij het bouwen) — geen functioneel probleem, wel een
  aandachtspunt voor laadtijd bij verdere groei; code-splitting zou dit
  kunnen verkleinen.

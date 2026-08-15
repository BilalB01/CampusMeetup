# Sprint 7 — Live op het internet

Vervolg op [sprint6-log.md](sprint6-log.md): de
app draaide tot dan enkel lokaal (`localhost`) — deze sprint gaat over
alles wat nodig was om ze écht online te zetten, plus twee kleine
bugfixes die tijdens dat proces aan het licht kwamen.

## 1. Sprintdoel

CampusMeetup deployen zodat medestudenten de app via een gewone
browser-URL kunnen bereiken, zonder dat iemand lokaal iets moet
opstarten. Daarnaast twee gedragsproblemen oplossen die pas écht
zichtbaar werden zodra de app niet meer op één vaste `localhost`-adres
draaide.

## 2. Nieuw in deze sprint

- **Volledige deployment**: frontend op Vercel, backend + PostgreSQL op
  Railway. Zie [deployment.md](deployment.md) voor het volledige
  stappenplan, alle omgevingsvariabelen, en de valkuilen die onderweg
  opgelost moesten worden (build-configuratie, GitHub-koppeling,
  SPA-routing, CORS, Microsoft-redirect-URI's, Google Maps-
  domeinrestrictie).
- **CORS-origins configureerbaar via `.env`** i.p.v. hardcoded
  `localhost:5173` — noodzakelijk om de API ook vanaf het
  productie-domein te laten aanspreken zonder de code te moeten
  aanpassen per omgeving.
- **SPA-routes vallen terug op `index.html`** op Vercel (`vercel.json`)
  — zonder dit gaf elke rechtstreekse/herladen navigatie naar een
  React Router-pad (bv. na een OAuth-redirect naar `/login`) een 404.
- **Na inloggen terugsturen naar de oorspronkelijk bedoelde pagina**:
  wie niet-ingelogd op een gedeelde activiteitenlink klikte, kwam
  vroeger altijd op de startpagina terecht i.p.v. op die activiteit.
  Zie [authenticatie.md](authenticatie.md) §9.4 voor hoe dat nu via
  `ProtectedRoute` + `sessionStorage` opgelost is.

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| Vercel (frontend) + Railway (backend/database) apart, i.p.v. alles op 1 service | Zie de volledige afweging in [deployment.md](deployment.md) §2 — samengevat: minder build-complexiteit, snellere redeploys, een CDN voor de statische bestanden. |
| `ALLOWED_ORIGINS` als komma-gescheiden string i.p.v. een vaste lijst in code | Dezelfde backend-code werkt dan zowel lokaal als in productie, enkel de omgevingsvariabele verschilt. |
| Bestemming-na-login via `sessionStorage` (niet enkel React Router state) | De Microsoft-login-flow verlaat de pagina volledig (`loginRedirect`) — gewone router-state zou die overgang niet overleven, `sessionStorage` wel. |

## 4. Wat is getest

Elke stap uit het deploymentproces is rechtstreeks gecontroleerd i.p.v.
enkel aangenomen dat het zou werken: `/health` en `/stats` op de
Railway-URL na deploy (bevestigt dat de migraties automatisch
uitgevoerd zijn), een CORS-preflight-verzoek met de Vercel-origin
(bevestigt de `ALLOWED_ORIGINS`-instelling), en de volledige site zelf
in de browser (registreren, inloggen — ook met Microsoft, een
activiteit bekijken, de kaart). De login-redirect-fix is met een
geautomatiseerde browsertest bevestigd: niet-ingelogd naar een
activiteitenlink surfen, inloggen, en controleren dat je op exact die
activiteit landt in plaats van op de startpagina.

## 5. Wat is nog niet gedaan

- Het eigen domein (gekocht via Hostinger) is nog niet gekoppeld — de
  app draait voorlopig op de gratis Vercel-/Railway-adressen (zie
  [deployment.md](deployment.md) §8).
- Backend/database staan nog in de VS-regio i.p.v. dichter bij België.
- De uitgebreide projectdocumentatie (dit document incluis) en een
  opgekuiste README waren op dit moment nog niet geschreven — dat is
  het onderwerp van deze documentatieronde zelf.

# Sprint 2 — Activiteiten, profiel en chat (basis)

Vervolg op [sprint1-backend-log.md](sprint1-backend-log.md): van "we
kunnen enkel inloggen" naar "we kunnen activiteiten aanmaken, bekijken,
aan deelnemen, en er samen over chatten". Voor de technische details per
feature, zie de aparte
featuredocumenten waar hieronder naar verwezen wordt — dit document
gaat over wát er in deze sprint gebouwd is en waaróm, niet over elke
regel code.

## 1. Sprintdoel

Uit de planning: "Activiteitenbeheer + profiel". De categorietegels uit
de Figma-wireframes worden hier voor het eerst echt data (i.p.v.
statisch), en er komt een eerste, ruwe groepschat per activiteit bij —
die laatste stond niet expliciet in de oorspronkelijke sprintplanning,
maar sloot qua backend-patroon (nog een databasetabel + router) goed aan
bij wat er toch al gebeurde.

## 2. Nieuw in deze sprint

- **Categorieën + activiteiten-CRUD**: `category`-kolom op `Activity`,
  volledige `activities`-router (aanmaken, lijst met categoriefilter,
  detail, deelnemen). Zie [activiteiten.md](activiteiten.md) voor de
  volledige endpoint-tabel en rechten-logica.
- **Profielscherm (eerste versie)**: `GET /users/me/activities`, met een
  opsplitsing "georganiseerd" vs. "deelgenomen" — de basis waar latere
  sprints (badges, chatoverzicht) op verder bouwen.
- **Groepschat (basis)**: `Message`-model met optionele `image_url`,
  een `ConnectionManager` voor WebSocket-broadcast, en een eerste
  chat-UI in het activiteitendetailscherm. Zie [chat.md](chat.md) voor
  hoe de WebSocket-authenticatie en afbeeldingsupload precies werken.
- **Nieuw kleurenpalet**: overstap naar een helderder, speelser palet
  i.p.v. het donkere navy-thema uit de eerste opzet — bewuste
  designkeuze, geen technische noodzaak.

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| Categorie als vrije `String`-kolom + Pydantic-`Enum` voor validatie (i.p.v. een aparte `categories`-tabel) | Er zijn maar 6 vaste categorieën uit de Figma-wireframes; een aparte tabel zou enkel overhead toevoegen zonder dat er ooit dynamisch categorieën bijkomen in deze fase. |
| `optional_oauth2_scheme` voor het detailscherm | Een activiteit bekijken hoeft geen account te vereisen (deelbare link), maar de backend moet wél weten wie de ingelogde gebruiker is *als* die er is (voor `is_joined`). |
| WebSocket i.p.v. polling voor chat | Directe, tweerichtingscommunicatie zonder dat de frontend elke paar seconden zelf moet navragen of er nieuwe berichten zijn. |
| Afbeeldingen op lokale schijf (`backend/uploads/`) i.p.v. een externe opslagdienst | Eenvoudigste opzet voor dit stadium van het project — een externe S3-achtige dienst zou een account/kost/config toevoegen zonder duidelijke meerwaarde op dit moment. |

## 4. Wat is getest

Activiteiten aanmaken/bekijken/deelnemen is zowel via curl (rechten-
checks: enkel ingelogde gebruikers kunnen aanmaken, dubbel deelnemen
wordt geweigerd door de unique constraint op `Participation`) als via de
React-app getest. De categoriefilter (`GET /activities?category=...`)
geeft enkel activiteiten van die categorie terug. De chat is manueel
getest met twee gelijktijdig geopende browservensters: een bericht
verstuurd in het ene venster verscheen meteen (zonder herladen) in het
andere.

## 5. Wat is nog niet gedaan

- Activiteiten bewerken/verwijderen (organisator-only) — dat komt in
  Sprint 3.
- Geen kaartweergave/locatiekiezer nog — activiteiten hebben al wel
  `latitude`/`longitude`-kolommen klaarstaan, maar de Google
  Maps-integratie zelf volgt in Sprint 3.
- Geen badges, geen meldingen, geen desktop-specifieke lay-out.

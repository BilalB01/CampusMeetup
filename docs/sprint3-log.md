# Sprint 3 — Kaart, bewerken/verwijderen en badges

Vervolg op [sprint2-log.md](sprint2-log.md): de
activiteiten-flow wordt afgerond (locatie op een echte kaart, bewerken
en verwijderen door de organisator), en er komt een eerste
gamification-laag bij (badges).

## 1. Sprintdoel

Uit de planning: activiteiten volledig CRUD maken (niet enkel aanmaken/
bekijken), en de kaartweergave die in de Figma-wireframes stond
effectief bouwen met Google Maps. Badges stonden niet in de
oorspronkelijke sprintplanning, maar werden deze sprint opgepakt omdat
de activiteiten-data er op dat moment al rijk genoeg voor was
(categorieën, organisator/deelnemer-onderscheid).

## 2. Nieuw in deze sprint

- **Google Maps-integratie**: `@vis.gl/react-google-maps`, een
  locatiekiezer met live adres-autocomplete bij het aanmaken van een
  activiteit, een kaartweergave in de activiteitenlijst, en een
  mini-kaart + routelink op het detailscherm. Zie
  [activiteiten.md](activiteiten.md) §locatie voor de technische details.
- **Activiteiten bewerken/verwijderen**: `PUT`/`DELETE
  /activities/{id}`, enkel toegankelijk voor de organisator. Het
  aanmaakformulier werd hierbij herleid tot een dunne wrapper rond een
  herbruikbaar `ActiviteitForm`-component, zodat bewerken en aanmaken
  dezelfde velden/validatie delen.
- **Badges-systeem**: 6 badges, live berekend (geen aparte
  databasetabel). Zie [badges.md](badges.md) voor de volledige lijst en
  de berekeningslogica.
- **Visuele afwerking**: eigen Google Fonts (Outfit + Inter), een
  avatar-stapel-component voor deelnemers, afstandsberekening tot de
  gebruiker op activiteitenkaarten, een typtekst-indicator in de chat,
  en een vaste onderaan-navigatiebalk (mobiel).

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| Eén herbruikbaar `ActiviteitForm` voor aanmaken én bewerken | Voorkomt dat validatieregels/velden op twee plekken uit elkaar groeien. |
| Enkel de organisator mag bewerken/verwijderen (backend-check, niet enkel UI) | De UI verbergt de knoppen voor niet-organisatoren, maar de backend controleert het zelf ook — anders zou een aanvraag rechtstreeks via curl de regel omzeilen. |
| Badges live berekend i.p.v. bijgehouden per gebruiker | Geen achtergrondjob of "badge toegekend"-moment nodig; de voorwaarde wordt gewoon elke keer opnieuw getoetst aan de echte tellingen. Zie ook [badges.md](badges.md). |
| Afstand in meters intern, pas bij het tonen omgezet naar km | Vermijdt afrondingsfouten die zouden optreden als er al vroeg in km gerekend werd. |

## 4. Wat is getest

Bewerken/verwijderen: geprobeerd als niet-organisator (backend weigert
met een foutstatus, geen 200 die de UI dan zelf zou moeten verbergen),
en als organisator (wijzigingen komen echt aan). De locatiekiezer:
adres intypen toont voorstellen, een voorstel kiezen zet de kaart en de
verborgen latitude/longitude-velden correct. Badges: een testaccount
liet stap voor stap de voorwaarden waarmaken (activiteit organiseren,
deelnemen aan iemand anders z'n activiteit, chatberichten versturen) en
elke badge sloeg op het juiste moment om van "niet verdiend" naar
"verdiend".

## 5. Wat is nog niet gedaan

- Nog geen Microsoft-login, nog geen desktop-specifieke lay-out (alles
  is nog mobiel-eerst).
- Nog geen meldingensysteem — badges/activiteiten-wijzigingen genereren
  op dit punt nog geen enkele melding.
- Chatberichten staan nog onversleuteld in de database (komt in Sprint 4).

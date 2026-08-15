# Sprint 6 — Sterkere wachtwoorden, agenda-export en het adminpaneel

Vervolg op [sprint5-log.md](sprint5-log.md): een
kleinere beveiligingsverstrenging, een handige extra (activiteiten in je
eigen agenda zetten), en de grootste nieuwe feature sinds de eerste
sprints — een volwaardig beheerdersgedeelte.

## 1. Sprintdoel

Na overleg over wat een beheerder van het platform zou moeten kunnen
(gebruikers/activiteiten bekijken en, indien nodig, permanent
verwijderen), is die scope deze sprint effectief gebouwd. Daarnaast twee
kleinere, onafhankelijke stukken: strengere wachtwoordeisen, en een
manier om een activiteit rechtstreeks in je eigen agenda te zetten.

## 2. Nieuw in deze sprint

- **Sterkere wachtwoordeis**: minstens 8 tekens, met minstens 1
  hoofdletter, 1 cijfer en 1 speciaal teken — afgedwongen op zowel
  registratie als wachtwoord-wijzigen, zowel backend (Pydantic-
  validator) als frontend (directe feedback op het formulier).
- **Agenda-export**: een `.ics`-download en een Google Agenda-link per
  activiteit. Zie [agenda-export.md](agenda-export.md) voor hoe beide
  precies opgebouwd worden.
- **Adminpaneel** (grootste stuk van deze sprint): een `is_admin`-veld
  op gebruikers, een beveiligde `/admin`-routerlaag, en drie
  beheerschermen (dashboard, gebruikers, activiteiten) met permanente
  verwijdering — inclusief een verplichte reden bij het verwijderen van
  een activiteit, die de deelnemers als melding te zien krijgen. Zie
  [admin.md](admin.md) voor de volledige uitleg, inclusief de
  cascade-volgorde bij verwijderen en welke keuzes bewust open gelaten
  zijn (bv. kan een beheerder een andere beheerder verwijderen).
- Kleine polish: badge-tegels herstijld met een eigen kleur/gloed per
  badge en een eigen tooltip, en een nieuwe intro-animatie op het
  login-/registratiescherm.

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| `is_admin` als simpele boolean op `User`, geen aparte rollentabel | Er zijn op dit moment maar twee niveaus (gewone gebruiker/beheerder) — een volwaardig rollensysteem zou voor deze scope overbouwd zijn. |
| Geen UI om iemand admin te maken, enkel handmatig via SQL | Bewuste, tijdelijke vereenvoudiging: het eerste beheerdersaccount is een uitzonderlijke, zeldzame actie, geen dagelijkse workflow die een eigen scherm verdient. |
| Verwijderen door een beheerder is **permanent**, niet enkel uit de lijst gefilterd | Expliciete keuze, in tegenstelling tot de "verlopen activiteiten"-filter uit Sprint 5 — als een beheerder ingrijpt, moet dat ook echt iets betekenen. |
| Verplichte reden bij het verwijderen van een activiteit door een beheerder | Deelnemers krijgen anders een melding zonder enige context over waarom hun activiteit plots weg is. |
| Wachtwoordsterkte-check als losse functie, gedeeld tussen `UserCreate` en `PasswordChange` | Voorkomt dat de regel op twee plekken (registreren, wachtwoord wijzigen) uit elkaar zou kunnen groeien. |

## 4. Wat is getest

Adminpaneel: een niet-beheerder die naar `/admin/...` navigeert wordt
teruggestuurd; een beheerder ziet enkel Gebruikers/Activiteiten in de
zijbalk (geen Start/Ontdek/Chats — een beheerder neemt zelf niet deel).
Een gebruiker verwijderen: de rij verdwijnt en blijft weg na een
herlaad, geen weesrijen achtergebleven in gekoppelde tabellen. Een
activiteit verwijderen zonder reden op te geven: geweigerd met een
duidelijke melding; mét reden: de deelnemers (inclusief de organisator
zelf, die normaal niet uitgesloten wordt zoals bij een gewone
"deelnemer verlaat activiteit"-melding) krijgen de reden te zien.
Wachtwoordeisen: een zwak wachtwoord (bv. enkel kleine letters) wordt op
zowel het formulier als de backend geweigerd, zelfs als iemand de
frontend-check zou omzeilen door rechtstreeks naar de API te posten.

## 5. Wat is nog niet gedaan

- Geen "beheerder voegt handmatig een gebruiker toe" — registratie
  blijft volledig self-service via het schoolmailadres.
- De app draaide op dit punt nog enkel lokaal — deployment volgt in
  Sprint 7.

# Sprint 5 — Meldingen, beveiliging en een donker thema

Vervolg op [sprint4-log.md](sprint4-log.md): het volledige
meldingensysteem komt erbij, samen met een reeks beveiligings- en
stabiliteitsverbeteringen en een grondige visuele herstijling.

## 1. Sprintdoel

De app werkte tot nu toe "stil" — een nieuwe deelnemer of chatbericht
leverde geen enkel signaal op tenzij je toevallig het scherm ververste.
Deze sprint bouwt het volledige meldingensysteem (in-app + e-mail), en
neemt daarnaast een aantal beveiligings- en robuustheidspunten mee die
zich tijdens het testen opstapelden (rate limiting, foreign
key-gedrag, tokenverificatie).

## 2. Nieuw in deze sprint

- **Meldingensysteem**: `Notification`-model, een centrale
  `create_notification`-helper, e-mailverzending via Resend (met
  `truststore` voor correcte TLS-verificatie), een meldingencentrum-
  scherm, toast-pop-ups, en per-type meldingsvoorkeuren op het
  Instellingen-scherm. Zie [meldingen.md](meldingen.md) voor de
  volledige lijst meldingstypes en hoe elk kanaal aan/uit kan.
- **Activiteit delen via e-mail**: een deel-paneel met een optioneel
  bijschrift, verstuurd naar een willekeurig e-mailadres (geen account
  nodig om de gedeelde activiteit te bekijken).
- **Rate limiting**: op login (brute-force tegengaan) en op het
  delen-endpoint (voorkomt dat het misbruikt wordt als gratis
  e-mail-relay).
- **Token bij elke paginawissel echt verifiëren** bij de backend i.p.v.
  enkel controleren of er lokaal een token-string in `localStorage`
  staat.
- **Dark-theme herstijling** van de activiteitenkaarten en het
  detailscherm, met een systeembrede "populairste activiteiten"-sectie
  in de zijbalk.
- **Verlopen activiteiten (>1u na starttijd) uit de lijsten gefilterd**
  — ze blijven in de database bestaan, enkel de weergave verandert (zie
  ook het onderscheid met écht/permanent verwijderen in
  [admin.md](admin.md)).

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| Eén centrale `create_notification`-helper i.p.v. losse code per meldingstype | Elke melding volgt dezelfde stappen (in-app-rij aanmaken + optioneel een e-mail versturen als de gebruiker dat kanaal niet uitgeschakeld heeft) — één plek houdt dat consistent. |
| E-mailen via Resend, met een optionele API-key | De app moet blijven werken (enkel in-app meldingen, geen crash) als er geen `RESEND_API_KEY` ingesteld is — handig tijdens lokale ontwikkeling zonder een echt e-mailaccount te moeten koppelen. |
| Rate limiting per IP (`slowapi`) i.p.v. per account | Een brute-force-poging gebruikt vaak nog geen bestaand account — beperken op IP-niveau werkt ook tegen pogingen met willekeurige/geraden e-mailadressen. |
| "Verlopen" = enkel uit de lijst filteren, niet verwijderen | De data blijft nuttig (bv. voor een organisator die zijn geschiedenis wil zien, of voor een beheerder) — een activiteit die voorbij is, is niet hetzelfde als een activiteit die nooit had mogen bestaan. |

## 4. Wat is getest

Meldingen: een tweede browsercontext als deelnemer bevestigde dat een
nieuwe-deelnemer-melding en een chatbericht-melding aankomen, zowel
in-app als (met een echte Resend-testkey) als e-mail. Meldingsvoorkeuren
uitschakelen: geen e-mail meer, in-app melding blijft wel komen (of
omgekeerd, per instelling). Rate limiting: herhaaldelijk foute
inloggegevens sturen gaf na een aantal pogingen een `429`
in plaats van telkens gewoon een `401`. Verlopen-filter: een activiteit
met een starttijd in het verleden verdween uit `GET /activities`, maar
bleef gewoon opvraagbaar via zijn eigen detail-URL.

Onderweg liepen we tegen twee databasegerelateerde problemen aan: de
foreign key van `Notification.user_id` stond niet op `ON DELETE
CASCADE`, waardoor een account met openstaande meldingen niet
verwijderd kon worden — hersteld met een aparte migratie. En het
verwijderen van een activiteit met bijhorende meldingen liep tegen een
gelijkaardig foreign-key-probleem aan, opgelost door `activity_id` op
`ON DELETE SET NULL` te zetten (de melding zelf blijft dan bestaan, de
dode verwijzing naar de verwijderde activiteit verdwijnt gewoon).

## 5. Wat is nog niet gedaan

- Nog geen adminrol/adminpaneel.
- Nog geen agenda-export (.ics/Google Agenda).
- Wachtwoordeisen waren op dit punt nog enkel "minstens 8 tekens" —
  de striktere eis (hoofdletter/cijfer/speciaal teken) komt in Sprint 6.

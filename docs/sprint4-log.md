# Sprint 4 — Microsoft-login en desktop-ervaring

Vervolg op [sprint3-log.md](sprint3-log.md): de
app werkt tot dan enkel goed op mobiel formaat en heeft maar één
inlogmethode — deze sprint pakt beide aan.

## 1. Sprintdoel

Twee grote, onafhankelijke stukken werk die toevallig dezelfde dag
gebeurden: "Inloggen met Microsoft" toevoegen als alternatief voor het
gewone wachtwoord-account, en een echte desktop-lay-out (zijbalk,
topbalk, meerkoloms schermen) i.p.v. de mobiele lay-out simpelweg
uitgerekt op een breed scherm.

## 2. Nieuw in deze sprint

- **Inloggen met Microsoft**: MSAL (`@azure/msal-react`), een
  redirect-gebaseerde loginflow, en backend-verificatie van het
  Microsoft-ID-token via JWKS (`ms_auth.py`). Zie
  [authenticatie.md](authenticatie.md) §9 voor de volledige uitleg,
  inclusief hoe bestaande/nieuwe gebruikers gekoppeld worden.
- **Desktop-navigatie**: een vaste zijbalk + topbalk vanaf 900px
  schermbreedte, met meerkoloms lay-outs voor Start/Ontdek/Detail/
  Profiel/Nieuw — de mobiele onderbalk uit Sprint 3 blijft eronder
  bestaan.
- **Instellingen-scherm**: naam bewerken, wachtwoord wijzigen, account
  verwijderen — allemaal vanuit één scherm i.p.v. verspreid.
- **Chatberichten versleuteld in de database** (zie [chat.md](chat.md)
  §versleuteling) en een **chatoverzicht-scherm** met alle
  groepschats + ongelezen-tellers in één lijst.
- **Skeleton-loaders en kleine animaties** (kaart-intrede, tab-morph,
  optellende cijfers) i.p.v. een kale laadstatus.

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| Redirect-flow i.p.v. pop-up voor Microsoft-login | Pop-ups worden vaak geblokkeerd door de browser, zeker in privévensters — een redirect werkt overal hetzelfde. |
| Backend verifieert het Microsoft-ID-token zelf nog eens (JWKS) | De frontend kan niet zomaar vertrouwd worden om te zeggen "deze gebruiker is ingelogd via Microsoft" — de backend moet de handtekening van het token zelf tegen Microsoft's publieke sleutels controleren. |
| 900px als omslagpunt tussen mobiel/desktop-lay-out | Komt overeen met waar de meerkoloms-schermen genoeg breedte hebben zonder geknepen aan te voelen — geen standaard framework-breakpoint, een eigen keuze op basis van hoe de schermen er in de praktijk uitzagen. |
| Berichten versleuteld via een SQLAlchemy `TypeDecorator` (`EncryptedText`) | Versleuteling gebeurt transparant bij elke schrijf/leesactie — de rest van de code (routers, schemas) behandelt `content` gewoon als een normale string-kolom. |

## 4. Wat is getest

Microsoft-login: een account aanmaken via Microsoft, uitloggen,
opnieuw inloggen — komt terug bij dezelfde gebruiker. Geprobeerd in te
loggen met een e-mailadres dat al een gewoon wachtwoord-account heeft:
gaf op dat moment een duidelijke foutmelding i.p.v. een dubbel account
*(dit gedrag is later bewust omgedraaid — sinds een latere sprint logt
Microsoft-login in dat geval gewoon in op het bestaande account, precies
om te vermijden dat dezelfde student per ongeluk twee accounts krijgt;
zie [authenticatie.md](authenticatie.md) §9.2)*. Desktop-lay-out:
manueel getest op meerdere schermbreedtes (900px-grens, breder), en
gecontroleerd dat de mobiele onderbalk enkel onder 900px zichtbaar
blijft. Berichtversleuteling: rechtstreeks in de database gekeken
(via de PostgreSQL-extensie) dat `content` er als onleesbare
cijfertekst in staat, niet als platte tekst.

## 5. Wat is nog niet gedaan

- Nog geen meldingensysteem (in-app of e-mail) — dat is Sprint 5.
- Nog geen dark-theme herstijling van de activiteitenkaarten/detailscherm.
- Nog geen rate limiting op login — een brute-force-poging op
  `/auth/login` was op dit punt nog niet afgeremd.

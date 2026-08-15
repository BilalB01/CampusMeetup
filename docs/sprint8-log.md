# Sprint 8 — Beveiliging, codekwaliteit en een eigen domein

Vervolg op [sprint7-log.md](sprint7-log.md): de app draaide sinds vorige
sprint live op de gratis Vercel-/Railway-adressen, maar nog zonder
grondige beveiligingscontrole, zonder eigen domein, en zonder back-ups.
Deze sprint gaat over al die openstaande punten samen: twee volledige
reviewrondes (beveiliging en codekwaliteit), het eigen domein koppelen,
een back-upproces opzetten, en alles daarna end-to-end verifiëren.

## 1. Sprintdoel

Zeker zijn dat de app niet enkel *werkt*, maar dat ook grondig
gecontroleerd is: geen kwetsbaarheden die over het hoofd gezien zijn,
geen rommelige of dubbel geschreven code, een domein dat professioneel
oogt in plaats van een gratis platformadres, en een manier om de
productiedata te herstellen mocht er ooit iets misgaan.

## 2. Nieuw in deze sprint

- **Beveiligingsreview, twee rondes**: eerst een scope beperkt tot de
  recente wijzigingen, daarna een volledige doorlichting van het hele
  project (meerdere deelreviews parallel, elke bevinding nadien apart
  geverifieerd vóór ze als "bevestigd" telde). Concrete kwetsbaarheden
  die daaruit gefixt zijn:
  - Het e-mailbevestigingstoken kon als een volwaardig inlogtoken
    misbruikt worden op elke beveiligde route — nu expliciet geweigerd
    via een `purpose`-veld-check. Zie [authenticatie.md](authenticatie.md) §5.
  - Diezelfde bevestigingslink werkte bij élke opening opnieuw (tot 24u
    lang) i.p.v. één keer, en liep via een kale `GET` die door
    linkscanners vroegtijdig geopend kon worden. Nu een eenmalige `POST`,
    geldig 1u i.p.v. 24u. Zie [authenticatie.md](authenticatie.md) §6.
  - `register()` kon een account permanent onbruikbaar achterlaten als de
    bevestigingsmail niet verstuurd kon worden. Nu atomisch: pas
    definitief opgeslagen ná een geslaagde verzending. Zie
    [authenticatie.md](authenticatie.md) §3.
  - `GET /activities` en `GET /activities/{id}` toonden deelnemersnamen
    aan eender wie, ook zonder account — bij het vaste schoolmailformaat
    is een naam meteen om te zetten naar een echt adres. Nu geredigeerd
    voor niet-ingelogde bezoekers. Zie [activiteiten.md](activiteiten.md) §2.2.
  - Een beheerder kon via een rechtstreekse API-aanroep nog altijd
    deelnemen aan of activiteiten organiseren, ook al verborg de UI die
    knoppen al. Nu ook backend-side geblokkeerd. Zie
    [activiteiten.md](activiteiten.md) §2 en [admin.md](admin.md) §5.
  - De chat-WebSocket controleerde deelname enkel bij het verbinden, niet
    nog eens nadien — wie een activiteit verliet terwijl de chat
    openstond, kon in theorie blijven meepraten. Nu een hercontrole per
    binnenkomend bericht. Zie [chat.md](chat.md) §2.
- **Codekwaliteitsreview**, zelfde aanpak (parallelle deelreviews +
  verificatie), gericht op correctheidsbugs en dubbele code i.p.v.
  beveiliging. Belangrijkste fixes:
  - De terug-knop op de gebruikersdetailpagina van het adminpaneel
    verloor zijn terugvalbestemming zodra de pagina klaar was met laden.
  - `login()` vergeleek e-mailadressen hoofdlettergevoelig, waardoor een
    andere schrijfwijze dan bij registratie ten onrechte "ongeldig
    account" gaf.
  - Het admin-activiteitenscherm toonde nooit deelnemersavatars (wel op
    de gebruikersdetailpagina — een vergeten stap in een bijna-identieke
    functie).
  - Een gebruiker via het adminpaneel verwijderen liet diens activiteiten
    stilletjes verdwijnen, zonder de andere deelnemers te verwittigen.
  - Een timerbug in de meldingen-toasts: bij elke nieuwe toast werd de
    sluittimer van alle al zichtbare toasts gereset, waardoor sommige
    veel langer dan de bedoelde 6 seconden bleven staan.
  - "Alles gelezen" bij meldingen had geen terugval bij een mislukte
    serveraanroep — de UI bleef dan "alles gelezen" tonen ook al was de
    aanvraag mislukt.
  - Een race condition liet in theorie meer mensen tot een activiteit toe
    dan de ingestelde limiet, bij twee gelijktijdige aanmeldingen op de
    laatste vrije plek.
  - Verspreide, dubbel geschreven code samengevoegd: een gedeelde
    query-helper voor georganiseerde/deelgenomen activiteiten (eerst
    apart in `main.py` én `admin.py`, nu één functie), een gedeelde
    `ActivityBase`-basisklasse voor de activiteitenschema's, gedeelde
    tab-definities tussen `Sidebar.jsx`/`BottomNav.jsx`, een
    `capitalize()`-hulpfunctie i.p.v. dezelfde regel op 4 plekken, en een
    `_ensure_not_admin()`-hulpfunctie i.p.v. diezelfde check 3 keer
    uitschrijven.
  - `pool_pre_ping` toegevoegd aan de databaseverbinding — Railway sluit
    soms zelf inactieve connecties, wat zonder deze instelling als een
    onverwachte serverfout op de eerstvolgende query naar boven kwam.
- **Eigen domein gekoppeld**: `campusmeetup.site` (Vercel voor de
  frontend, `api.campusmeetup.site` voor de backend via Railway),
  inclusief de bijhorende aanpassingen aan Microsoft's redirect-URI's en
  de Google Maps-domeinrestrictie. Zie [deployment.md](deployment.md) §8.
- **Databaseback-ups**: Railway's eigen automatische back-ups zitten
  enkel op het betalende Pro-plan. In de plaats daarvan een handmatig
  proces opgezet via de Railway CLI en een lokale SSH-tunnel — geen
  publieke databasetoegang nodig. Zie [deployment.md](deployment.md) §10.
- **Persistente opslag voor chatafbeeldingen**: een echt Railway Volume
  gekoppeld aan de uploads-map op de backend-service. Voordien gingen
  geüploade afbeeldingen verloren bij elke herdeploy.
- **Documentatie herzien**: elk featuredocument en alle sprintlogs
  (inclusief Sprint 1) herlezen en waar nodig bijgewerkt naar de huidige
  code — dit document zelf is daar het sluitstuk van.

## 3. Technische keuzes en waarom

| Keuze | Waarom |
|---|---|
| Bevindingen pas als "bevestigd" tellen na een aparte verificatiestap, niet enkel op het eerste vermoeden | Een eerste inschatting overschat soms de ernst (of mist net context, zoals een bewuste designkeuze die op het eerste gezicht een bug lijkt) — een tweede, onafhankelijke blik filtert dat eruit vóór er iets aangepast wordt. |
| `ActivityUpdate` als apart, ruimer schema i.p.v. `ActivityCreate` overal hergebruiken | De strengere regels (verplichte beschrijving, minstens 2 deelnemers) golden plots ook bij het bewerken van activiteiten die van vóór die regel dateerden — zonder het aparte schema werden die onbewerkbaar. |
| Back-ups via een SSH-tunnel (`railway connect --tunnel-only`) i.p.v. de database publiek bereikbaar maken | Geen extra publieke toegangspunt nodig enkel om af en toe een dump te trekken. |
| Chat-WebSocket herchecked deelname per bericht i.p.v. de verbinding meteen te sluiten bij het verlaten van een activiteit | Eenvoudiger te implementeren binnen de bestaande route, en dekt het praktische risico (nog berichten kunnen sturen) volledig af; het venster waarin nog binnenkomende berichten ontvangen kunnen worden blijft een bewust aanvaarde restbeperking. |

## 4. Wat is getest

Voor de beveiligings- en codekwaliteitsfixes: elke bevestigde bevinding
apart met een verse lokale backend-instantie getest (niet enkel de code
herlezen) — o.a. dat een verificatietoken effectief geweigerd wordt op
een beveiligde route, dat een normale `join`/capaciteitscheck nog gewoon
werkt na de race-conditiefix, en dat een beheerder nog steeds overal
geblokkeerd wordt. Na alle fixes samen een volledige, geautomatiseerde
eind-tot-eindtest op een lokale omgeving: registreren, e-mail bevestigen,
een activiteit aanmaken (met de echte formuliervalidatie), deelnemen,
chatten tussen twee gebruikers (inclusief typtekst-indicator), meldingen
ontvangen en "alles gelezen" gebruiken, naam wijzigen, terug-knop-
navigatie, een activiteit bewerken/verlaten/verwijderen, uitloggen en
opnieuw inloggen — 26 controles, allemaal geslaagd, geen consolefouten.
Het adminpaneel apart getest: gebruikers-/activiteitenlijst, de
terug-knop-fix, de nieuw gevulde deelnemersavatars, en de melding bij het
verwijderen van een gebruiker met een georganiseerde activiteit.

Voor het domein: na het instellen van de DNS-records bij Hostinger
gecontroleerd dat zowel `campusmeetup.site` als `api.campusmeetup.site`
een geldig HTTPS-certificaat kregen en effectief de juiste inhoud
teruggaven, en dat de Microsoft-loginknop op het nieuwe domein exact de
`redirect_uri` meestuurt die in Azure geregistreerd staat.

Voor de back-up: een echte dump van de productiedatabase gemaakt en
achteraf gecontroleerd (`pg_restore --list`) dat alle tabellen er
geldig in zaten.

## 5. Wat is nog niet gedaan

- Enkele bevindingen uit de reviews haalden de drempel om als
  "bevestigd" te gelden niet, maar bleven wel dicht in de buurt — zoals
  het feit dat het chat-/verificatietoken als querystring-parameter
  meegaat (en dus in serverlogs kan belanden) en een kleine
  content-injectiemogelijkheid in de `.ics`-kalenderexport. Bewust niet
  aangepakt deze sprint, maar het waard om op te volgen.

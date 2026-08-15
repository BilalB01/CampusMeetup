# Profiel & instellingen — het eigen account beheren

Dit document beschrijft het profielscherm en het instellingenscherm: wat
een gebruiker daar ziet, welke endpoints erachter zitten, en waarom een
paar dingen (wachtwoord wijzigen, account verwijderen) net zo in elkaar
zitten. Het gaat ook kort in op de algemene navigatie (zijbalk/onderbalk)
en de kleine UI-bouwstenen die beide schermen gebruiken, want die leven
in dezelfde map als deze twee pagina's.

Betrokken bestanden:

```
frontend/src/pages/Profiel.jsx
frontend/src/pages/Instellingen.jsx
frontend/src/components/Sidebar.jsx
frontend/src/components/BottomNav.jsx
frontend/src/components/TopBar.jsx
frontend/src/components/Skeleton.jsx
frontend/src/components/StartStatKaart.jsx
frontend/src/components/StatTegel.jsx
frontend/src/hooks/useCountUp.js
frontend/src/utils/nav.js
backend/app/main.py   (de /users/me/...-routes)
```

## 1. Kort overzicht

Beide schermen zitten achter `ProtectedRoute` (elke ingelogde gebruiker,
geen `adminOnly`). Het profielscherm is puur lezen; het instellingenscherm
heeft vijf onafhankelijke secties die elk hun eigen stukje state en hun
eigen endpoint hebben — er is geen gedeeld "opslaan"-formulier voor alles
tegelijk.

| Sectie | Endpoint |
|---|---|
| Activiteiten + badges (profiel) | `GET /users/me/activities`, `GET /users/me/badges` |
| Naam wijzigen | `PATCH /users/me` |
| Wachtwoord wijzigen | `PUT /users/me/password` |
| Meldingsvoorkeuren | `PUT /users/me/notification-preferences` |
| Locatie delen | `PUT /users/me/location-preference` |
| Account verwijderen | `DELETE /users/me` |

## 2. Het profielscherm

`Profiel.jsx` haalt bij het laden twee dingen op: `getMyActivities` en
`getMyBadges` (beide met het eigen token, geen parameter — het gaat altijd
over de ingelogde gebruiker).

- **Kop**: avatar (eerste letter van de naam, want er is geen fotoupload),
  naam, e-mailadres.
- **Statistiektegels** (`StatTegel`, zie §8): "Georg." (aantal
  georganiseerd), "Gedaan" (aantal met `start_time` in het verleden) en
  "Deze week" (`start_time` tussen nu en +7 dagen). Deze drie tellingen
  worden client-side berekend uit de al opgehaalde `organized`/`joined`-
  lijsten samen — er is geen apart statistiekenendpoint voor.
- **Tabs "Georganiseerd"/"Deelgenomen"**: de backend (`read_my_activities`
  in `main.py`) splitst dit al server-side in twee lijsten. "Deelgenomen"
  sluit bewust de eigen georganiseerde activiteiten uit: een organisator
  wordt bij het aanmaken automatisch ook deelnemer van zijn eigen
  activiteit, dus zonder die uitsluiting zou dezelfde activiteit in beide
  tabs opduiken.
- **Statuslabel per item** ("Vandaag"/"Actief"/"Voorbij"): puur afgeleid
  van `start_time` ten opzichte van het huidige moment, client-side
  (`statusLabel()` in `Profiel.jsx`) — er is geen apart databaseveld voor
  de status van een activiteit.
- **Badges**: `GET /users/me/badges` berekent bij elke aanvraag live of
  een badge verdiend is (geen aparte databasetabel of achtergrondjob). De
  volledige lijst badges, hun voorwaarden en de berekening zelf staan
  beschreven in [badges.md](badges.md) — die logica wordt hier niet
  herhaald. Wat wel hier leeft: het kleurenpalet per badge
  (`BADGE_KLEUREN` in `Profiel.jsx`) is losstaand van het categorie-
  kleurenpalet (`constants/categories.js`) en wordt enkel toegepast zodra
  een badge effectief `earned` is — een nog niet verdiende badge krijgt de
  neutrale `badge-tegel--onverdiend`-stijl.
- **Beheerder ziet een volledig ander, korter scherm**: is `user.is_admin`
  waar, dan doet `Profiel.jsx` een vroegtijdige `return` met een apart
  render-blok — geen statistiektegels, geen badges, geen "Georganiseerd"/
  "Deelgenomen"-tabs (die data wordt voor een beheerder zelfs niet
  opgehaald, de `useEffect` stopt er meteen mee) en ook **geen**
  "Instellingen"-pil. Enkel avatar + naam/e-mail, de pillen "Gebruikers
  beheren" en "Activiteiten beheren" (zie [admin.md](admin.md)) en de
  uitlogknop, gevolgd door `InstellingenSecties` (zie §5/§6) die
  rechtstreeks op deze pagina ingesloten wordt. Voor een beheerder zijn
  "profiel" en "instellingen" dus letterlijk hetzelfde scherm.

## 3. Instellingen: naam wijzigen

Eenvoudigste sectie: een tekstveld, `PATCH /users/me` met
`{"name": "..."}` (backend-validatie: 1–100 tekens via
`schemas.UserUpdate`). Bij succes wordt de lokale gebruiker in
`AuthContext` bijgewerkt (`updateUser({ name: naam })`) zodat de naam
overal in de UI (avatar-initiaal, zijbalk, ...) meteen klopt zonder een
volledige herlaad of een extra `GET /users/me`.

## 4. Instellingen: wachtwoord wijzigen

Deze sectie wordt enkel getoond als `user.auth_provider === "password"`.
Is dat niet zo (dus `"microsoft"`), dan toont het scherm gewoon een
uitlegtekst in plaats van het formulier:

```jsx
// Instellingen.jsx
{user?.auth_provider === "password" ? (
  <form ...>Wachtwoord wijzigen</form>
) : (
  <p className="auth-hint">Dit account gebruikt Microsoft om in te loggen — hier is geen wachtwoord voor.</p>
)}
```

Dat is geen puur cosmetische keuze: een Microsoft-account heeft
`hashed_password = NULL` in de database (`models.py`) — er is dus
letterlijk niets om een "huidig wachtwoord" tegen te vergelijken. De
backend controleert dit zelf ook, onafhankelijk van wat de frontend
toont:

```python
# main.py, change_password
if current_user.hashed_password is None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Dit account gebruikt Microsoft om in te loggen — wachtwoord kan hier niet gewijzigd worden",
    )
```

Wie dus rechtstreeks `PUT /users/me/password` aanroept met een geldig
token van een Microsoft-account (bv. via curl, de UI omzeilend), krijgt
alsnog diezelfde `400`.

Verder verloopt het wijzigen zo:
1. Frontend controleert eerst client-side of "nieuw wachtwoord" en
   "bevestig nieuw wachtwoord" gelijk zijn — bij een mismatch wordt er
   niets naar de server gestuurd. Dit bevestigveld bestaat enkel voor
   directe feedback; enkel `new_password` wordt effectief meegestuurd.
2. Backend vergelijkt `current_password` met de opgeslagen hash
   (`security.verify_password`) — klopt dat niet, dan een `401` met
   `"Huidig wachtwoord is onjuist"`.
3. Het nieuwe wachtwoord moet voldoen aan dezelfde sterkte-eis als bij
   registratie: minstens 8 tekens, met een hoofdletter, een cijfer en een
   speciaal teken. Dat wordt in `schemas.py` afgedwongen door dezelfde
   helperfunctie `_check_password_strength()` te hergebruiken die ook
   `UserCreate.password` valideert — één regel, twee plekken. De
   `pattern`-attribute op het `<input>` in `Instellingen.jsx` dient enkel
   als vroege UX-feedback in de browser; de echte afdwinging gebeurt
   server-side.

## 5. Instellingen: account verwijderen

`DELETE /users/me`, met een eigen gestylede bevestigingsmodal
(`useConfirm()` uit `ConfirmDialog.jsx`, geen native `window.confirm()`
meer) als laatste stap (geen aparte "typ je naam om te bevestigen"-stap).
Deze hele sectie is trouwens niet zichtbaar voor een beheerder
(`{!user?.is_admin && (...)}` in `InstellingenSecties`) — zelfverwijdering
via deze route wordt sowieso ook backend-side geweigerd voor een
beheerdersaccount (400), dus de knop zou toch nooit iets kunnen doen.
Na succes
wordt eerst genavigeerd naar `/login` (`navigate("/login", {replace:
true})`) en pas dáárna `logout()` aangeroepen — bewust in die volgorde,
niet andersom. Reden: zolang deze pagina nog gemount is op het moment dat
`logout()` het token op `null` zet, ziet `ProtectedRoute` dat ook en stuurt
zelf óók naar `/login`, maar dan met de huidige pagina (`/instellingen`)
als terugkeer-bestemming in de `location.state`. Die twee gelijktijdige
doorstuuracties liepen elkaar soms voor de voeten, met als gevolg dat een
volgende Microsoft- of wachtwoordlogin de gebruiker terugstuurde naar de
net verwijderde instellingenpagina in plaats van naar de startpagina.
Eerst navigeren ontkoppelt de pagina vóór het token verdwijnt, waardoor
`ProtectedRoute` niets meer te doen heeft. `Profiel.jsx`'s `handleLogout`
(gewoon uitloggen, geen accountverwijdering) volgt dezelfde omgekeerde
volgorde, om dezelfde reden.

De backend (`delete_current_user` in `main.py`) ruimt in deze volgorde op:

1. Eigen chatberichten (`Message`, overal, ongeacht in wiens activiteit).
2. Eigen deelnames (`Participation`, overal).
3. Eigen georganiseerde activiteiten — elk via ORM `db.delete(activiteit)`
   in een lus, **niet** via een bulk-`.delete()`-query.
4. Pas daarna de gebruiker zelf.

Die volgorde is geen willekeurige opsomming maar direct afgeleid van de
foreign keys: `Message.user_id`, `Participation.user_id` en
`Activity.organizer_id` verwijzen allemaal naar `users.id` zonder
`ON DELETE CASCADE`. Zou je de gebruiker eerst verwijderen, dan zouden
die verwijzingen nog bestaan en zou de database de verwijdering weigeren.

Stap 3 gebruikt bewust de trage ORM-weg (`db.delete()` per activiteit)
in plaats van een snellere bulk-query, omdat `Activity` in `models.py`
een cascade heeft staan op zijn eigen kind-relaties:

```python
# models.py
participations = relationship("Participation", back_populates="activity", cascade="all, delete-orphan")
messages = relationship("Message", back_populates="activity", cascade="all, delete-orphan")
```

Die cascade ruimt bij `db.delete(activiteit)` ook de deelnames en
berichten van **andere** gebruikers in die activiteit mee op — iets wat
een simpele `DELETE FROM activities WHERE organizer_id = ...`-query niet
vanzelf zou doen. Notificaties hoeven in deze route niet apart aangepakt
te worden: `Notification.user_id` heeft `ondelete="CASCADE"` op
databaseniveau, dus die verdwijnen automatisch zodra de gebruiker weg is.

Dezelfde volgorde/redenering wordt hergebruikt in `routers/admin.py`
(`delete_user`) wanneer een beheerder iemand anders verwijdert — met één
verschil: die route stuurt achteraf ook een melding naar andere deelnemers
van de verwijderde gebruiker zijn/haar activiteiten, wat het eigen-account-
pad hierboven niet doet. Zie [admin.md](admin.md) §3.3.

## 6. Meldingsvoorkeuren en locatie delen

Enkel relevant voor gewone gebruikers: deze twee secties ("Meldingen" en
"Privacy") worden in `InstellingenSecties` volledig verborgen zodra
`user.is_admin` waar is (`{!user?.is_admin && (...)}`) — een beheerder
neemt zelf niet deel aan activiteiten, dus gaat geen van beide secties
over iets dat voor die account van toepassing is.

Vier onafhankelijke schakelaars, elk gekoppeld aan een boolean-kolom op
`User` (`notify_new_participant`, `notify_chat_messages`,
`notify_reminder`, `notify_activity_updates`). Eén schakelaar stuurt
zowel de in-app melding als de bijhorende e-mail aan — er is bewust geen
apart aan/uit per kanaal, dat zou de UI onnodig verdubbelen.

De toggle zelf (`InstellingToggle` in `Instellingen.jsx`) is een
`<button role="switch" aria-checked={...}>`, geen verborgen checkbox met
een gestylede `<label>` eromheen — consistent met de andere knop-
gebaseerde controls in de app.

Elke wijziging werkt optimistisch: de UI-state (`voorkeuren`,
`shareLocation`) verandert meteen bij de klik, de aanroep naar de backend
gebeurt daarna; faalt die aanroep, dan zet `handleVoorkeurWijzigen()` /
`handleLocatieWijzigen()` de vorige waarde terug en toont een
foutmelding. Zo voelt de toggle direct responsief aan zonder op de
serverreactie te moeten wachten, met een eerlijke terugval als er toch
iets misloopt.

"Locatie delen" stuurt `share_location` aan
(`PUT /users/me/location-preference`). Dat veld doet meer dan enkel een
afstand verbergen: staat het uit, dan roept de `useUserLocation()`-hook
elders in de frontend `navigator.geolocation` nooit aan — de browser
vraagt in dat geval dus zelfs geen locatietoestemming. Dat gedrag staat
letterlijk zo toegelicht bij het veld in `models.py`.

## 7. Navigatie: zijbalk (desktop) vs. onderbalk (mobiel)

Vanaf **900px breed** (`@media (min-width: 900px)` in
`pages/Activiteiten.css`) wisselt de navigatie: `.bottom-nav` (mobiel)
krijgt `display: none`, `.sidebar` en `.top-bar` (die daaronder standaard
`display: none` hebben) krijgen `display: flex`. Onder die breedte is het
net omgekeerd. Beide componenten renderen dus altijd allebei in de DOM;
CSS beslist welke zichtbaar is — er zit geen JS-breakpointlogica in
`BottomNav.jsx`/`Sidebar.jsx`/`TopBar.jsx` zelf.

Beide navigatiecomponenten verbergen zich volledig op de auth-schermen
(`isAuthScreen()` in `utils/nav.js`, true voor `/login` en `/register`) —
daar is nog geen gebruiker om een profiel/tabs voor te tonen.

**Welke tabs**: `BottomNav.jsx` toont altijd dezelfde zes tabs (Start,
Ontdek, Nieuw, Chats, Meldingen, Profiel) — de onderbalk is niet
rolafhankelijk. `Sidebar.jsx` kiest wél tussen twee tabsets:

```jsx
// Sidebar.jsx
const tabs = user?.is_admin ? ADMIN_TABS : TABS;
```

Een beheerder ziet enkel "Gebruikers" en "Activiteiten" (`ADMIN_TABS`),
geen Start/Ontdek/Chats/Meldingen/Instellingen en geen "Nieuwe
activiteit"-knop — een beheerder neemt zelf niet deel aan activiteiten,
dus die tabs zouden voor dat account niets betekenen. Zie ook
[admin.md](admin.md) §6.

**Actieve tab**: `isNavActive(pathname, tab)` in `utils/nav.js` bepaalt
per tab-`key` een eigen regel in plaats van simpelweg `pathname === tab.to`
overal toe te passen — nodig omdat een aantal routes geneste paden
hebben die toch bij dezelfde tab horen. Voorbeelden: de "Ontdek"-tab is
ook actief op `/activiteiten/categorie/...` (maar niet op een `/nieuw`-
subpad daarvan, dat hoort bij de "Nieuw"-tab), en "Chats" is ook actief
op een individuele activiteit-chat (`pathname.endsWith("/chat")`). Voor
elke andere tab volstaat `pathname.startsWith(tab.to)`.

De zijbalk toont daarnaast, enkel voor niet-beheerders, een klein
"Volgende activiteit"-blokje met de eerstvolgende drie activiteiten op
het hele platform (`listActivities()`, geen token nodig — dus niet enkel
activiteiten van de ingelogde gebruiker). Voor een beheerder wordt die
call niet eens uitgevoerd, want een beheerder neemt zelf niet deel.

## 8. Skeleton-loaders, statistiektegels en de telanimatie

- **`Skeleton.jsx`**: een generieke shimmer-`<div>`. De `className`-prop
  krijgt meestal een bestaande kaart-class mee (bv. `.activiteit-rij`),
  zodat de afmetingen en de grid-plaatsing van de placeholder automatisch
  overeenkomen met de echte inhoud die hij straks vervangt, zonder dat
  elke skeleton-plek zijn eigen afmetingen moet uitschrijven.
- **`StatTegel.jsx`** en **`StartStatKaart.jsx`** zijn twee varianten van
  hetzelfde idee: een getal + label. `StatTegel` is de kleine, icoonloze
  versie voor het profielscherm; `StartStatKaart` is de grotere versie
  met icoon en kleuraccent, gebruikt op de admin-startpagina
  (`AdminOverzicht.jsx`) en de gewone Start-pagina. Ze zijn bewust twee
  losse componenten in plaats van één met een `variant`-prop, en geen van
  beide roept `useCountUp` rechtstreeks aan in een `.map()` — Hooks mogen
  niet binnen een lus aangeroepen worden, dus moet de hook-aanroep in een
  eigen componentje per tegel zitten.
- **`useCountUp.js`**: telt via `requestAnimationFrame` op van 0 naar de
  doelwaarde in 600ms. Bij `prefers-reduced-motion: reduce` springt de
  waarde meteen naar het eindgetal — CSS kan een lopende JS-lus niet zelf
  uitschakelen, dus wordt die voorkeur hier expliciet met
  `window.matchMedia()` gecheckt.

## 9. Foutmeldingen — overzicht

| Situatie | HTTP-status | Melding |
|---|---|---|
| Naam leeg of langer dan 100 tekens | 422 | Pydantic-foutmelding |
| Huidig wachtwoord onjuist | 401 | "Huidig wachtwoord is onjuist" |
| Nieuw wachtwoord te zwak (geen hoofdletter/cijfer/speciaal teken) | 422 | "Wachtwoord moet minstens 8 tekens bevatten, met minstens 1 hoofdletter, 1 cijfer en 1 speciaal teken" |
| Wachtwoord wijzigen op een Microsoft-account | 400 | "Dit account gebruikt Microsoft om in te loggen — wachtwoord kan hier niet gewijzigd worden" |
| Nieuwe wachtwoorden komen niet overeen | — (geen aanvraag verstuurd) | "De nieuwe wachtwoorden komen niet overeen." (client-side check in `Instellingen.jsx`) |
| Geen of ongeldig token | 401 | zie [authenticatie.md](authenticatie.md) §8 |

## 10. Voorbeeldverzoeken

```bash
# Naam wijzigen
curl -X PATCH http://localhost:8000/users/me \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jan Peeters"}'

# Wachtwoord wijzigen
curl -X PUT http://localhost:8000/users/me/password \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"oudWachtwoord1!","new_password":"NieuwWachtwoord1!"}'

# Meldingsvoorkeuren bijwerken
curl -X PUT http://localhost:8000/users/me/notification-preferences \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"notify_new_participant":true,"notify_chat_messages":false,"notify_reminder":true,"notify_activity_updates":true}'

# Locatie delen uitzetten
curl -X PUT http://localhost:8000/users/me/location-preference \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"share_location":false}'

# Account verwijderen
curl -X DELETE http://localhost:8000/users/me \
  -H "Authorization: Bearer <access_token>"
```

## 11. Gekende beperkingen (bewust, voor nu)

- Geen e-mailadres wijzigen vanuit Instellingen — `UserUpdate` bevat enkel
  `name`, er is geen endpoint om het e-mailadres aan te passen.
  - Geen "wachtwoord vergeten"-link vanuit dit scherm, om de simpele reden
  dat die flow nergens in de app bestaat (zie
  [authenticatie.md](authenticatie.md) §11).
- Geen profielfoto-upload — de avatar is altijd de eerste letter van de
  naam.
- Geen bevestigingsmail bij het verwijderen van een account — de
  verwijdering is meteen definitief zodra de aanvraag lukt.

Dit zijn bewuste keuzes om de scope behapbaar te houden, geen vergeten
punten.

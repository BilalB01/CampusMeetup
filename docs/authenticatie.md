# Authenticatie — registratie en login in detail

Dit document gaat dieper in op hoe registratie en login precies werken,
zowel aan de backend- als de frontend-kant. Voor een algemeen overzicht
van het hele Sprint 1-project, zie [sprint1-backend-log.md](sprint1-backend-log.md).
Hier gaat het specifiek over de code achter `/auth/register`, `/auth/login`
en wat de React-app daarmee doet.

## 1. Kort overzicht

Er is geen sessiebeheer op de server — we gebruiken JWT. Bij registratie
of login krijg je een token terug, dat token stuur je vanaf dan mee bij
elke aanvraag die weet wie je bent. De server hoeft dus niets bij te
houden over wie op dit moment "ingelogd" is; hij hoeft enkel het token te
kunnen ontcijferen en te controleren of het nog geldig is.

```
Registratie:  formulier → POST /auth/register → wachtwoord hashen → user aanmaken (nog niet definitief)
              → bevestigingsmail versturen → pas dan definitief opslaan → bericht terug (nog GEEN token, zie §6)
Login:        formulier → POST /auth/login    → user opzoeken (case-insensitief) → wachtwoord vergelijken
              → e-mail al bevestigd? → token maken → terug naar frontend
```

## 2. Schoolmail-validatie

We laten enkel adressen toe van het formaat `voornaam.achternaam@student.ehb.be`.
Dat wordt afgedwongen met deze regex in `backend/app/schemas.py`:

```python
SCHOOL_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z]+(-[a-zA-Z]+)*\.[a-zA-Z]+(-[a-zA-Z]+)*@student\.ehb\.be$"
)
```

In mensentaal: een naamdeel van enkel letters, eventueel met
koppeltekens ertussen (voor dubbele namen zoals "van-den-berg"), dan een
punt, dan nog zo'n naamdeel, en dan verplicht `@student.ehb.be`.

| Voorbeeld | Geldig? | Waarom |
|---|---|---|
| `jan.peeters@student.ehb.be` | ✅ | standaardformaat |
| `anne-marie.van-den-berg@student.ehb.be` | ✅ | koppeltekens zijn toegestaan |
| `JAN.PEETERS@STUDENT.EHB.BE` | ✅ | hoofdletters mogen, worden nadien met `.lower()` genormaliseerd |
| `jan@student.ehb.be` | ❌ | geen punt tussen voor- en achternaam |
| `jan.peeters@gmail.com` | ❌ | verkeerd domein |
| `jan2.peeters@student.ehb.be` | ❌ | cijfers zijn niet toegestaan in de regex |
| `jan..peeters@student.ehb.be` | ❌ | dubbele punt matcht niet |

Deze check gebeurt via een Pydantic `field_validator` — dus vóór er ooit
een databasequery uitgevoerd wordt. Een ongeldige mail komt de applicatie
niet eens in, laat staan de database.

## 3. Registratie stap voor stap

`POST /auth/register` (zie `backend/app/routers/auth.py`), maximaal
5 aanvragen per minuut per IP (`@limiter.limit("5/minute")`, want elke
geslaagde aanroep verstuurt intussen ook een echte e-mail):

1. Pydantic valideert het binnenkomende JSON-lichaam tegen `UserCreate`
   (naam 1–100 tekens, geldig e-mailadres in schoolmail-formaat,
   wachtwoord 8–128 tekens + hoofdletter/cijfer/speciaal teken). Klopt er
   iets niet, dan stopt de aanvraag hier al met een `422`.
2. De backend zoekt of er al een gebruiker met dat e-mailadres bestaat.
   Zo ja: `400` met `"Er bestaat al een account met dit e-mailadres"`.
3. Het wachtwoord wordt gehasht met bcrypt (`security.hash_password`) —
   het plaintext-wachtwoord wordt nergens opgeslagen, ook niet tijdelijk
   in de database.
4. Er komt een nieuwe rij in de `users`-tabel, maar **nog niet definitief**:
   `db.add(user)` + `db.flush()` (nodig om al een `user.id` te hebben)
   zonder meteen te `commit()`en.
5. Is er een `RESEND_API_KEY` geconfigureerd, dan wordt er een
   bevestigingsmail verstuurd (zie §6) vóór er iets gecommit wordt. Faalt
   die verzending, dan volgt `db.rollback()` en een `503`
   ("Kon de bevestigingsmail niet versturen. Probeer het straks
   opnieuw.") — zonder deze rollback zou een tijdelijke Resend-storing een
   account achterlaten dat nooit bevestigd kan worden (de mail is nooit
   aangekomen) én nooit opnieuw geregistreerd kan worden (het e-mailadres
   "bestaat al", zie stap 2). Lukt de verzending wel, dan volgt pas dan de
   echte `db.commit()`.
6. Zonder `RESEND_API_KEY` (bv. lokale ontwikkeling) wordt er niemand
   gevonden om de mail te versturen, dus wordt het account meteen als
   bevestigd aangemaakt (`email_verified=True`) en gewoon gecommit.
7. De response is in beide gevallen een `201` met enkel een `message`-veld
   (`schemas.RegisterOut`) — bewust **geen** token en geen
   gebruikersgegevens. Je bent pas echt ingelogd zodra de bevestigingslink
   aangeklikt is (of meteen, in het geen-Resend-geval van stap 6, via een
   gewone `POST /auth/login`).

## 4. Login stap voor stap

`POST /auth/login`, ook `5/minute` per IP:

1. Pydantic valideert `UserLogin` (enkel e-mail + wachtwoord, geen
   schoolmail-check hier — die is al afgedwongen bij registratie).
2. De backend zoekt de gebruiker op via e-mail, **lowercase gemaakt**
   (`payload.email.lower()`) vóór de query. Registratie slaat e-mailadressen
   altijd al lowercase op (zie §2), maar zonder deze stap zou een gebruiker
   die bij het inloggen een andere hoofdlettering typt of laat
   auto-capitalizen (vaak op mobiel) ten onrechte "ongeldig account" te
   zien krijgen.
3. Bestaat die niet, of klopt het wachtwoord niet
   (`security.verify_password` vergelijkt met de opgeslagen hash), dan
   krijg je een `401` met `"Ongeldig e-mailadres of wachtwoord"`. Bewust
   dezelfde melding in beide gevallen — anders zou je via de foutmelding
   kunnen afleiden welke e-mailadressen wel of niet bestaan.
4. Is het wachtwoord correct, maar staat `email_verified` nog op `False`
   (zie §6), dan krijg je pas hier een `403` met "Bevestig eerst je
   e-mailadres via de link die we je gestuurd hebben" — een correct
   wachtwoord alleen is dus niet genoeg zolang de bevestigingslink niet
   aangeklikt is.
5. Klopt alles, dan krijg je een token + gebruikersgegevens terug — in
   tegenstelling tot registratie (die enkel een bericht teruggeeft, zie §3).

## 5. Wat zit er in het token?

Een JWT bestaat uit drie delen (header, payload, handtekening). Onze
payload (`security.create_access_token`) bevat:

```python
{"sub": "<user id>", "exp": <verlooptijdstip>}
```

- `sub` ("subject") is de user-id als string — dat is genoeg om nadien de
  volledige gebruiker op te zoeken.
- `exp` is standaard 60 minuten na aanmaak (`access_token_expire_minutes`
  in `.env`, zie `config.py`). Na verval weigert de server het token.
- Ondertekend met `JWT_SECRET_KEY` (algoritme HS256) — zonder die sleutel
  kan niemand een geldig token vervalsen.

Bij elke aanvraag naar een beveiligde route (zoals `/users/me`) haalt
`dependencies.get_current_user` het token uit de `Authorization: Bearer
<token>`-header, decodeert het, en zoekt de gebruiker op via het
`sub`-veld. Is het token verlopen, vervalst, ontbreekt de gebruiker nog in
de database (bv. verwijderd account), of draagt het token een
`purpose`-veld — telkens gewoon een `401`.

Dat laatste geval is geen typefout: er bestaat namelijk een **tweede**
tokensoort in de codebase, met een heel ander doel. Het
e-mailbevestigingstoken (zie §6) heeft een payload met een extra veld:

```python
{"sub": "<user id>", "purpose": "email_verification", "exp": <verlooptijdstip>}
```

`_decode_user` (`dependencies.py`, gedeeld door `get_current_user` en de
WebSocket-variant `get_current_user_ws`) weigert elk token met zo'n
`purpose`-veld meteen, ook al is het verder perfect geldig en niet
verlopen:

```python
if payload.get("purpose") is not None:
    return None
```

Zonder deze check zou een gelekte of doorgestuurde bevestigingslink een
volwaardig inlogmiddel zijn voor elke beveiligde route — niet enkel voor
`GET /auth/verify`, waar hij voor bedoeld is. Omgekeerd geldt hetzelfde:
`verify_email_verification_token` (gebruikt door `POST /auth/verify`,
zie §6) aanvaardt op zijn beurt enkel een token mét `purpose ==
"email_verification"`, dus een gewoon inlogtoken kan niet worden ingezet
om een account te "bevestigen".

## 6. E-mailverificatie

Sinds registratie geen token meer teruggeeft (§3), moet een nieuw
wachtwoord-account eerst bevestigd worden vóór er ooit ingelogd kan
worden. Microsoft-accounts slaan deze hele stap over — zie §9.2, hun
e-mailadres is al door Microsoft zelf geverifieerd.

### 6.1 Het bevestigingstoken

`security.create_email_verification_token(user_id)` maakt een JWT met
`{"sub": str(user_id), "purpose": "email_verification", "exp": ...}` —
zie §5 voor waarom dat `purpose`-veld cruciaal is. Geldigheidsduur:
`EMAIL_VERIFICATION_EXPIRE_HOURS = 1`, dus bewust kort: hoe korter het
venster, hoe kleiner het risico als de link ooit ergens anders dan de
inbox van de eigenaar terechtkomt.

### 6.2 De mail zelf en de link

`send_verification_email` (`backend/app/email.py`) stuurt een simpele
tekstmail met een link naar `{FRONTEND_URL}/verifieer?token=<token>`. In
tegenstelling tot de meeste andere mails in de app (`send_notification_email`,
best-effort, faalt stil) is dit **geen** best-effort verzending — zie §3
stap 5 voor waarom een mislukte verzending de hele registratie mee laat
falen.

### 6.3 `POST /auth/verify` — bewust een POST, geen GET

```python
# backend/app/routers/auth.py
@router.post("/verify", response_model=schemas.Token)
def verify_email(payload: schemas.EmailVerifyRequest, db: Session = Depends(get_db)):
    user_id = verify_email_verification_token(payload.token)
    if user_id is None:
        raise HTTPException(400, "Deze bevestigingslink is ongeldig of verlopen")
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(404, "Gebruiker niet gevonden")
    if user.email_verified:
        raise HTTPException(400, "Dit e-mailadres is al bevestigd. Log in via de normale weg.")
    user.email_verified = True
    db.commit()
    access_token = create_access_token(subject=str(user.id))
    return schemas.Token(access_token=access_token, user=user)
```

Dit endpoint neemt het token via een JSON-body (`schemas.EmailVerifyRequest`,
`{token: str}`) aan, niet via `?token=...` in de URL zoals een eerdere
versie deed. Reden: een kale `GET`-link met een neveneffect kan door
allerlei tussenlagen automatisch geopend worden vóór de echte gebruiker
er zelf op klikt — een link-scanner van een mailprovider, een
"veiligheids"-preview, browser-linkprefetching. Bij een `GET` zou zo'n
automatische aanroep het eenmalige token al verbruiken.

Die `GET`-naar-`POST`-omzetting alleen bleek niet genoeg: in de praktijk
bleek Microsoft 365's "Safe Links" (standaard actief op `@student.ehb.be`-
mailboxen) elke link in een binnenkomende mail zelf te *renderen* —
inclusief JavaScript uitvoeren — om ze op phishing/malware te controleren.
Consistent 24 à 36 seconden na elke registratiemail dook er in de
serverlogs al een geslaagde `POST /auth/verify` op, ruim vóór er van een
mens sprake kon zijn. Zie §6.4 voor de daaropvolgende fix.

**Eenmalig, ook al blijft het token een uur geldig**: de allereerste
succesvolle aanroep zet `email_verified` op `True` én geeft een
inlogtoken terug. Elke volgende aanroep met datzelfde token (binnen dat
uur) botst op de `if user.email_verified`-check hierboven en krijgt een
`400` in plaats van nog eens een sessie. Zonder deze check zou een
gelekte/doorgestuurde link tot een uur lang een geldig, wachtwoordloos
inlogmiddel blijven — nu is dat venster maximaal "tot de eerste keer dat
iemand erop klikt".

### 6.4 Frontend: `/verifieer` (`VerifyEmail.jsx`)

Publieke route (niet achter `ProtectedRoute`) die `?token=` uit de URL
leest via `useSearchParams`. Vuurt de `POST` uit §6.3 **niet** meer
automatisch af zodra de pagina laadt — enkel een expliciete klik op de
knop "E-mailadres bevestigen" roept `verifyEmail(token)` aan
(`api/client.js`). Bij succes gebeurt daarna exact hetzelfde als een
gewone login: `saveSession(data)` + `navigate("/", {replace: true})`. Bij
een fout (ongeldig/verlopen/al gebruikt token) toont de pagina de
foutmelding met links naar `/register` en `/login`.

Deze knop is de eigenlijke fix voor het probleem uit §6.3: een
mailbeveiligingsscanner rendert een pagina soms wel, maar simuleert
normaal geen echte klik-interactie. Zolang de bevestiging pas ná een
klik gebeurt, verbruikt zo'n scanner het token dus niet meer ongemerkt —
enkel de POST-i.p.v.-GET-omzetting alleen bleek in de praktijk
onvoldoende bescherming.

## 7. Wat gebeurt er aan de frontend-kant?

- `frontend/src/api/client.js` stuurt het formulier naar de juiste
  endpoint en zet een eventuele foutmelding om naar leesbare tekst
  (`extractErrorMessage`).
- Bij succes roept `Login.jsx`/`Register.jsx` `saveSession()` aan
  (`AuthContext.jsx`), die het token en de gebruiker in `localStorage`
  zet. Daardoor blijf je ingelogd na een herlaad van de pagina.
- `ProtectedRoute.jsx` kijkt enkel of er een token *aanwezig* is in de
  context — niet of het nog geldig is. Dat betekent: als een token
  verloopt terwijl je op de site zit, merkt de frontend dat pas als je
  iets doet dat de backend aanspreekt en een `401` terugkrijgt. Er is nu
  nog geen automatische logout bij een verlopen token — dat is een
  bewuste vereenvoudiging voor dit stadium van het project, geen
  vergetelheid.

## 8. Foutmeldingen — overzicht

| Situatie | HTTP-status | Melding |
|---|---|---|
| Ongeldige/ontbrekende velden bij registratie of login | 422 | Pydantic-foutmelding (Engelstalig als het een ingebouwde check is, Nederlands voor de schoolmail-check) |
| Niet-schoolmail bij registratie | 422 | "Gebruik je schoolmail in het formaat voornaam.achternaam@student.ehb.be" |
| E-mail bestaat al | 400 | "Er bestaat al een account met dit e-mailadres" |
| Bevestigingsmail kon niet verstuurd worden bij registratie | 503 | "Kon de bevestigingsmail niet versturen. Probeer het straks opnieuw." |
| Verkeerd wachtwoord of onbestaand account | 401 | "Ongeldig e-mailadres of wachtwoord" |
| Correct wachtwoord, maar e-mail nog niet bevestigd | 403 | "Bevestig eerst je e-mailadres via de link die we je gestuurd hebben" |
| Bevestigingstoken ongeldig/verlopen | 400 | "Deze bevestigingslink is ongeldig of verlopen" |
| Bevestigingstoken hoort bij een niet-bestaande gebruiker | 404 | "Gebruiker niet gevonden" |
| Bevestigingslink nogmaals gebruikt (account al bevestigd) | 400 | "Dit e-mailadres is al bevestigd. Log in via de normale weg." |
| Geen of ongeldig token bij een beveiligde route | 401 | "Kon inloggegevens niet valideren" (of "Not authenticated" als de header volledig ontbreekt — dat komt van FastAPI zelf, niet uit onze eigen code) |

## 9. Inloggen met Microsoft

Naast het gewone e-mail/wachtwoord-formulier kan je ook inloggen met je
Microsoft-account. Dat verloopt in twee helften: de frontend haalt zelf
een token op bij Microsoft (via MSAL), en stuurt dat daarna door naar onze
eigen backend, die het nog eens zelf controleert vóór ze het vertrouwt.

### 9.1 Frontend: de knop "Inloggen met Microsoft" (MSAL, redirect-flow)

`frontend/src/auth/msalInstance.js` maakt één gedeelde MSAL-instantie aan
(`PublicClientApplication`) voor de hele app — dat is MSAL's eigen
aanbevolen patroon, niet iets dat je binnen een component opnieuw aanmaakt:

```js
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: `${window.location.origin}/login`,
  },
});
```

De `authority` staat op `.../common`: de app is *multitenant* geregistreerd
bij Microsoft, dus in principe kan eender welk Microsoft-account (niet
enkel EHB) inloggen bij Microsoft zelf. De echte beperking tot
`@student.ehb.be`-adressen gebeurt pas server-side (zie 8.2) — Microsoft
zelf weet niet dat deze app enkel voor EHB-studenten bedoeld is.

Klik je op de knop (`Login.jsx`, `handleMicrosoftLogin`), dan roept die
`instance.loginRedirect(...)` aan. Dat is een bewuste keuze t.o.v. een
pop-up-venster: pop-ups worden vaak geblokkeerd door de browser (zeker in
een privévenster), terwijl een volledige pagina-redirect overal werkt.
Concreet betekent dit wel dat de hele browser even wegnavigeert naar
`login.microsoftonline.com` en pas nadien terugkeert naar `/login` — de
volledige React-app (inclusief al zijn state) wordt daarbij herladen.

`redirectUri` wijst bewust naar `/login` en niet naar de kale basis-URL
(`/`): `/` zit achter `ProtectedRoute`, en die zou een niet-ingelogde
gebruiker daar meteen terug naar `/login` sturen nog vóór MSAL de kans
krijgt om het antwoord van Microsoft (dat in de URL van die terugkeer
zit) te verwerken.

`MsalProvider` (rond de hele app, zie `frontend/src/main.jsx`) verwerkt
die terugkeer van Microsoft zelf al intern. `Login.jsx` roept dus zelf
geen `handleRedirectPromise()` aan — dat zou kunnen botsen met MSAL's
eigen initialisatie. In plaats daarvan reageert een `useEffect` in
`Login.jsx` gewoon op het resultaat: zodra er een account verschijnt in
`accounts` (via `useMsal()`), haalt die zelf stil een ID-token op met
`acquireTokenSilent`, en stuurt dat door naar de backend via
`loginWithMicrosoft(idToken)`.

### 9.2 Backend: POST /auth/microsoft (ms_auth.py)

De backend vertrouwt het ID-token dat de frontend meestuurt niet zomaar —
`ms_auth.verify_microsoft_id_token` controleert het eerst zelf:

1. De publieke sleutels van Microsoft (JWKS) worden opgehaald bij
   `https://login.microsoftonline.com/common/discovery/v2.0/keys` en een
   uur lang gecachet in het geheugen (`CACHE_SECONDS`), zodat niet elke
   login een nieuwe HTTP-aanvraag naar Microsoft vergt.
2. Uit de (nog niet geverifieerde) header van het ID-token wordt de
   `kid` (key ID) gelezen, en de bijhorende sleutel opgezocht in de JWKS.
   Geen match: het token is niet echt door Microsoft ondertekend.
3. Het token wordt gedecodeerd met die sleutel (RS256) en met de
   `audience` gecontroleerd tegen onze eigen `MICROSOFT_CLIENT_ID` — zo
   weten we dat het token echt voor *onze* app bedoeld is, en niet voor
   een andere Microsoft-app.
4. De standaard issuer-check van de JWT-library staat uit
   (`verify_iss: False`) en gebeurt hier met de hand: de app is
   multitenant geregistreerd, dus elke EHB-student zit in een ander
   Microsoft-tenant dan de volgende, en dus heeft ieders token een andere
   `iss`-waarde (`https://login.microsoftonline.com/<tenant-id>/v2.0`).
   Er wordt daarom enkel op het algemene voorvoegsel
   `https://login.microsoftonline.com/` gecontroleerd — de échte
   EHB-restrictie gebeurt pas nadien in `routers/auth.py`, op basis van
   het geverifieerde e-mailadres.

Is het token geldig, dan doet `login_with_microsoft` in
`routers/auth.py` het volgende:

- Het e-mailadres komt uit de geverifieerde claims (`preferred_username`,
  met `email` als terugval), en wordt met `.lower()` genormaliseerd.
- Eindigt het niet op `@student.ehb.be`, dan stopt het hier met een `403`
  — ook al was het Microsoft-token op zich perfect geldig.
- Bestaat er al een gebruiker met dat e-mailadres, dan wordt die gewoon
  ingelogd — ook als dat account origineel via het wachtwoord-formulier
  is aangemaakt. Er is bewust geen aparte controle op `auth_provider` bij
  het opzoeken: hetzelfde e-mailadres betekent dezelfde persoon, en er
  komen dus nooit twee accounts voor dezelfde student.
- Bestaat de gebruiker nog niet, dan wordt die meteen aangemaakt met
  `hashed_password=None`, `auth_provider="microsoft"` **en
  `email_verified=True`** — de hele e-mailbevestigingsflow uit §6 wordt
  hier overgeslagen, want Microsoft heeft dat e-mailadres net al zelf
  geverifieerd (dat is precies wat de JWKS-controle hierboven bewijst).
  Een Microsoft-account hoeft dus nooit op een bevestigingslink te klikken.

Andersom geldt wel een controle: probeert iemand met een Microsoft-account
in te loggen via het gewone wachtwoord-formulier (`POST /auth/login`),
dan botst die op `if user.hashed_password is None` en krijgt een `400`
met een duidelijke melding om de Microsoft-knop te gebruiken — er is
immers geen wachtwoord-hash om mee te vergelijken.

### 9.3 Microsoft-accounts hebben geen wachtwoord

Een gebruiker die via Microsoft is aangemaakt, krijgt in de database
`hashed_password = NULL` (zie `models.py`, de kolom staat toe
`nullable=True`). Er wordt met opzet geen willekeurig/onbruikbaar
wachtwoord gegenereerd — `None` is expliciet de manier waarop de rest van
de code herkent "dit account gebruikt geen wachtwoord":

- `POST /auth/login` gebruikt dat om de duidelijke melding hierboven te
  tonen in plaats van gewoon "ongeldig wachtwoord".
- `PUT /users/me/password` (`change_password` in `main.py`) doet dezelfde
  controle: is `hashed_password is None`, dan krijg je een `400` met
  `"Dit account gebruikt Microsoft om in te loggen — wachtwoord kan hier
  niet gewijzigd worden"`. Een Microsoft-account kan dus (voorlopig) nooit
  via de app een wachtwoord instellen of wijzigen.
- `schemas.UserOut.auth_provider` (`"password"` of `"microsoft"`) geeft de
  frontend dit gegeven door, zodat een scherm zoals Instellingen kan
  beslissen of "wachtwoord wijzigen" hier überhaupt zin heeft.

### 9.4 Bestemming na login onthouden (ook via de Microsoft-redirect)

Klik je als niet-ingelogde gebruiker op een beveiligde link (bv. een
gedeelde activiteit), dan stuurt `ProtectedRoute.jsx` je naar `/login`
met de oorspronkelijke bestemming mee in de router-state:

```jsx
return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
```

Bij een gewone e-mail/wachtwoord-login leest `Login.jsx` dat gewoon terug
uit `location.state?.from` en navigeert daar na een geslaagde login naartoe.

Bij "Inloggen met Microsoft" werkt dat niet: `loginRedirect()` navigeert de
hele browser weg naar Microsoft en terug, en die volledige-pagina-redirect
herlaadt de React-app helemaal opnieuw — alle in-memory state (React
state, maar ook React Router-routestate) is op dat moment verdwenen.
Daarom slaat `handleMicrosoftLogin` de bestemming eerst zelf op in
`sessionStorage`, vlak vóór de redirect vertrekt:

```js
sessionStorage.setItem(BESTEMMING_KEY, bestemmingNaLogin);
instance.loginRedirect({ scopes: ["openid", "profile", "email"] });
```

en leest die na de terugkeer (in de `useEffect` die op `accounts` reageert)
terug uit, om alsnog naar de juiste plek te navigeren:

```js
const bestemming = sessionStorage.getItem(BESTEMMING_KEY) || "/";
sessionStorage.removeItem(BESTEMMING_KEY);
navigate(bestemming);
```

`sessionStorage` is hier de enige van de drie opties die het overleeft:
gewone React state en React Router-state leven enkel in het geheugen van
die ene pagina-instantie en zijn weg zodra de browser wegnavigeert;
`sessionStorage` overleeft een volledige paginaherlading (en zelfs een
navigatie naar een ander domein en terug) zolang het om hetzelfde tabblad
gaat, en ruimt zichzelf automatisch op zodra dat tabblad sluit.

### 9.5 Foutmeldingen — Microsoft-login

| Situatie | HTTP-status | Melding |
|---|---|---|
| `MICROSOFT_CLIENT_ID` niet ingesteld in de backend-configuratie | 501 | "Microsoft-login is nog niet geconfigureerd" |
| Microsoft-token ongeldig (verkeerde/onbekende handtekening, verkeerde audience, ...) | 401 | "Ongeldig Microsoft-token" |
| Geldig Microsoft-token, maar geen `@student.ehb.be`-adres | 403 | "Enkel toegankelijk met een @student.ehb.be-account" |
| Microsoft-account probeert in te loggen via het gewone wachtwoord-formulier | 400 | "Dit account gebruikt Microsoft om in te loggen — gebruik de Microsoft-knop" |
| Microsoft-account probeert een wachtwoord in te stellen/wijzigen | 400 | "Dit account gebruikt Microsoft om in te loggen — wachtwoord kan hier niet gewijzigd worden" |

## 10. Voorbeeldverzoeken

```bash
# Registreren (verwacht een 201 met enkel een 'message'-veld, geen token)
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jan Peeters","email":"jan.peeters@student.ehb.be","password":"Wachtwoord123!"}'

# E-mailadres bevestigen (token komt uit de mail, of lokaal zonder
# RESEND_API_KEY is dit niet nodig — het account is dan al bevestigd)
curl -X POST http://localhost:8000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<token uit de bevestigingsmail>"}'

# Inloggen
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jan.peeters@student.ehb.be","password":"Wachtwoord123!"}'

# Beveiligde route, met het token uit de vorige stap
curl http://localhost:8000/users/me \
  -H "Authorization: Bearer <access_token>"

# Inloggen met Microsoft — het id_token komt normaal van MSAL in de browser
# (zie §9.1), niet met de hand te typen; dit toont enkel de vorm van het verzoek
curl -X POST http://localhost:8000/auth/microsoft \
  -H "Content-Type: application/json" \
  -d '{"id_token":"<id_token van Microsoft>"}'
```

## 11. Gekende beperkingen (bewust, voor nu)

- Geen wachtwoord-reset of "wachtwoord vergeten"-flow.
- Geen refresh tokens — na 60 minuten moet je gewoon opnieuw inloggen.
- Zowel `/auth/login` als `/auth/register` zijn intussen wel
  rate-gelimiteerd (`5/minute` per IP, zie §3/§4) — een expliciete
  brute-force-bescherming voor de rest van de auth-routes
  (`/auth/verify`, `/auth/microsoft`) staat nog open.
- Frontend logt je niet automatisch uit bij een verlopen token (zie §6).
- Microsoft-accounts hebben geen `hashed_password` (zie §8.3) en kunnen
  dus ook niet via een "wachtwoord vergeten"-flow geholpen worden, mocht
  die er ooit komen — voor die accounts is Microsoft zelf de enige plek
  waar het wachtwoord beheerd wordt.

Dit zijn geen "vergeten" punten maar bewuste keuzes om de scope van
Sprint 1 behapbaar te houden — mocht dit relevant worden voor een latere
sprint, dan weten we tenminste waar we moeten beginnen.

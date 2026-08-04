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
Registratie:  formulier → POST /auth/register → wachtwoord hashen → user in DB → token maken → terug naar frontend
Login:        formulier → POST /auth/login    → user opzoeken → wachtwoord vergelijken → token maken → terug naar frontend
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

`POST /auth/register` (zie `backend/app/routers/auth.py`):

1. Pydantic valideert het binnenkomende JSON-lichaam tegen `UserCreate`
   (naam 1–100 tekens, geldig e-mailadres in schoolmail-formaat,
   wachtwoord 8–128 tekens). Klopt er iets niet, dan stopt de aanvraag
   hier al met een `422`.
2. De backend zoekt of er al een gebruiker met dat e-mailadres bestaat.
   Zo ja: `400` met `"Er bestaat al een account met dit e-mailadres"`.
3. Het wachtwoord wordt gehasht met bcrypt (`security.hash_password`) —
   het plaintext-wachtwoord wordt nergens opgeslagen, ook niet tijdelijk
   in de database.
4. Er komt een nieuwe rij in de `users`-tabel.
5. Er wordt een JWT-token aangemaakt voor die nieuwe gebruiker
   (`security.create_access_token`).
6. De response is een `201` met het token, het type (`"bearer"`) en de
   gebruikersgegevens (zonder wachtwoord, uiteraard).

## 4. Login stap voor stap

`POST /auth/login`:

1. Pydantic valideert `UserLogin` (enkel e-mail + wachtwoord, geen
   schoolmail-check hier — die is al afgedwongen bij registratie).
2. De backend zoekt de gebruiker op via e-mail.
3. Bestaat die niet, of klopt het wachtwoord niet
   (`security.verify_password` vergelijkt met de opgeslagen hash), dan
   krijg je een `401` met `"Ongeldig e-mailadres of wachtwoord"`. Bewust
   dezelfde melding in beide gevallen — anders zou je via de foutmelding
   kunnen afleiden welke e-mailadressen wel of niet bestaan.
4. Klopt alles, dan krijg je net zoals bij registratie een token +
   gebruikersgegevens terug.

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
`sub`-veld. Is het token verlopen, vervalst, of ontbreekt de gebruiker
nog in de database (bv. verwijderd account) — telkens gewoon een `401`.

## 6. Wat gebeurt er aan de frontend-kant?

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

## 7. Foutmeldingen — overzicht

| Situatie | HTTP-status | Melding |
|---|---|---|
| Ongeldige/ontbrekende velden bij registratie of login | 422 | Pydantic-foutmelding (Engelstalig als het een ingebouwde check is, Nederlands voor de schoolmail-check) |
| Niet-schoolmail bij registratie | 422 | "Gebruik je schoolmail in het formaat voornaam.achternaam@student.ehb.be" |
| E-mail bestaat al | 400 | "Er bestaat al een account met dit e-mailadres" |
| Verkeerd wachtwoord of onbestaand account | 401 | "Ongeldig e-mailadres of wachtwoord" |
| Geen of ongeldig token bij een beveiligde route | 401 | "Kon inloggegevens niet valideren" (of "Not authenticated" als de header volledig ontbreekt — dat komt van FastAPI zelf, niet uit onze eigen code) |

## 8. Voorbeeldverzoeken

```bash
# Registreren
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jan Peeters","email":"jan.peeters@student.ehb.be","password":"wachtwoord123"}'

# Inloggen
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jan.peeters@student.ehb.be","password":"wachtwoord123"}'

# Beveiligde route, met het token uit de vorige stap
curl http://localhost:8000/users/me \
  -H "Authorization: Bearer <access_token>"
```

## 9. Gekende beperkingen (bewust, voor nu)

- Geen wachtwoord-reset of "wachtwoord vergeten"-flow.
- Geen refresh tokens — na 60 minuten moet je gewoon opnieuw inloggen.
- Geen rate limiting op `/auth/login` — in een productie-app zou je hier
  bescherming tegen brute-force willen toevoegen.
- Frontend logt je niet automatisch uit bij een verlopen token (zie §6).

Dit zijn geen "vergeten" punten maar bewuste keuzes om de scope van
Sprint 1 behapbaar te houden — mocht dit relevant worden voor een latere
sprint, dan weten we tenminste waar we moeten beginnen.

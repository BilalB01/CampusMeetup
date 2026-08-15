# Adminpaneel — gebruikers en activiteiten beheren

Dit document beschrijft het beheerdersgedeelte van de app: hoe iemand
beheerder wordt, welke endpoints er zijn, en waarom verwijderen door een
beheerder een ander gewicht heeft dan de rest van de app. Het gaat enkel
over het beheerdersperspectief zoals dat in de admin-pagina's en
`routers/admin.py` zit — de kleine verwijderknop die ook op het gewone
activiteitdetailscherm staat, hoort bij een andere pagina en wordt hier
niet behandeld.

Betrokken bestanden:

```
backend/app/routers/admin.py
frontend/src/pages/AdminOverzicht.jsx
frontend/src/pages/AdminGebruikers.jsx
frontend/src/pages/AdminGebruikerDetail.jsx
frontend/src/pages/AdminActiviteiten.jsx
frontend/src/components/Sidebar.jsx
```

## 1. Hoe word je beheerder?

Elke gebruiker heeft een `is_admin`-kolom (`Boolean`, standaard `False`),
toegevoegd via de migratie `0bb7e3dcd5b8_add_is_admin_to_users.py`:

```python
# alembic/versions/0bb7e3dcd5b8_add_is_admin_to_users.py
op.add_column(
    "users",
    sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
)
```

Er is **geen UI en geen endpoint** om dit veld te zetten — `admin.py`
bevat enkel routes om gebruikers te *bekijken* en te *verwijderen*, geen
route om iemand tot beheerder te promoveren, en er is nergens in de
backend een seed-script of CLI-commando dat dit doet. De enige manier om
iemand beheerder te maken is momenteel rechtstreeks in de database, bv.:

```sql
UPDATE users SET is_admin = true WHERE email = 'jan.peeters@student.ehb.be';
```

`models.py` licht toe waarom dit één simpele boolean is in plaats van een
aparte rollentabel: dit eerste beheerdersfeature kent maar twee niveaus
(gewone gebruiker/beheerder), dus zou een volwaardig rollensysteem op dit
moment overkill zijn.

## 2. Hoe wordt er gecontroleerd dat iemand beheerder is?

Elke route in `admin.py` hangt achter de dependency
`get_current_admin` (`backend/app/dependencies.py`):

```python
# dependencies.py
def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enkel beheerders hebben hier toegang toe",
        )
    return current_user
```

Dit bouwt verder op de normale `get_current_user` (geldig JWT-token
nodig, zie [authenticatie.md](authenticatie.md)) en voegt daar de
`is_admin`-check bovenop. Het is een aparte, samengestelde dependency in
plaats van een losse `if`-check in elke routerfunctie, zodat een vergeten
check op een nieuw admin-endpoint niet stilzwijgend zou kunnen gebeuren —
je moet de dependency letterlijk vergeten aan de functiehandtekening toe
te voegen, wat opvalt bij code review, in plaats van een `if`-regel te
vergeten ergens middenin de functie.

Aan de frontend-kant is er een gelijkaardige, aparte laag:
`ProtectedRoute adminOnly` (`App.jsx`) stuurt een niet-beheerder die
rechtstreeks naar `/admin/...` navigeert terug naar `/`, zodat de 403 van
de backend nooit zichtbaar wordt in de UI. Dit is puur UX — de echte
afdwinging gebeurt via `get_current_admin` op de backend.

## 3. Endpoints

### 3.1 `GET /admin/users` — alle gebruikers

Geeft alle gebruikers terug, alfabetisch op naam (`order_by(models.User.name)`).
Gebruikt door `AdminGebruikers.jsx` (de volledige lijst, met client-side
zoekfilter op naam/e-mail — er is geen apart zoekendpoint, de lijst wordt
toch al in zijn geheel opgehaald) en door `AdminOverzicht.jsx` (om
"nieuw deze week" te tellen en de vijf meest recente registraties te
tonen, zelf gesorteerd op `created_at` aan de frontend-kant, want het
endpoint zelf sorteert op naam).

### 3.2 `GET /admin/users/{user_id}` — detail van één gebruiker

Retourneert de gebruikersgegevens plus zijn/haar activiteiten,
opgesplitst in `organized` en `joined` — dezelfde opbouw als
`GET /users/me/activities`, maar dan geparametriseerd op een willekeurige
`user_id` in plaats van de ingelogde gebruiker zelf. Bestaat de
gebruiker niet, dan een `404`. Gebruikt door `AdminGebruikerDetail.jsx`,
bereikt door op een gebruikerskaartje in `AdminGebruikers.jsx` te
klikken.

### 3.3 `DELETE /admin/users/{user_id}` — gebruiker permanent verwijderen

Verwijdert de opgegeven gebruiker en alles wat aan die gebruiker hangt,
in dezelfde volgorde en om dezelfde reden als bij het verwijderen van het
eigen account (zie [profiel-en-instellingen.md](profiel-en-instellingen.md)
§5) — met één belangrijk verschil: vóór er iets verwijderd wordt, haalt
`delete_user` eerst alle *andere* deelnemers op van elke activiteit die de
doelgebruiker organiseerde, zodat die achteraf een melding kunnen krijgen:

```python
# routers/admin.py, delete_user
te_melden = [
    (deelnemer, activiteit.title)
    for activiteit in db.query(models.Activity).filter(models.Activity.organizer_id == target.id)
    for deelnemer in _alle_deelnemers(db, activiteit.id)
    if deelnemer.id != target.id
]

db.query(models.Message).filter(models.Message.user_id == target.id).delete()
db.query(models.Participation).filter(models.Participation.user_id == target.id).delete()
for activiteit in db.query(models.Activity).filter(models.Activity.organizer_id == target.id):
    db.delete(activiteit)
db.delete(target)
db.commit()

for deelnemer, titel in te_melden:
    create_notification(db, deelnemer, "activiteit_verwijderd_admin", f'"{titel}" is door een beheerder verwijderd.', None, deelnemer.notify_activity_updates)
```

1. Eigen chatberichten van de doelgebruiker.
2. Eigen deelnames van de doelgebruiker.
3. Eigen georganiseerde activiteiten — via `db.delete()` per activiteit
   (niet via een bulk-query), zodat de cascade op
   `Activity.participations`/`Activity.messages` in `models.py` ook de
   deelnames en berichten van *andere* gebruikers in die activiteiten
   meeneemt.
4. Pas dan de gebruiker zelf.

Deze volgorde is nodig omdat de foreign keys van `Message`,
`Participation` en `Activity` naar `users.id` geen `ON DELETE CASCADE`
hebben — de gebruiker verwijderen vóór zijn berichten/deelnames/
activiteiten zou op een foreign-key-fout stuiten.

De melding aan andere deelnemers is het enige punt waarop dit afwijkt van
het eigen account verwijderen (`delete_current_user` in `main.py`
verwijdert dezelfde rijen, maar stuurt zelf geen meldingen) — hier wél,
zodat niemand er per toeval achter komt dat "zijn" activiteit stilletjes
verdwenen is. Dat sluit aan bij hoe `DELETE /admin/activities/{id}`
hieronder (§3.5) dat ook al deed.

**Zelfverwijdering wordt geblokkeerd**: een beheerder kan zichzelf hier
niet verwijderen —

```python
if user_id == current_admin.id:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Je kan jezelf hier niet verwijderen -- gebruik daarvoor je eigen accountinstellingen",
    )
```

— de gedachte daarachter (zoals in de code toegelicht) is dat een
beheerder zichzelf anders per ongeluk zou kunnen buitensluiten. Het eigen
account verwijderen kan nog altijd, maar dan via de gewone
`DELETE /users/me` op het instellingenscherm, niet via deze
beheerdersroute. **Een andere beheerder verwijderen kan wel** — de code
bevat geen extra check die dat tegenhoudt. Dat is, voor zover uit de
huidige route blijkt, een bewuste/open keuze: er is (nog) geen
bescherming tegen de laatste beheerder die zichzelf of alle andere
beheerders wegkrijgt.

De frontend (`AdminGebruikers.jsx`, `AdminGebruikerDetail.jsx`) toont om
diezelfde reden geen verwijderknop bij de eigen rij (`u.id === user?.id`)
— in plaats van de gebruiker de knop te laten proberen en dan een 400
terug te krijgen, staat er gewoon een label "Jij". Verwijderen vraagt
altijd eerst een `window.confirm()`, met dezelfde bewoording als bij het
verwijderen van het eigen account.

### 3.4 `GET /admin/activities` — alle activiteiten

```python
# routers/admin.py
query = (
    db.query(models.Activity, func.count(models.Participation.id).label("participant_count"))
    .outerjoin(models.Participation, models.Participation.activity_id == models.Activity.id)
    .group_by(models.Activity.id)
    .order_by(models.Activity.start_time)
)
rows = query.all()
preview_by_activity = _participants_preview_by_activity(db, [a.id for a, _ in rows])
return [
    activity_to_list_item(activity, participant_count, preview_by_activity.get(activity.id))
    for activity, participant_count in rows
]
```

Optioneel filterbaar op `category`. Bewust **geen** filter op verlopen
activiteiten, in tegenstelling tot het gewone `GET /activities`
(dat activiteiten ouder dan een uur uitsluit): een beheerder moet ook
oude activiteiten kunnen terugvinden om ze eventueel op te ruimen. Zie
§4 hieronder voor het onderscheid tussen die twee soorten "verdwijnen".
Elke activiteit krijgt ook een gevulde `participants_preview` mee (via
dezelfde `_participants_preview_by_activity`-helper als `GET /activities`
en §3.2 hierboven), zodat het admin-activiteitenscherm dezelfde
avatar-stapel toont als de gewone activiteitenkaarten.

### 3.5 `DELETE /admin/activities/{activity_id}` — activiteit permanent verwijderen

In tegenstelling tot de gewone `DELETE /activities/{id}` (die enkel de
organisator mag aanroepen en geen reden vereist) verwacht deze route
altijd een `AdminActivityDelete`-body met een verplichte `reason`
(1–300 tekens):

```python
class AdminActivityDelete(BaseModel):
    reason: str = Field(min_length=1, max_length=300)
```

Verloop van de route:

1. Activiteit opzoeken, `404` als ze niet bestaat.
2. **Vóór** het verwijderen wordt de volledige deelnemerslijst opgehaald
   via `_alle_deelnemers()` — na het verwijderen bestaat de activiteit
   niet meer om op te filteren, en de deelnames verdwijnen sowieso mee
   via de cascade op `Activity.participations`.
3. `db.delete(activity)` + commit — de cascade in `models.py`
   (`cascade="all, delete-orphan"` op `participations`/`messages`) ruimt
   de bijhorende deelnames en chatberichten automatisch mee op.
4. Elke deelnemer krijgt een melding, **inclusief de organisator zelf**:

```python
def _alle_deelnemers(db: Session, activity_id: int) -> list[models.User]:
    return (
        db.query(models.User)
        .join(models.Participation, models.Participation.user_id == models.User.id)
        .filter(models.Participation.activity_id == activity_id)
        .all()
    )
```

Dat "iedereen, ook de organisator" is een bewust verschil met de
helperfunctie die de gewone (organisator-)verwijderroute gebruikt, die de
organisator net uitsluit — logisch, want daar weet de organisator toch al
dat hij zelf verwijdert. Bij een beheerdersverwijdering is de organisator
zelf ook maar een derde partij die op de hoogte moet gebracht worden.

De melding zelf gebruikt een ander `type` dan de gewone
verwijdermelding, met een tekst die uitlegt *wie* de activiteit
verwijderde en waarom:

```python
create_notification(
    db,
    deelnemer,
    "activiteit_verwijderd_admin",
    f'"{titel}" is door een beheerder verwijderd. Reden: {payload.reason}',
    None,
    deelnemer.notify_activity_updates,
)
```

`"activiteit_verwijderd_admin"` in plaats van het voor de hand liggende
`"activiteit_verwijderd_beheerder"` is geen stijlkeuze: `Notification.type`
is een `String(30)` in de database, en `"activiteit_verwijderd_beheerder"`
(31 tekens) past daar net niet in, terwijl `"activiteit_verwijderd_admin"`
(27 tekens) wel past. De afwijkende bewoording zorgt er wel voor dat
niemand zou kunnen denken dat de organisator dit zelf annuleerde — de
melding vermeldt expliciet dat een beheerder dit deed, plus de opgegeven
reden.

Aan de frontend-kant (`AdminActiviteiten.jsx`) wordt de reden opgehaald
via `window.prompt()` (niet `window.confirm()`, want er is hier echte
tekstinvoer nodig, geen ja/nee):

```jsx
const reden = window.prompt(
  `Waarom wil je "${activity.title}" permanent verwijderen? Dit wordt getoond aan de deelnemers en kan niet ongedaan gemaakt worden.`,
);
if (reden === null) return; // geannuleerd
if (!reden.trim()) {
  window.alert("Geef een reden op.");
  return;
}
```

Een lege of enkel-witruimte-reden wordt clientside al geweigerd
(`window.alert`), vóór er een aanvraag naar de server gaat — al zou de
`min_length=1`-validatie op `AdminActivityDelete.reason` een lege string
sowieso ook server-side afwijzen.

## 4. Waarom is dit *permanent*, en hoe verschilt dat van "verlopen"?

Beide verwijderroutes in `admin.py` (gebruiker en activiteit) voeren een
**echte, onomkeerbare `DELETE`** uit op de database — er is geen
`deleted_at`-kolom, geen prullenbak, geen archief. Eenmaal gecommit is de
rij weg, met alle cascaderende gevolgen (berichten, deelnames, in het
geval van een gebruiker ook zijn eigen activiteiten) mee weg.

Dat is fundamenteel iets anders dan de "verlopen activiteiten"-filter op
het gewone `GET /activities`-endpoint (activiteiten met `start_time` meer
dan een uur in het verleden worden daar simpelweg niet meegegeven). Die
filter **verandert geen enkele rij in de database** — de activiteit
bestaat nog gewoon, ze wordt enkel niet meer getoond in de normale
activiteitenlijst voor gewone gebruikers. Vandaar ook dat
`GET /admin/activities` die filter bewust *niet* toepast: een beheerder
moet die "verborgen" (maar nog steeds bestaande) verlopen activiteiten
juist kunnen terugvinden, precies om ze eventueel definitief te
verwijderen via §3.5.

## 5. De drie admin-schermen

| Scherm | Bestand | Route | Doel |
|---|---|---|---|
| Overzicht/dashboard | `AdminOverzicht.jsx` | `/` (voor `is_admin`-gebruikers) | Landingspagina met tellingen (gebruikers, activiteiten, nieuw deze week) en de vijf meest recente registraties |
| Gebruikers | `AdminGebruikers.jsx` + `AdminGebruikerDetail.jsx` | `/admin/gebruikers`, `/admin/gebruikers/:id` | Lijst + detail van elke gebruiker, met verwijderknop |
| Activiteiten | `AdminActiviteiten.jsx` | `/admin/activiteiten` | Lijst van alle activiteiten (incl. verlopen), met categoriefilter, zoekveld en verwijderknop |

`AdminOverzicht.jsx` vervangt de normale Start-pagina volledig voor een
beheerder:

```jsx
// App.jsx
function StartScherm() {
  const { user } = useAuth();
  return user?.is_admin ? <AdminOverzicht /> : <Categorieen />;
}
```

De normale Start-pagina (`Categorieen.jsx`) draait rond categorietegels
en "Binnenkort op de campus" — dingen die over *zelf deelnemen* gaan. Dat
past niet bij een beheerdersaccount, dus krijgt een beheerder in de
plaats een dashboard met platformbrede cijfers en snelkoppelingen naar de
twee beheerschermen.

Om diezelfde reden ziet de zijbalk er voor een beheerder ook anders uit
(zie ook [profiel-en-instellingen.md](profiel-en-instellingen.md) §7):

```jsx
// Sidebar.jsx
const ADMIN_TABS = [
  { key: "admin-gebruikers", label: "Gebruikers", Icon: ICONS.persoon, to: "/admin/gebruikers" },
  { key: "admin-activiteiten", label: "Activiteiten", Icon: ICONS.lijst, to: "/admin/activiteiten" },
];
...
const tabs = user?.is_admin ? ADMIN_TABS : TABS;
```

Geen Start/Ontdek/Chats/Meldingen/Instellingen-tabs en geen "Nieuwe
activiteit"-knop voor een beheerder: die gaan allemaal over zelf
activiteiten bijwonen of organiseren, en een beheerder neemt in dit
opzet zelf niet deel aan activiteiten op het platform. Om diezelfde reden
haalt de zijbalk voor een beheerder ook het "Volgende activiteit"-
widgetje niet op (`Sidebar.jsx`, `useEffect`): die widget gaat net over
waar je zelf aan deelneemt.

Dit is niet enkel verborgen UI: `create_activity`, `POST .../join` en
`DELETE .../join` in `backend/app/routers/activities.py` roepen elk
`_ensure_not_admin()` aan en geven een `403` terug als `current_user.is_admin`
toch via een rechtstreekse API-aanroep zou proberen deel te nemen of te
organiseren (zie [activiteiten.md](activiteiten.md) §2). De frontend
verbergt de knoppen enkel om die 403 nooit zichtbaar te laten worden.

## 6. Voorbeeldverzoeken

```bash
# Alle gebruikers ophalen
curl http://localhost:8000/admin/users \
  -H "Authorization: Bearer <admin_access_token>"

# Detail van één gebruiker (incl. zijn activiteiten)
curl http://localhost:8000/admin/users/17 \
  -H "Authorization: Bearer <admin_access_token>"

# Gebruiker permanent verwijderen
curl -X DELETE http://localhost:8000/admin/users/17 \
  -H "Authorization: Bearer <admin_access_token>"

# Alle activiteiten ophalen (incl. verlopen), optioneel gefilterd op categorie
curl "http://localhost:8000/admin/activities?category=Sporten" \
  -H "Authorization: Bearer <admin_access_token>"

# Activiteit permanent verwijderen, met verplichte reden
curl -X DELETE http://localhost:8000/admin/activities/42 \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Activiteit overtreedt de huisregels"}'
```

Een token van een niet-beheerder krijgt op elk van deze routes een `403`
met `"Enkel beheerders hebben hier toegang toe"`.

## 7. Gekende beperkingen (bewust, voor nu)

- Geen UI om iemand beheerder te maken of terug gewone gebruiker te
  maken — `is_admin` kan enkel rechtstreeks in de database gezet worden
  (zie §1). Geen "admin voegt gebruiker toe"-functie: `admin.py` bevat
  geen `POST`-route voor gebruikers.
- Geen bescherming tegen het verwijderen van de laatste overige
  beheerder, of tegen het feit dat beheerders elkaar kunnen verwijderen
  (zie §3.3) — enkel zelfverwijdering via deze route is geblokkeerd.
- Verwijderen is altijd meteen definitief: geen prullenbak, geen
  "ongedaan maken", geen archief van verwijderde gebruikers/activiteiten.
- Geen paginatie op `GET /admin/users` of `GET /admin/activities` — bij
  een groot aantal rijen haalt de frontend gewoon alles in één keer op.

Dit zijn bewuste keuzes om de scope van het eerste beheerdersfeature
behapbaar te houden, geen vergeten punten.

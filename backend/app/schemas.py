import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator

# Enkel schoolmails van het formaat voornaam.achternaam@student.ehb.be toegestaan
SCHOOL_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z]+(-[a-zA-Z]+)*\.[a-zA-Z]+(-[a-zA-Z]+)*@student\.ehb\.be$"
)


# Gedeeld door UserCreate.password en PasswordChange.new_password -- geen
# @field_validator zelf (die kan niet los van een class hergebruikt worden),
# enkel de eigenlijke check zodat beide plekken dezelfde regel volgen
def _check_password_strength(v: str) -> str:
    if not (re.search(r"[A-Z]", v) and re.search(r"\d", v) and re.search(r"[^A-Za-z0-9]", v)):
        raise ValueError(
            "Wachtwoord moet minstens 8 tekens bevatten, met minstens 1 hoofdletter, 1 cijfer en 1 speciaal teken"
        )
    return v


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    # Wordt automatisch uitgevoerd door Pydantic vóór de data de database bereikt
    @field_validator("email")
    @classmethod
    def validate_school_email(cls, v: str) -> str:
        if not SCHOOL_EMAIL_PATTERN.match(v):
            raise ValueError(
                "Gebruik je schoolmail in het formaat voornaam.achternaam@student.ehb.be"
            )
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _check_password_strength(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Payload van POST /auth/microsoft — het ID-token dat MSAL in de browser
# al bij Microsoft heeft opgehaald; de backend verifieert dit zelf nog
# eens (zie ms_auth.py) vóór het vertrouwd wordt
class MicrosoftLogin(BaseModel):
    id_token: str


# Wat er teruggestuurd wordt naar de frontend (nooit het wachtwoord)
class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    # "password" of "microsoft" — frontend heeft dit nodig om te weten of
    # wachtwoord-wijzigen zinvol is (niet van toepassing bij Microsoft)
    auth_provider: str
    created_at: datetime
    notify_new_participant: bool
    notify_chat_messages: bool
    notify_reminder: bool
    notify_activity_updates: bool
    share_location: bool
    # Stuurt de admin-tab (Sidebar.jsx/Profiel.jsx) en de client-side
    # /admin-guard (ProtectedRoute adminOnly) aan
    is_admin: bool

    class Config:
        from_attributes = True


# Payload van PATCH /users/me
class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


# Payload van PUT /users/me/password
class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _check_password_strength(v)


# Antwoord bij succesvolle login/registratie: JWT-token + gebruikersgegevens
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# De 6 categorieën uit de Figma-schermen. Vrije String-kolom in de database
# (zie models.py) — de geldigheid van de waarde wordt hier afgedwongen,
# zodat een 7de categorie later geen nieuwe migratie vergt
class ActivityCategory(str, Enum):
    SPORTEN = "Sporten"
    STUDEREN = "Studeren"
    GAMEN = "Gamen"
    SOCIAAL = "Sociaal"
    CULTUUR_EN_CREATIEF = "Cultuur & creatief"
    OVERIGE = "Overige"


# Wat een gebruiker moet meesturen om een nieuwe activiteit aan te maken
class ActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    start_time: datetime
    max_participants: int = Field(gt=0, le=500)
    category: ActivityCategory


# Beperkte weergave van een organisator/deelnemer — nooit iemands
# e-mailadres tonen aan medegebruikers
class ParticipantOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# Eén item in de activiteitenlijst (GET /activities)
class ActivityListItem(BaseModel):
    id: int
    title: str
    description: str | None
    location_name: str
    latitude: float | None
    longitude: float | None
    start_time: datetime
    max_participants: int
    category: ActivityCategory
    participant_count: int
    created_at: datetime
    # Eerste paar deelnemers, voor de avatar-stapel op de kaarten — standaard
    # leeg (bv. bij /users/me/activities, waar dit niet opgehaald wordt)
    participants_preview: list[ParticipantOut] = []

    class Config:
        from_attributes = True


# Detailweergave van één activiteit: inclusief organisator, deelnemers,
# het aantal deelnemers en of de ingelogde gebruiker al is aangesloten.
# participant_count/is_joined/participants zijn berekende velden, geen
# echte kolommen — dit schema wordt in de router altijd met expliciete
# kwargs opgebouwd, niet via model_validate(activity)
class ActivityDetailOut(BaseModel):
    id: int
    title: str
    description: str | None
    location_name: str
    latitude: float | None
    longitude: float | None
    start_time: datetime
    max_participants: int
    category: ActivityCategory
    created_at: datetime
    organizer: ParticipantOut
    participant_count: int
    is_joined: bool
    participants: list[ParticipantOut]

    class Config:
        from_attributes = True


# Antwoord van GET /users/me/activities voor het profielscherm
class MyActivitiesOut(BaseModel):
    organized: list[ActivityListItem]
    joined: list[ActivityListItem]


# Eén badge voor GET /users/me/badges — de definities (label/icoon/
# voorwaarde) liggen vast in code, "earned" wordt live berekend uit
# echte data (zie main.py), geen aparte databasetabel nodig
class BadgeOut(BaseModel):
    key: str
    label: str
    description: str
    icon: str
    earned: bool


# Eén chatbericht. content en image_url zijn allebei optioneel (elkaars
# tegenpool) — "minstens één ingevuld" wordt in de router afgedwongen.
# user hergebruikt ParticipantOut, zelfde reden als bij ActivityDetailOut
class MessageOut(BaseModel):
    id: int
    content: str | None
    image_url: str | None
    user: ParticipantOut
    created_at: datetime

    class Config:
        from_attributes = True


# Antwoord van GET /stats — publieke, platform-brede tellingen voor het
# login/registreerscherm. Enkel echte cijfers, geen nepdata
class PlatformStatsOut(BaseModel):
    student_count: int
    activities_this_week: int


# Eén rij in GET /users/me/conversations (chatoverzicht)
class ConversationOut(BaseModel):
    activity_id: int
    title: str
    category: ActivityCategory
    last_message: str | None
    last_message_at: datetime
    unread_count: int


# Eén rij in GET /users/me/notifications (meldingencentrum)
class NotificationOut(BaseModel):
    id: int
    type: str
    text: str
    activity_id: int | None
    read: bool
    created_at: datetime


# Payload van PUT /users/me/notification-preferences
class NotificationPreferences(BaseModel):
    notify_new_participant: bool
    notify_chat_messages: bool
    notify_reminder: bool
    notify_activity_updates: bool


# Payload van PUT /users/me/location-preference
class LocationPreference(BaseModel):
    share_location: bool


# Payload van POST /activities/{id}/share
class ActivityShare(BaseModel):
    email: EmailStr
    message: str | None = None


# Payload van DELETE /admin/activities/{id} -- reden is verplicht, komt in
# de melding terecht die de deelnemers krijgen (routers/admin.py)
class AdminActivityDelete(BaseModel):
    reason: str = Field(min_length=1, max_length=300)


# Antwoord van GET /admin/users/{id} -- UserOut-velden + de activiteiten van
# die gebruiker, zelfde opbouw als MyActivitiesOut maar dan bekeken door een
# beheerder i.p.v. de gebruiker zelf
class AdminUserDetailOut(UserOut):
    organized: list[ActivityListItem]
    joined: list[ActivityListItem]

import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator

# Enkel schoolmails van het formaat voornaam.achternaam@student.ehb.be toegestaan
SCHOOL_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z]+(-[a-zA-Z]+)*\.[a-zA-Z]+(-[a-zA-Z]+)*@student\.ehb\.be$"
)


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


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Wat er teruggestuurd wordt naar de frontend (nooit het wachtwoord)
class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


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
    description: str | None = None
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

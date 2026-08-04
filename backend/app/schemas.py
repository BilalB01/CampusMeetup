import re
from datetime import datetime

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

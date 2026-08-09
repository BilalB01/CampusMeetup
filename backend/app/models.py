from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Float,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# Gebruikers van de app (studenten die inloggen/registreren)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    # Nullable: accounts aangemaakt via Microsoft-login (zie routers/auth.py)
    # hebben geen eigen wachtwoord
    hashed_password = Column(String, nullable=True)
    # "password" of "microsoft" — enkel gebruikt voor een duidelijke
    # foutmelding als iemand met een Microsoft-account per ongeluk het
    # wachtwoordformulier probeert
    auth_provider = Column(String(20), nullable=False, default="password")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    activities = relationship("Activity", back_populates="organizer")
    participations = relationship("Participation", back_populates="user")
    messages = relationship("Message", back_populates="user")


# Een activiteit die een student organiseert (titel, locatie, tijdstip, max. deelnemers)
class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    # Categorie van de activiteit — geldige waarden afgedwongen via
    # ActivityCategory in schemas.py, niet op databaseniveau
    category = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    location_name = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    max_participants = Column(Integer, nullable=False)
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    organizer = relationship("User", back_populates="activities")
    participations = relationship(
        "Participation", back_populates="activity", cascade="all, delete-orphan"
    )
    messages = relationship(
        "Message", back_populates="activity", cascade="all, delete-orphan"
    )


# Koppeltabel: welke user neemt deel aan welke activity
# De UniqueConstraint voorkomt dat iemand twee keer inschrijft voor dezelfde activiteit
class Participation(Base):
    __tablename__ = "participations"
    __table_args__ = (UniqueConstraint("user_id", "activity_id", name="uq_user_activity"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_id = Column(Integer, ForeignKey("activities.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="participations")
    activity = relationship("Activity", back_populates="participations")


# Chatberichten binnen de groepschat van een activiteit
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # nullable: een afbeeldingsbericht heeft geen tekst. "Minstens content
    # OF image_url" wordt afgedwongen in de router, niet via een
    # DB-constraint — zelfde aanpak als ActivityCategory hierboven
    content = Column(Text, nullable=True)
    # Relatief pad zoals teruggegeven door StaticFiles, bv. "/uploads/<uuid>.jpg"
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    activity = relationship("Activity", back_populates="messages")
    user = relationship("User", back_populates="messages")

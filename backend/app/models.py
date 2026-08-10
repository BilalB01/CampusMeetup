from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
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
from sqlalchemy.types import TypeDecorator

from app.crypto import decrypt_text, encrypt_text
from app.database import Base


# Versleutelt/ontsleutelt transparant bij elke schrijf/leesactie — de rest
# van de app (chat.py, schemas.py) merkt hier niets van, Message.content
# gedraagt zich gewoon als een normale string-kolom
class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_text(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_text(value)


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
    # Meldingsvoorkeuren (in-app + e-mail, zie app/email.py) — elk kanaal
    # apart aan/uit zou de Instellingen-UI onnodig verdubbelen, dus één
    # schakelaar per type stuurt beide kanalen samen aan
    notify_new_participant = Column(Boolean, nullable=False, default=True)
    notify_chat_messages = Column(Boolean, nullable=False, default=True)
    notify_reminder = Column(Boolean, nullable=False, default=True)
    # Stuurt useUserLocation() aan de frontend aan: bij False wordt
    # navigator.geolocation nooit aangeroepen en tonen activiteitenkaarten
    # geen afstand
    share_location = Column(Boolean, nullable=False, default=True)
    # Melding bij bewerken/verwijderen van een activiteit waar je aan
    # deelneemt (routers/activities.py update_activity/delete_activity)
    notify_activity_updates = Column(Boolean, nullable=False, default=True)

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
    # NULL = nog nooit geopend, dus alle berichten tellen als ongelezen
    last_read_at = Column(DateTime(timezone=True), nullable=True)

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
    # DB-constraint — zelfde aanpak als ActivityCategory hierboven.
    # EncryptedText: staat versleuteld in de database, zie app/crypto.py
    content = Column(EncryptedText, nullable=True)
    # Relatief pad zoals teruggegeven door StaticFiles, bv. "/uploads/<uuid>.jpg"
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    activity = relationship("Activity", back_populates="messages")
    user = relationship("User", back_populates="messages")


# Meldingen voor het meldingencentrum (nieuwe deelnemer/chatbericht/
# herinnering) — activity_id is nullable voor eventuele toekomstige
# meldingstypes zonder activiteit-context
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # ondelete="SET NULL": als de activiteit zelf verwijderd wordt (bv. de
    # "activiteit_verwijderd"-melding hieronder), blijft de melding bestaan
    # maar wordt de dode verwijzing opgeruimd i.p.v. een FK-fout te geven
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(30), nullable=False)
    text = Column(String, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User")
    activity = relationship("Activity")

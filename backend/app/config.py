from pydantic_settings import BaseSettings


# Leest de instellingen automatisch uit het .env-bestand (zie .env.example)
class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    uploads_dir: str = "uploads"
    # Optioneel (None): de backend blijft werken zonder Microsoft-login
    # geconfigureerd, dat endpoint geeft dan gewoon een duidelijke 501 terug
    microsoft_client_id: str | None = None
    # Fernet-sleutel voor het versleutelen van chatberichten in de database
    # (zie app/crypto.py) — genereren met Fernet.generate_key()
    message_encryption_key: str

    class Config:
        env_file = ".env"


settings = Settings()

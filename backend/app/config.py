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
    # Optioneel (None): zonder key blijft de app werken, meldingsmails
    # worden dan gewoon niet verstuurd (zie app/email.py)
    resend_api_key: str | None = None
    resend_from_email: str = "onboarding@resend.dev"
    # Basis-URL van de frontend, voor de link in de "activiteit delen"-e-mail
    frontend_url: str = "http://localhost:5173"
    # Komma-gescheiden lijst van origins die de API mogen aanspreken (CORS) —
    # in productie hier de echte frontend-domeinnaam (+ www-variant) aan toevoegen
    allowed_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()

from cryptography.fernet import Fernet

from app.config import settings

_fernet = Fernet(settings.message_encryption_key.encode())


def encrypt_text(text: str) -> str:
    return _fernet.encrypt(text.encode()).decode()


def decrypt_text(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()

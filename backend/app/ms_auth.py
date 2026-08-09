import time

import requests
from jose import jwt

JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
ISSUER_PREFIX = "https://login.microsoftonline.com/"
CACHE_SECONDS = 3600

_jwks_cache: dict | None = None
_jwks_cached_at = 0.0


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cached_at
    if _jwks_cache is None or time.time() - _jwks_cached_at > CACHE_SECONDS:
        response = requests.get(JWKS_URL, timeout=5)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cached_at = time.time()
    return _jwks_cache


# Verifieert de handtekening + audience van een Microsoft-ID-token en geeft
# de geverifieerde claims terug. Raiset ValueError bij een ongeldig token —
# de aanroeper (routers/auth.py) zet dit om naar een nette 401. De app is
# multitenant geregistreerd (elke EHB-student zit in een ander tenant dan
# ons eigen), dus de issuer wordt hier enkel op het algemene
# login.microsoftonline.com-formaat gecontroleerd — de échte EHB-restrictie
# gebeurt in auth.py op basis van het geverifieerde e-mailadres
def verify_microsoft_id_token(id_token: str, client_id: str) -> dict:
    jwks = _get_jwks()
    header = jwt.get_unverified_header(id_token)
    key = next((k for k in jwks["keys"] if k["kid"] == header.get("kid")), None)
    if key is None:
        raise ValueError("Onbekende ondertekeningssleutel")

    claims = jwt.decode(
        id_token,
        key,
        algorithms=["RS256"],
        audience=client_id,
        options={"verify_iss": False},
    )
    if not claims.get("iss", "").startswith(ISSUER_PREFIX):
        raise ValueError("Ongeldige token-issuer")
    return claims

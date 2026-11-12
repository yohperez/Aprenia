import hashlib
import hmac
import secrets
from collections.abc import Sequence

from yara_api.domain import RECOVERY_WORD_COUNT, RECOVERY_WORDLIST_SIZE


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_recovery_words() -> list[int]:
    return [secrets.randbelow(RECOVERY_WORDLIST_SIZE) for _ in range(RECOVERY_WORD_COUNT)]


def recovery_lookup(words: Sequence[int], pepper: str) -> str:
    message = "-".join(str(word) for word in words).encode()
    return hmac.new(pepper.encode(), message, hashlib.sha256).hexdigest()


def anonymize_client(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:32]

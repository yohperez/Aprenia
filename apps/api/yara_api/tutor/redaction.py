import re

PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "url": re.compile(
        r"(https?://\S+|www\.\S+|\b[\w-]+\.(com|org|net|io|app|me|es|af|pk|ir)\b)", re.IGNORECASE
    ),
    "phone": re.compile(r"\+?\d[\d\s().-]{6,}\d"),
    "number": re.compile(r"\d{5,}"),
}
NAME_INTRO = re.compile(
    r"(my name is|i am called|me llamo|mi nombre es|je m'appelle|mon nom est|meu nome é|me chamo"
    r"|اسمي|اسم من|نام من|زما نوم|میرا نام)\s+(\S+)",
    re.IGNORECASE,
)


def redact(text: str) -> tuple[str, set[str]]:
    found: set[str] = set()
    if NAME_INTRO.search(text):
        found.add("name")
        text = NAME_INTRO.sub(lambda m: f"{m.group(1)} [name]", text)
    for kind, pattern in PATTERNS.items():
        if pattern.search(text):
            found.add(kind)
            text = pattern.sub(f"[{kind}]", text)
    return text, found


def has_contact_data(text: str) -> bool:
    return any(PATTERNS[kind].search(text) for kind in ("url", "email", "phone"))

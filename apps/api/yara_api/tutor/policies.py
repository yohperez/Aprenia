import json
import math
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from yara_api.domain import audience_of
from yara_api.text import tokens

K1 = 1.4
B = 0.75


@dataclass(frozen=True)
class Policy:
    id: str
    title: str
    source: str
    url: str
    rule: str
    text: str
    audiences: tuple[str, ...]
    baseline: bool
    tags: tuple[str, ...]


def load_policies(path: Path) -> list[Policy]:
    raw = json.loads(path.read_text())["policies"]
    return [
        Policy(
            id=p["id"],
            title=p["title"],
            source=p["source"],
            url=p["url"],
            rule=p["rule"],
            text=p["text"],
            audiences=tuple(p["audiences"]),
            baseline=p["baseline"],
            tags=tuple(p["tags"]),
        )
        for p in raw
    ]


class PolicyIndex:
    def __init__(self, policies: list[Policy]) -> None:
        self.policies = policies
        self._docs = [Counter(tokens(" ".join((p.title, p.rule, p.text, *p.tags)))) for p in policies]
        self._lengths = [sum(doc.values()) for doc in self._docs]
        self._average = sum(self._lengths) / max(len(self._lengths), 1)
        frequencies = Counter(term for doc in self._docs for term in doc)
        total = len(policies)
        self._idf = {
            term: math.log(1 + (total - count + 0.5) / (count + 0.5)) for term, count in frequencies.items()
        }

    def search(self, query: str, age_band: str | None = None, limit: int = 3) -> list[Policy]:
        terms = tokens(query)
        audience = audience_of(age_band) if age_band else None
        scored = [
            (self._score(index, terms), policy)
            for index, policy in enumerate(self.policies)
            if audience is None or audience in policy.audiences
        ]
        ranked = sorted((pair for pair in scored if pair[0] > 0), key=lambda pair: -pair[0])
        return [policy for _, policy in ranked[:limit]]

    def baseline(self, age_band: str) -> list[Policy]:
        audience = audience_of(age_band)
        return [p for p in self.policies if p.baseline and audience in p.audiences]

    def for_tutor(self, age_band: str, query: str, extra: int = 2) -> list[Policy]:
        selected = self.baseline(age_band)
        chosen = {p.id for p in selected}
        matches = [p for p in self.search(query, age_band, limit=len(self.policies)) if p.id not in chosen]
        return selected + matches[:extra]

    def _score(self, index: int, terms: list[str]) -> float:
        doc = self._docs[index]
        length_norm = 1 - B + B * self._lengths[index] / self._average
        score = 0.0
        for term in terms:
            frequency = doc.get(term, 0)
            if frequency:
                score += self._idf[term] * frequency * (K1 + 1) / (frequency + K1 * length_norm)
        return score

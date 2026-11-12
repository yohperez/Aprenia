import re
from collections.abc import Callable
from dataclasses import dataclass

ITEM_PATTERN = re.compile(r"^(count|cmp|add|sub|mis|mul|div|half|pct|prob|take)-(\d{1,3})(?:-(\d{1,3}))?$")
PERCENTS = frozenset({10, 25, 50})

Check = Callable[[int, int | None], bool]


def _pair(check: Callable[[int, int], bool]) -> Check:
    return lambda a, b: b is not None and check(a, b)


def _single(check: Callable[[int], bool]) -> Check:
    return lambda a, b: b is None and check(a)


STEP_RULES: dict[str, tuple[tuple[str, Check], ...]] = {
    "count5": (("count", _single(lambda a: 1 <= a <= 5)),),
    "count10": (("count", _single(lambda a: 1 <= a <= 10)),),
    "compare": (("cmp", _pair(lambda a, b: a != b and a <= 20 and b <= 20)),),
    "add10": (("add", _pair(lambda a, b: a + b <= 10)),),
    "sub10": (("sub", _pair(lambda a, b: b <= a <= 10)),),
    "add20": (("add", _pair(lambda a, b: a + b <= 20)),),
    "sub20": (("sub", _pair(lambda a, b: b <= a <= 20)),),
    "missing20": (("mis", _pair(lambda a, b: a <= b <= 20)),),
    "add100": (("add", _pair(lambda a, b: a + b <= 100)),),
    "sub100": (("sub", _pair(lambda a, b: b <= a <= 100)),),
    "missing100": (("mis", _pair(lambda a, b: a <= b <= 100)),),
    "mul5": (("mul", _pair(lambda a, b: 1 <= a <= 5 and 1 <= b <= 10)),),
    "mul10": (("mul", _pair(lambda a, b: 1 <= a <= 10 and 1 <= b <= 10)),),
    "div": (("div", _pair(lambda a, b: 1 <= b <= 10 and a % b == 0 and a // b <= 10)),),
    "half": (("half", _single(lambda a: a % 2 == 0 and 2 <= a <= 100)),),
    "percent": (("pct", _pair(lambda a, b: a in PERCENTS and b <= 200 and (a * b) % 100 == 0)),),
    "problem": (
        ("prob", _pair(lambda a, b: a + b <= 50)),
        ("take", _pair(lambda a, b: b <= a <= 50)),
    ),
}
MATH_STEPS = frozenset(STEP_RULES)
SYMBOLS = {"add": "+", "sub": "-", "mul": "x", "div": "/"}


@dataclass(frozen=True)
class MathItem:
    op: str
    a: int
    b: int | None


def parse_item(item_id: str) -> MathItem | None:
    match = ITEM_PATTERN.match(item_id)
    if match is None:
        return None
    second = match.group(3)
    return MathItem(match.group(1), int(match.group(2)), None if second is None else int(second))


def allowed(item: MathItem, steps: list[str]) -> bool:
    return any(
        op == item.op and check(item.a, item.b) for step in steps for op, check in STEP_RULES.get(step, ())
    )


def answer_of(item: MathItem) -> int:
    a, b = item.a, item.b or 0
    answers = {
        "count": a,
        "cmp": max(a, b),
        "add": a + b,
        "sub": a - b,
        "mis": b - a,
        "mul": a * b,
        "div": a // b if b else 0,
        "half": a // 2,
        "pct": a * b // 100,
        "prob": a + b,
        "take": a - b,
    }
    return answers[item.op]


def describe(item: MathItem) -> str:
    a, b, result = item.a, item.b, answer_of(item)
    if item.op == "count":
        return f"The learner counts {a} pictures. The answer is {result}."
    if item.op == "cmp":
        return f"Which number is bigger, {a} or {b}? The answer is {result}."
    if item.op == "mis":
        return f"Exercise: {a} + ? = {b}. The missing number is {result}."
    if item.op == "half":
        return f"Half of {a} is {result}."
    if item.op == "pct":
        return f"{a} percent of {b} is {result}."
    if item.op == "prob":
        return f"Word problem: the learner has {a} coins and gets {b} more. The answer is {result}."
    if item.op == "take":
        return f"Word problem: the learner has {a} sweets and gives away {b}. The answer is {result}."
    return f"Exercise: {a} {SYMBOLS[item.op]} {b}. The answer is {result}."

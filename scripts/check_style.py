import io
import subprocess
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPES = ("apps/", "content/", "scripts/", "docs/frontend.md", "AGENTS.md", "CLAUDE.md", "docker-compose.yml")
SKIP_PARTS = {"node_modules", "dist", ".venv", "__pycache__"}
SKIP_NAMES = {"uv.lock", "pnpm-lock.yaml"}
TEXT_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json", ".md", ".toml", ".ini", ".yml", ".yaml", ".mako"}
SCRIPT_SUFFIXES = {".ts", ".tsx", ".js", ".mjs"}
LONG_DASHES = (chr(0x2014), chr(0x2013))


def tracked_files() -> list[Path]:
    listed = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    files = []
    for name in listed:
        path = ROOT / name
        if not name.startswith(SCOPES) or path.suffix not in TEXT_SUFFIXES:
            continue
        if SKIP_PARTS.intersection(path.parts) or path.name in SKIP_NAMES or not path.exists():
            continue
        files.append(path)
    return files


def python_comments(source: str) -> list[int]:
    tokens = tokenize.generate_tokens(io.StringIO(source).readline)
    return [token.start[0] for token in tokens if token.type == tokenize.COMMENT]


def script_comments(source: str) -> list[int]:
    lines: list[int] = []
    index, line, quote = 0, 1, ""
    while index < len(source):
        char = source[index]
        pair = source[index : index + 2]
        if char == "\n":
            line += 1
        if char == "\\":
            index += 2
            continue
        if quote:
            if char == quote:
                quote = ""
        elif char in "\"'`":
            quote = char
        elif pair in ("//", "/*"):
            lines.append(line)
            end = source.find("\n" if pair == "//" else "*/", index + 2)
            if end == -1:
                break
            line += source.count("\n", index, end)
            index = end + (1 if pair == "//" else 2)
            continue
        index += 1
    return lines


def marker_comments(source: str, opener: str) -> list[int]:
    return [number for number, text in enumerate(source.splitlines(), 1) if opener in text]


def comment_lines(path: Path, source: str) -> list[int]:
    if path.suffix == ".py":
        return python_comments(source)
    if path.suffix in SCRIPT_SUFFIXES:
        return script_comments(source)
    if path.suffix == ".css":
        return marker_comments(source, "/*")
    if path.suffix == ".html":
        return marker_comments(source, "<!--")
    return []


def main() -> int:
    problems = []
    for path in tracked_files():
        source = path.read_text(encoding="utf-8")
        relative = path.relative_to(ROOT)
        problems += [f"{relative}:{number}: comment" for number in comment_lines(path, source)]
        for number, text in enumerate(source.splitlines(), 1):
            if any(dash in text for dash in LONG_DASHES):
                problems.append(f"{relative}:{number}: long dash")
    for problem in problems:
        print(problem)
    print("style ok" if not problems else f"{len(problems)} style problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

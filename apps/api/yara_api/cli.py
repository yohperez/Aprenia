import argparse
import sys

from yara_api.audio import AzureSpeech, generate_audio
from yara_api.config import get_settings
from yara_api.content_store import load_bundle, seed_content
from yara_api.db import Database, utcnow
from yara_api.domain import LOCALES
from yara_api.maintenance import purge


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="yara")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed", help="Load the content folder into the database")
    audio = commands.add_parser("audio", help="Generate lesson audio with Azure Speech")
    audio.add_argument("--locale", action="append", choices=LOCALES)
    audio.add_argument("--all", action="store_true", help="Regenerate existing audio too")
    commands.add_parser("purge", help="Delete data past its retention period")
    args = parser.parse_args(argv)

    settings = get_settings()
    database = Database(settings.database_url)
    with database.session_factory() as db:
        if args.command == "seed":
            changed = seed_content(db, load_bundle(settings.content_dir))
            print("Content updated" if changed else "Content already up to date")
        elif args.command == "audio":
            if not (settings.azure_speech_key and settings.azure_speech_region):
                print("Set YARA_AZURE_SPEECH_KEY and YARA_AZURE_SPEECH_REGION", file=sys.stderr)
                return 1
            speech = AzureSpeech(settings.azure_speech_key, settings.azure_speech_region)
            bundle = load_bundle(settings.content_dir)
            created = generate_audio(db, bundle, speech, args.locale or LOCALES, only_missing=not args.all)
            print(f"Generated {created} audio files")
        else:
            print(purge(db, settings, utcnow()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

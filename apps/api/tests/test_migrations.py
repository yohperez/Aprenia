from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from yara_api.config import REPO_ROOT
from yara_api.db import Base

API_DIR = REPO_ROOT / "apps" / "api"


def test_migrations_match_the_models(tmp_path):
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    config = Config(str(API_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(API_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    with create_engine(url).connect() as connection:
        context = MigrationContext.configure(connection)
        differences = [d for d in compare_metadata(context, Base.metadata) if d[0] != "remove_index"]
    assert differences == []

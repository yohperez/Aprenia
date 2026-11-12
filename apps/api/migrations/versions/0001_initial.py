import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("recovery_lookup", sa.String(length=64), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("age_band", sa.String(length=8), nullable=True),
        sa.Column("goal", sa.String(length=24), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("recovery_lookup"),
    )
    op.create_table(
        "content_audio",
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("item_id", sa.String(length=40), nullable=False),
        sa.Column("mime", sa.String(length=32), nullable=False),
        sa.Column("digest", sa.String(length=16), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.PrimaryKeyConstraint("locale", "item_id"),
    )
    op.create_table(
        "content_images",
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("svg", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )
    op.create_table(
        "content_meta",
        sa.Column("key", sa.String(length=32), nullable=False),
        sa.Column("value", sa.String(length=128), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_table(
        "content_statements",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("set_name", sa.String(length=16), nullable=False),
        sa.Column("safe", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "rate_limit_hits",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key", "window_start"),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    with op.batch_alter_table("auth_sessions", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_auth_sessions_account_id"), ["account_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_auth_sessions_expires_at"), ["expires_at"], unique=False)

    op.create_table(
        "content_concepts",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("image", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["image"],
            ["content_images.name"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("position"),
    )
    op.create_table(
        "content_statement_texts",
        sa.Column("statement_id", sa.String(length=40), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("text", sa.String(length=240), nullable=False),
        sa.ForeignKeyConstraint(["statement_id"], ["content_statements.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("statement_id", "locale"),
    )
    op.create_table(
        "content_subjects",
        sa.Column("id", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.Column("image", sa.String(length=64), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["image"],
            ["content_images.name"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "lesson_progress",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("lesson_id", sa.String(length=40), nullable=False),
        sa.Column("subject_id", sa.String(length=24), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("best_score", sa.SmallInteger(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id", "lesson_id"),
    )
    op.create_table(
        "subject_progress",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("subject_id", sa.String(length=24), nullable=False),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("placement", sa.String(length=8), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id", "subject_id"),
    )
    op.create_table(
        "tutor_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=True),
        sa.Column("lesson_id", sa.String(length=40), nullable=False),
        sa.Column("mode", sa.String(length=8), nullable=False),
        sa.Column("intent", sa.String(length=16), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=True),
        sa.Column("policy_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("tutor_events", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_tutor_events_account_id"), ["account_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_tutor_events_created_at"), ["created_at"], unique=False)

    op.create_table(
        "tutor_usage",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("mode", sa.String(length=8), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id", "day", "mode"),
    )
    op.create_table(
        "content_lessons",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("subject_id", sa.String(length=24), nullable=False),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("math", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["content_subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("content_lessons", schema=None) as batch_op:
        batch_op.create_index("ix_content_lessons_subject_level", ["subject_id", "level"], unique=False)

    op.create_table(
        "content_words",
        sa.Column("concept_id", sa.String(length=32), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("word", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["concept_id"], ["content_concepts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("concept_id", "locale"),
    )


def downgrade() -> None:
    op.drop_table("content_words")
    with op.batch_alter_table("content_lessons", schema=None) as batch_op:
        batch_op.drop_index("ix_content_lessons_subject_level")

    op.drop_table("content_lessons")
    op.drop_table("tutor_usage")
    with op.batch_alter_table("tutor_events", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tutor_events_created_at"))
        batch_op.drop_index(batch_op.f("ix_tutor_events_account_id"))

    op.drop_table("tutor_events")
    op.drop_table("subject_progress")
    op.drop_table("lesson_progress")
    op.drop_table("content_subjects")
    op.drop_table("content_statement_texts")
    op.drop_table("content_concepts")
    with op.batch_alter_table("auth_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_auth_sessions_expires_at"))
        batch_op.drop_index(batch_op.f("ix_auth_sessions_account_id"))

    op.drop_table("auth_sessions")
    op.drop_table("rate_limit_hits")
    op.drop_table("content_statements")
    op.drop_table("content_meta")
    op.drop_table("content_images")
    op.drop_table("content_audio")
    op.drop_table("accounts")

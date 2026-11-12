import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("content_lessons") as batch:
        batch.add_column(sa.Column("status", sa.String(length=8), nullable=False, server_default="live"))
    op.create_table(
        "content_questions",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("answer", sa.SmallInteger(), nullable=False),
        sa.Column("concept_id", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(["concept_id"], ["content_concepts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "content_question_texts",
        sa.Column("question_id", sa.String(length=40), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("prompt", sa.String(length=400), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["content_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("question_id", "locale"),
    )
    op.create_table(
        "content_resources",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("subject_id", sa.String(length=24), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("kind", sa.String(length=8), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("url", sa.String(length=400), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["content_subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "content_policies",
        sa.Column("id", sa.String(length=48), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("url", sa.String(length=400), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("DELETE FROM content_meta WHERE key = 'version'")


def downgrade() -> None:
    op.drop_table("content_policies")
    op.drop_table("content_resources")
    op.drop_table("content_question_texts")
    op.drop_table("content_questions")
    with op.batch_alter_table("content_lessons") as batch:
        batch.drop_column("status")

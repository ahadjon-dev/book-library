"""add mood_tags and embedding columns for semantic recommendations

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-02

"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("mood_tags", sa.JSON(), nullable=True))
    op.add_column("books", sa.Column("embedding", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("books", "embedding")
    op.drop_column("books", "mood_tags")

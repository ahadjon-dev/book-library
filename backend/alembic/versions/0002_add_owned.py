"""add books.owned

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-25

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column("owned", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_books_owned", "books", ["owned"])


def downgrade() -> None:
    op.drop_index("ix_books_owned", table_name="books")
    op.drop_column("books", "owned")

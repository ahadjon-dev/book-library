"""add performance indexes

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-30

"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for filtering user book statuses by status
    op.create_index(
        "ix_user_book_status_user_status",
        "user_book_status",
        ["user_id", "status"],
    )
    # Composite index for time-based reading analytics
    op.create_index(
        "ix_user_book_status_user_finished",
        "user_book_status",
        ["user_id", "finished_at"],
    )
    # Single-column indexes on commonly filtered / aggregated book columns
    op.create_index(
        "ix_books_publication_year",
        "books",
        ["publication_year"],
    )
    op.create_index(
        "ix_books_purchase_date",
        "books",
        ["purchase_date"],
    )
    op.create_index(
        "ix_books_page_count",
        "books",
        ["page_count"],
    )


def downgrade() -> None:
    op.drop_index("ix_books_page_count", table_name="books")
    op.drop_index("ix_books_purchase_date", table_name="books")
    op.drop_index("ix_books_publication_year", table_name="books")
    op.drop_index("ix_user_book_status_user_finished", table_name="user_book_status")
    op.drop_index("ix_user_book_status_user_status", table_name="user_book_status")

"""add book_loans and reading_goals tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-30

"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. book_loans table
    op.create_table(
        "book_loans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("borrower_name", sa.String(length=255), nullable=False),
        sa.Column("borrower_contact", sa.String(length=255), nullable=True),
        sa.Column("loan_date", sa.Date(), server_default=sa.func.current_date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("returned_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_book_loans_user_id", "book_loans", ["user_id"])
    op.create_index("ix_book_loans_book_id", "book_loans", ["book_id"])
    op.create_index("ix_book_loans_borrower_name", "book_loans", ["borrower_name"])

    # 2. reading_goals table
    op.create_table(
        "reading_goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("target_books", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "year", name="uq_user_goal_year"),
    )
    op.create_index("ix_reading_goals_user_id", "reading_goals", ["user_id"])
    op.create_index("ix_reading_goals_year", "reading_goals", ["year"])


def downgrade() -> None:
    op.drop_table("reading_goals")
    op.drop_table("book_loans")

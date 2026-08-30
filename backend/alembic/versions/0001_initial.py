"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

read_status_enum = postgresql.ENUM(
    "unread", "reading", "finished", "abandoned",
    name="read_status",
    create_type=False,
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "authors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
    )
    op.create_index("ix_authors_name", "authors", ["name"])

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
    )
    op.create_index("ix_tags_name", "tags", ["name"])

    op.create_table(
        "shelves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
    )
    op.create_index("ix_shelves_name", "shelves", ["name"])

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("subtitle", sa.String(500)),
        sa.Column("isbn", sa.String(20)),
        sa.Column("publisher", sa.String(255)),
        sa.Column("publication_year", sa.Integer()),
        sa.Column("language", sa.String(50)),
        sa.Column("page_count", sa.Integer()),
        sa.Column("cover_image_path", sa.String(500)),
        sa.Column("description", sa.Text()),
        sa.Column("genre", sa.String(100)),
        sa.Column("shelf_id", sa.Integer(), sa.ForeignKey("shelves.id", ondelete="SET NULL")),
        sa.Column("purchase_date", sa.Date()),
        sa.Column("purchase_price", sa.Numeric(10, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_books_title", "books", ["title"])
    op.create_index("ix_books_isbn", "books", ["isbn"])
    op.create_index("ix_books_genre", "books", ["genre"])

    op.create_table(
        "book_authors",
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "book_tags",
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    read_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "user_book_status",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            read_status_enum,
            nullable=False,
            server_default="unread",
        ),
        sa.Column("rating", sa.Integer()),
        sa.Column("notes", sa.Text()),
        sa.Column("started_at", sa.Date()),
        sa.Column("finished_at", sa.Date()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "book_id", name="uq_user_book"),
        sa.CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 10)", name="ck_rating_range"),
    )
    op.create_index("ix_user_book_status_user_id", "user_book_status", ["user_id"])
    op.create_index("ix_user_book_status_book_id", "user_book_status", ["book_id"])


def downgrade() -> None:
    op.drop_table("user_book_status")
    read_status_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_table("book_tags")
    op.drop_table("book_authors")
    op.drop_table("books")
    op.drop_table("shelves")
    op.drop_table("tags")
    op.drop_table("authors")
    op.drop_table("users")

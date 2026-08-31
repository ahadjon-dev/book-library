"""add household libraries shared by multiple users

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-31

"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create libraries
    op.create_table(
        "libraries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("invite_code", sa.String(length=32), nullable=True),
        sa.Column("share_slug", sa.String(length=100), nullable=True),
        sa.Column("is_public_shelf", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("invite_code", name="uq_libraries_invite_code"),
        sa.UniqueConstraint("share_slug", name="uq_libraries_share_slug"),
    )
    op.create_index("ix_libraries_invite_code", "libraries", ["invite_code"])
    op.create_index("ix_libraries_share_slug", "libraries", ["share_slug"])

    # 2. One library per existing user. Copy the user's share settings.
    op.add_column("libraries", sa.Column("tmp_owner_user_id", sa.Integer(), nullable=True))
    op.execute(
        """
        INSERT INTO libraries (name, share_slug, is_public_shelf, tmp_owner_user_id)
        SELECT display_name, share_slug, is_public_shelf, id FROM users ORDER BY id
        """
    )

    # 3. Attach users to their libraries as owners
    op.add_column("users", sa.Column("library_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("role", sa.String(length=20), server_default="owner", nullable=False))
    op.execute(
        """
        UPDATE users SET library_id = l.id
        FROM libraries l WHERE l.tmp_owner_user_id = users.id
        """
    )
    op.alter_column("users", "library_id", nullable=False)
    op.create_foreign_key("fk_users_library_id", "users", "libraries", ["library_id"], ["id"])
    op.create_index("ix_users_library_id", "users", ["library_id"])
    op.drop_column("libraries", "tmp_owner_user_id")

    # 4. Drop the share settings from users; they live on libraries now
    op.drop_index("ix_users_share_slug", table_name="users")
    op.drop_column("users", "share_slug")
    op.drop_column("users", "is_public_shelf")

    # 5. Books: user_id -> library_id, keep the adder
    op.add_column("books", sa.Column("library_id", sa.Integer(), nullable=True))
    op.add_column("books", sa.Column("added_by_user_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE books SET library_id = u.library_id, added_by_user_id = books.user_id
        FROM users u WHERE u.id = books.user_id
        """
    )
    op.alter_column("books", "library_id", nullable=False)
    op.create_foreign_key(
        "fk_books_library_id", "books", "libraries", ["library_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_books_added_by_user_id", "books", "users", ["added_by_user_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_books_library_id", "books", ["library_id"])
    op.create_index("ix_books_library_genre", "books", ["library_id", "genre"])
    op.create_index("ix_books_library_isbn", "books", ["library_id", "isbn"])
    op.drop_index("ix_books_user_isbn", table_name="books")
    op.drop_index("ix_books_user_genre", table_name="books")
    op.drop_index("ix_books_user_id", table_name="books")
    op.drop_constraint("fk_books_user_id", "books", type_="foreignkey")
    op.drop_column("books", "user_id")

    # 6. Shelves: user_id -> library_id
    op.add_column("shelves", sa.Column("library_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE shelves SET library_id = u.library_id
        FROM users u WHERE u.id = shelves.user_id
        """
    )
    op.alter_column("shelves", "library_id", nullable=False)
    op.create_foreign_key(
        "fk_shelves_library_id", "shelves", "libraries", ["library_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_shelves_library_id", "shelves", ["library_id"])
    op.drop_constraint("uq_shelves_user_name", "shelves", type_="unique")
    op.create_unique_constraint("uq_shelves_library_name", "shelves", ["library_id", "name"])
    op.drop_index("ix_shelves_user_id", table_name="shelves")
    op.drop_constraint("fk_shelves_user_id", "shelves", type_="foreignkey")
    op.drop_column("shelves", "user_id")

    # 7. Tags: user_id -> library_id
    op.add_column("tags", sa.Column("library_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE tags SET library_id = u.library_id
        FROM users u WHERE u.id = tags.user_id
        """
    )
    op.alter_column("tags", "library_id", nullable=False)
    op.create_foreign_key(
        "fk_tags_library_id", "tags", "libraries", ["library_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_tags_library_id", "tags", ["library_id"])
    op.drop_constraint("uq_tags_user_name", "tags", type_="unique")
    op.create_unique_constraint("uq_tags_library_name", "tags", ["library_id", "name"])
    op.drop_index("ix_tags_user_id", table_name="tags")
    op.drop_constraint("fk_tags_user_id", "tags", type_="foreignkey")
    op.drop_column("tags", "user_id")

    # 8. Loans: user_id -> library_id, keep the lender
    op.add_column("book_loans", sa.Column("library_id", sa.Integer(), nullable=True))
    op.add_column("book_loans", sa.Column("created_by_user_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE book_loans SET library_id = u.library_id, created_by_user_id = book_loans.user_id
        FROM users u WHERE u.id = book_loans.user_id
        """
    )
    op.alter_column("book_loans", "library_id", nullable=False)
    op.create_foreign_key(
        "fk_book_loans_library_id", "book_loans", "libraries", ["library_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_book_loans_created_by_user_id",
        "book_loans",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_book_loans_library_id", "book_loans", ["library_id"])
    op.drop_index("ix_book_loans_user_id", table_name="book_loans")
    op.drop_constraint("book_loans_user_id_fkey", "book_loans", type_="foreignkey")
    op.drop_column("book_loans", "user_id")


def downgrade() -> None:
    raise NotImplementedError(
        "Users can share one library after 0007. The per-user owner mapping is lost. "
        "Restore from a pg_dump taken before the upgrade."
    )

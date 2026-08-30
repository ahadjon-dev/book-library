"""add user_id to books, shelves, and tags for multi-tenancy

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-31

"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add nullable user_id columns
    op.add_column("books", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("shelves", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("tags", sa.Column("user_id", sa.Integer(), nullable=True))

    # 2. Backfill books.user_id:
    # Pick user from user_book_status; if none, fallback to lowest user ID
    op.execute("""
        UPDATE books
        SET user_id = COALESCE(
            (SELECT ubs.user_id FROM user_book_status ubs WHERE ubs.book_id = books.id LIMIT 1),
            (SELECT id FROM users ORDER BY id ASC LIMIT 1)
        )
    """)

    # 3. Backfill shelves.user_id from associated books or fallback to lowest user ID
    op.execute("""
        UPDATE shelves
        SET user_id = COALESCE(
            (SELECT b.user_id FROM books b WHERE b.shelf_id = shelves.id AND b.user_id IS NOT NULL LIMIT 1),
            (SELECT id FROM users ORDER BY id ASC LIMIT 1)
        )
    """)

    # 4. Backfill tags.user_id from associated books or fallback to lowest user ID
    op.execute("""
        UPDATE tags
        SET user_id = COALESCE(
            (SELECT b.user_id FROM book_tags bt JOIN books b ON b.id = bt.book_id WHERE bt.tag_id = tags.id AND b.user_id IS NOT NULL LIMIT 1),
            (SELECT id FROM users ORDER BY id ASC LIMIT 1)
        )
    """)

    # Fallback in case tables are empty or null
    op.execute("UPDATE books SET user_id = 1 WHERE user_id IS NULL")
    op.execute("UPDATE shelves SET user_id = 1 WHERE user_id IS NULL")
    op.execute("UPDATE tags SET user_id = 1 WHERE user_id IS NULL")

    # 5. Alter columns to NOT NULL, add foreign keys and indexes
    op.alter_column("books", "user_id", nullable=False)
    op.create_foreign_key("fk_books_user_id", "books", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_books_user_id", "books", ["user_id"])
    op.create_index("ix_books_user_genre", "books", ["user_id", "genre"])
    op.create_index("ix_books_user_isbn", "books", ["user_id", "isbn"])

    op.alter_column("shelves", "user_id", nullable=False)
    op.create_foreign_key("fk_shelves_user_id", "shelves", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_shelves_user_id", "shelves", ["user_id"])
    op.drop_constraint("shelves_name_key", "shelves", type_="unique")
    op.create_unique_constraint("uq_shelves_user_name", "shelves", ["user_id", "name"])

    op.alter_column("tags", "user_id", nullable=False)
    op.create_foreign_key("fk_tags_user_id", "tags", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_tags_user_id", "tags", ["user_id"])
    op.drop_constraint("tags_name_key", "tags", type_="unique")
    op.create_unique_constraint("uq_tags_user_name", "tags", ["user_id", "name"])


def downgrade() -> None:
    op.drop_constraint("uq_tags_user_name", "tags", type_="unique")
    op.create_unique_constraint("tags_name_key", "tags", ["name"])
    op.drop_index("ix_tags_user_id", table_name="tags")
    op.drop_constraint("fk_tags_user_id", "tags", type_="foreignkey")
    op.drop_column("tags", "user_id")

    op.drop_constraint("uq_shelves_user_name", "shelves", type_="unique")
    op.create_unique_constraint("shelves_name_key", "shelves", ["name"])
    op.drop_index("ix_shelves_user_id", table_name="shelves")
    op.drop_constraint("fk_shelves_user_id", "shelves", type_="foreignkey")
    op.drop_column("shelves", "user_id")

    op.drop_index("ix_books_user_isbn", table_name="books")
    op.drop_index("ix_books_user_genre", table_name="books")
    op.drop_index("ix_books_user_id", table_name="books")
    op.drop_constraint("fk_books_user_id", "books", type_="foreignkey")
    op.drop_column("books", "user_id")

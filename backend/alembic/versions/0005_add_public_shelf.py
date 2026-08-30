"""add share_slug and is_public_shelf to users

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-30

"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("share_slug", sa.String(length=100), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_public_shelf", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_index("ix_users_share_slug", "users", ["share_slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_share_slug", table_name="users")
    op.drop_column("users", "is_public_shelf")
    op.drop_column("users", "share_slug")

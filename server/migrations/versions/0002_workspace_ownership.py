"""Add workspace ownership to existing business records.

Revision ID: 0002_workspace_ownership
Revises: 0001_existing_schema
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_workspace_ownership"
down_revision = "0001_existing_schema"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    required = {"business_account", "client", "document", "product"}
    missing = required - existing_tables
    if missing:
        raise RuntimeError(
            f"Required tables are missing; refusing migration: {sorted(missing)}"
        )

    # SQLite requires batch mode to add or repair foreign-key constraints.
    for table in ("client", "document", "product"):
        inspector = sa.inspect(bind)
        columns = {
            col["name"] for col in inspector.get_columns(table)
        }
        foreign_keys = inspector.get_foreign_keys(table)

        has_workspace_fk = any(
            fk.get("referred_table") == "business_account"
            and fk.get("constrained_columns") == ["workspace_id"]
            and fk.get("referred_columns") == ["id"]
            for fk in foreign_keys
        )

        if "workspace_id" not in columns or not has_workspace_fk:
            with op.batch_alter_table(
                table, recreate="always"
            ) as batch_op:
                if "workspace_id" not in columns:
                    batch_op.add_column(
                        sa.Column("workspace_id", sa.Integer(), nullable=True)
                    )

                if not has_workspace_fk:
                    batch_op.create_foreign_key(
                        f"fk_{table}_workspace_id_business_account",
                        "business_account",
                        ["workspace_id"],
                        ["id"],
                    )

        # Add an index if one does not already exist.
        inspector = sa.inspect(bind)
        indexes = inspector.get_indexes(table)
        if not any(
            index.get("column_names") == ["workspace_id"]
            for index in indexes
        ):
            op.create_index(
                f"ix_{table}_workspace_id",
                table,
                ["workspace_id"],
            )

    # Keep pre-account records isolated until their real ownership is verified.
    legacy_name = "Legacy records — ownership unverified"
    legacy_id = bind.execute(
        sa.text(
            "SELECT id FROM business_account "
            "WHERE name = :name ORDER BY id LIMIT 1"
        ),
        {"name": legacy_name},
    ).scalar()

    if legacy_id is None:
        legacy_id = bind.execute(
            sa.text(
                "INSERT INTO business_account (name, created_at) "
                "VALUES (:name, :created_at) "
                "RETURNING id"
            ),
            {
                "name": legacy_name,
                "created_at": "2026-10-25 00:00:00",
            },
        ).scalar_one()

    for table in ("client", "document", "product"):
        bind.execute(
            sa.text(
                f'UPDATE "{table}" SET workspace_id = :workspace_id '
                "WHERE workspace_id IS NULL"
            ),
            {"workspace_id": legacy_id},
        )


def downgrade():
    raise RuntimeError(
        "Automatic downgrade is disabled to protect workspace ownership. "
        "Restore a verified backup if rollback is required."
    )

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

def utcnow():
    return datetime.now(timezone.utc)

def register_auth_models(db: SQLAlchemy):
    class BusinessAccount(db.Model):
        __tablename__ = "business_account"

        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(180), nullable=False)
        created_at = db.Column(
            db.DateTime(timezone=True), nullable=False, default=utcnow
        )

    class User(db.Model):
        __tablename__ = "user"

        id = db.Column(db.Integer, primary_key=True)
        workspace_id = db.Column(
            db.Integer,
            db.ForeignKey("business_account.id"),
            nullable=False,
            index=True,
        )
        name = db.Column(db.String(160), nullable=False)
        email = db.Column(db.String(254), nullable=False, unique=True, index=True)
        password_hash = db.Column(db.String(255), nullable=False)
        role = db.Column(db.String(20), nullable=False, default="owner")
        is_active = db.Column(db.Boolean, nullable=False, default=True)
        email_verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
        created_at = db.Column(
            db.DateTime(timezone=True), nullable=False, default=utcnow
        )

    class Subscription(db.Model):
        __tablename__ = "subscription"

        id = db.Column(db.Integer, primary_key=True)
        workspace_id = db.Column(
            db.Integer,
            db.ForeignKey("business_account.id"),
            nullable=False,
            unique=True,
        )
        plan = db.Column(db.String(30), nullable=False, default="free")
        status = db.Column(db.String(30), nullable=False, default="pilot")
        created_at = db.Column(
            db.DateTime(timezone=True), nullable=False, default=utcnow
        )

    class Usage(db.Model):
        __tablename__ = "usage"

        id = db.Column(db.Integer, primary_key=True)
        workspace_id = db.Column(
            db.Integer,
            db.ForeignKey("business_account.id"),
            nullable=False,
            index=True,
        )
        period = db.Column(db.String(7), nullable=False)
        metric = db.Column(db.String(40), nullable=False)
        quantity = db.Column(db.Integer, nullable=False, default=0)

        __table_args__ = (
            db.UniqueConstraint(
                "workspace_id", "period", "metric",
                name="uq_usage_workspace_period_metric",
            ),
        )

    return BusinessAccount, User, Subscription, Usage

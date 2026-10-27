
import io
import math
import os
import re
import secrets
from datetime import datetime, timezone, date
from functools import wraps
from html import escape

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, session, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.exc import IntegrityError

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)

load_dotenv()

app = Flask(__name__, instance_relative_config=True)
os.makedirs(app.instance_path, exist_ok=True)

# Database configuration
url = os.getenv("DATABASE_URL", "").strip()
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql+psycopg://", 1)
elif url.startswith("postgresql://") and "+psycopg" not in url:
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = (
    url or "sqlite:///" + os.path.join(app.instance_path, "afromindstack.db")
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

secret_key = os.getenv("SECRET_KEY", "").strip()
if not secret_key:
    raise RuntimeError(
        "SECRET_KEY is missing. Set it in server/.env before starting the API."
    )
app.config["SECRET_KEY"] = secret_key

# Server-side sessions
session_dir = os.path.join(app.instance_path, "sessions")
os.makedirs(session_dir, exist_ok=True)

app.config.update(
    SESSION_TYPE="filesystem",
    SESSION_FILE_DIR=session_dir,
    SESSION_PERMANENT=False,
    SESSION_USE_SIGNER=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "0") == "1",
)

db = SQLAlchemy(app)
migrate = Migrate(app, db)
Session(app)

# Only allow the configured frontend origin.
frontend_origin = os.getenv(
    "FRONTEND_ORIGIN", "http://localhost:5173"
).rstrip("/")

CORS(
    app,
    resources={r"/api/*": {"origins": [frontend_origin]}},
    supports_credentials=True,
)

from auth_models import register_auth_models

BusinessAccount, User, Subscription, Usage = register_auth_models(db)


class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    company = db.Column(db.String(180), nullable=False)
    email = db.Column(db.String(254), nullable=False, default="")
    phone = db.Column(db.String(40), nullable=False, default="")
    created_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("business_account.id"),
        nullable=True, index=True
    )


class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(80), unique=True, nullable=False)
    kind = db.Column(db.String(20), nullable=False)
    client = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String(10), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(30), nullable=False, default="Draft")
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("business_account.id"),
        nullable=True, index=True
    )


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Float, nullable=False)
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("business_account.id"),
        nullable=True, index=True
    )


def user_payload(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "workspace_id": user.workspace_id,
    }


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify(error="Authentication required"), 401

        user = db.session.get(User, user_id)
        if user is None or not user.is_active:
            session.clear()
            return jsonify(error="Authentication required"), 401

        g.current_user = user
        return view(*args, **kwargs)

    return wrapped


@app.get("/api/health")
def health():
    return jsonify(
        status="ok",
        service="afromindstack-api",
        time=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")
    workspace_name = str(
        data.get("business_name") or name
    ).strip()

    if not name or len(name) > 160:
        return jsonify(error="Enter a valid name"), 400

    if (
        not email or len(email) > 254
        or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
    ):
        return jsonify(error="Enter a valid email address"), 400

    if not isinstance(password, str) or len(password) < 10:
        return jsonify(error="Password must be at least 10 characters"), 400

    if len(password) > 256:
        return jsonify(error="Password is too long"), 400

    if not workspace_name or len(workspace_name) > 180:
        return jsonify(error="Enter a valid business name"), 400

    if User.query.filter_by(email=email).first():
        return jsonify(error="An account with this email already exists"), 409

    try:
        workspace = BusinessAccount(name=workspace_name)
        db.session.add(workspace)
        db.session.flush()

        user = User(
            workspace_id=workspace.id,
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role="owner",
        )
        subscription = Subscription(
            workspace_id=workspace.id,
            plan="free",
            status="pilot",
        )

        db.session.add_all([user, subscription])
        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Could not create account. Check the details."), 409
    except Exception:
        db.session.rollback()
        app.logger.exception("Registration failed")
        return jsonify(error="Could not create account"), 500

    session.clear()
    session["user_id"] = user.id
    session.permanent = False
    app.session_interface.regenerate(session)

    return jsonify(user=user_payload(user)), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()

    if (
        user is None
        or not user.is_active
        or not isinstance(password, str)
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify(error="Invalid email or password"), 401

    session.clear()
    session["user_id"] = user.id
    session.permanent = False
    app.session_interface.regenerate(session)

    return jsonify(user=user_payload(user))


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify(logged_out=True)


@app.get("/api/auth/me")
@login_required
def current_session():
    return jsonify(user=user_payload(g.current_user))


@app.get("/api/clients")
@login_required
def list_clients():
    rows = Client.query.filter_by(
        workspace_id=g.current_user.workspace_id
    ).order_by(Client.id.desc()).all()

    return jsonify([
        {
            "id": c.id,
            "name": c.name,
            "company": c.company,
            "email": c.email,
            "phone": c.phone,
        }
        for c in rows
    ])


@app.post("/api/clients")
@login_required
def create_client():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    company = str(data.get("company", "")).strip()

    if not name or not company:
        return jsonify(error="name and company are required"), 400

    c = Client(
        name=name,
        company=company,
        email=str(data.get("email", "")).strip(),
        phone=str(data.get("phone", "")).strip(),
        workspace_id=g.current_user.workspace_id,
    )
    db.session.add(c)
    db.session.commit()

    return jsonify(
        id=c.id, name=c.name, company=c.company,
        email=c.email, phone=c.phone
    ), 201


@app.delete("/api/clients/<int:client_id>")
@login_required
def delete_client(client_id):
    c = Client.query.filter_by(
        id=client_id,
        workspace_id=g.current_user.workspace_id,
    ).first()

    if c is None:
        return jsonify(error="Client not found"), 404

    db.session.delete(c)
    db.session.commit()
    return jsonify(deleted=True)


@app.get("/api/documents")
@login_required
def list_documents():
    rows = Document.query.filter_by(
        workspace_id=g.current_user.workspace_id
    ).order_by(Document.id.desc()).all()

    return jsonify([
        {
            "id": r.reference,
            "kind": r.kind,
            "client": r.client,
            "date": r.date,
            "amount": r.amount,
            "status": r.status,
        }
        for r in rows
    ])


@app.post("/api/documents")
@login_required
def create_document():
    data = request.get_json(silent=True) or {}
    kind = str(data.get("kind", "")).strip()
    client = str(data.get("client", "")).strip()

    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify(error="A valid amount is required"), 400

    if (
        kind not in ("Quote", "Invoice")
        or not client
        or not math.isfinite(amount)
        or amount <= 0
    ):
        return jsonify(
            error="Valid type, client and positive amount are required"
        ), 400

    reference = str(data.get("id", "")).strip()
    if not reference:
        reference = (
            f"{'Q' if kind == 'Quote' else 'INV'}-{secrets.token_hex(8)}"
        )

    if len(reference) > 80:
        return jsonify(error="Document reference is too long"), 400

    # References are globally unique in the existing schema.
    if Document.query.filter_by(reference=reference).first():
        return jsonify(error="Could not use this document reference"), 409

    row = Document(
        reference=reference,
        kind=kind,
        client=client,
        date=str(data.get("date") or date.today().isoformat())[:10],
        amount=amount,
        status="Draft",
        workspace_id=g.current_user.workspace_id,
    )

    db.session.add(row)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Could not use this document reference"), 409

    return jsonify(
        id=row.reference, kind=row.kind, client=row.client,
        date=row.date, amount=row.amount, status=row.status
    ), 201


@app.patch("/api/documents/<path:reference>")
@login_required
def update_document(reference):
    row = Document.query.filter_by(
        reference=reference,
        workspace_id=g.current_user.workspace_id,
    ).first()

    if row is None:
        return jsonify(error="Document not found"), 404

    status = str(
        (request.get_json(silent=True) or {}).get("status", "")
    ).strip()

    if status not in {
        "Draft", "Sent", "Paid", "Overdue", "Accepted", "Declined"
    }:
        return jsonify(error="Invalid document status"), 400

    row.status = status
    db.session.commit()
    return jsonify(id=row.reference, status=row.status)


@app.get("/api/products")
@login_required
def list_products():
    rows = Product.query.filter_by(
        workspace_id=g.current_user.workspace_id
    ).order_by(Product.id.desc()).all()

    return jsonify([
        {"id": r.id, "name": r.name, "price": r.price}
        for r in rows
    ])


@app.post("/api/products")
@login_required
def create_product():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()

    try:
        price = float(data.get("price", -1))
    except (TypeError, ValueError):
        return jsonify(error="A valid price is required"), 400

    if not name or not math.isfinite(price) or price < 0:
        return jsonify(
            error="Name and non-negative price are required"
        ), 400

    row = Product(
        name=name,
        price=price,
        workspace_id=g.current_user.workspace_id,
    )
    db.session.add(row)
    db.session.commit()

    return jsonify(id=row.id, name=row.name, price=row.price), 201


@app.delete("/api/products/<int:product_id>")
@login_required
def delete_product(product_id):
    row = Product.query.filter_by(
        id=product_id,
        workspace_id=g.current_user.workspace_id,
    ).first()

    if row is None:
        return jsonify(error="Product not found"), 404

    db.session.delete(row)
    db.session.commit()
    return jsonify(deleted=True)


@app.post("/api/pdf")
@login_required
def generate_pdf():
    data = request.get_json(silent=True) or {}
    kind = escape(str(data.get("kind", "Invoice"))[:30])
    reference = escape(str(data.get("reference", "DRAFT"))[:60])
    client = escape(str(data.get("client", "Customer"))[:180])

    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify(error="amount must be numeric"), 400

    if not math.isfinite(amount) or amount < 0:
        return jsonify(error="amount must be a non-negative number"), 400

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=22 * mm, leftMargin=22 * mm,
        topMargin=22 * mm, bottomMargin=22 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="Brand", parent=styles["Title"],
        textColor=colors.HexColor("#4E8B13"), alignment=0,
    ))

    story = [
        Paragraph("AfromindStack", styles["Brand"]),
        Spacer(1, 5 * mm),
        Paragraph(kind.title(), styles["Heading1"]),
        Paragraph("Reference: " + reference, styles["Normal"]),
        Paragraph("Customer: " + client, styles["Normal"]),
        Spacer(1, 8 * mm),
    ]

    table = Table(
        [
            ["Description", "Amount (ZAR)"],
            [kind + " — " + reference, "R {:,.2f}".format(amount)],
        ],
        colWidths=[110 * mm, 48 * mm],
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172017")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), .5, colors.HexColor("#DDE4D9")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 10),
    ]))
    story.extend([
        table,
        Spacer(1, 8 * mm),
        Paragraph(
            "Starter template only. Add your registered business details "
            "and review applicable South African invoicing requirements.",
            styles["Italic"],
        ),
    ])

    doc.build(story)
    buf.seek(0)

    filename = kind.lower().replace("/", "-") + "-" + reference.replace("/", "-") + ".pdf"
    return send_file(
        buf, mimetype="application/pdf",
        as_attachment=True, download_name=filename,
    )


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )

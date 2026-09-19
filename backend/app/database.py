import os
from sqlalchemy import create_engine
from sqlalchemy.orm  import sessionmaker, declarative_base

DB_PATH = os.environ.get("CODEVEIL_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "codeveil.db"))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_db_schema_up_to_date():
    """Ensure database schema is up-to-date by dynamically adding missing columns."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        with engine.begin() as conn:
            if "totp_secret" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN totp_secret VARCHAR(500) NULL"))
            if "totp_enabled" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT 0"))
            if "otp_hash" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN otp_hash VARCHAR(255) NULL"))
            if "otp_expiry" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN otp_expiry DATETIME NULL"))
            if "otp_attempts" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN otp_attempts INTEGER DEFAULT 0"))
            if "otp_last_sent" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN otp_last_sent DATETIME NULL"))

    if "bidders" in inspector.get_table_names():
        b_cols = [c["name"] for c in inspector.get_columns("bidders")]
        with engine.begin() as conn:
            if "email" not in b_cols:
                conn.execute(text("ALTER TABLE bidders ADD COLUMN email VARCHAR(255) NULL"))
            if "email_verified" not in b_cols:
                conn.execute(text("ALTER TABLE bidders ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
            if "last_report_sent_at" not in b_cols:
                conn.execute(text("ALTER TABLE bidders ADD COLUMN last_report_sent_at DATETIME NULL"))
            if "last_report_status" not in b_cols:
                conn.execute(text("ALTER TABLE bidders ADD COLUMN last_report_status VARCHAR(50) NULL"))

            # Backfill synthetic emails for all existing bidders
            conn.execute(text("""
                UPDATE bidders 
                SET email = LOWER(REPLACE(legal_name, ' ', '.')) || '@example.com',
                    email_verified = 1
                WHERE email IS NULL OR email = ''
            """))

            # Set ONE specific existing bidder's email to real test address
            conn.execute(text("""
                UPDATE bidders 
                SET email = 'sanabhuvi2529@gmail.com',
                    email_verified = 1
                WHERE id = 1 AND legal_name = 'Suryodaya Safety Systems Pvt Ltd'
            """))



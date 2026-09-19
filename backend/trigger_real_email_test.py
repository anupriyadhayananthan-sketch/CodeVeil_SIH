import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.auth_2fa_service import send_email, _load_env_file
from app.database import engine, Base, SessionLocal, ensure_db_schema_up_to_date
from app.models import Bidder, Tender, VerificationResult
from app.notifications.compliance_email_service import send_compliance_report_email

def main():
    _load_env_file()
    print("=" * 60)
    print("TRIGGERING REAL EMAIL TEST TO sanabhuvi2529@gmail.com")
    print("=" * 60)
    print("Environment Config Check:")
    print(f"  SMTP_HOST: {os.environ.get('SMTP_HOST')}")
    print(f"  SMTP_PORT: {os.environ.get('SMTP_PORT')}")
    print(f"  SMTP_USER: {os.environ.get('SMTP_USER')}")
    print(f"  SMTP_APP_PASSWORD set: {'Yes' if os.environ.get('SMTP_APP_PASSWORD') else 'No'}")
    print("-" * 60)

    # Ensure DB schema is up-to-date
    Base.metadata.create_all(bind=engine)
    ensure_db_schema_up_to_date()

    db = SessionLocal()
    b1 = db.query(Bidder).filter(Bidder.id == 1).first()
    if not b1:
        print("[ERROR] Bidder 1 not found in database!")
        return

    print(f"Target Bidder: {b1.legal_name} (Email: {b1.email})")

    # Test 1: Direct send_email call to real address
    print("\n--- Sending Test 1: Direct send_email ---")
    subject = "[CodeVeil GeM Platform] Real Email Delivery Verification Test"
    body = """Dear Recipient,

This is a real email delivery verification test sent from the CodeVeil GeM Procurement Platform.

Your Gmail SMTP configuration with App Password authentication has been verified successfully.

System details:
- Environment: CodeVeil Local / SIH Platform
- Target Recipient: sanabhuvi2529@gmail.com
- Delivery Mechanism: Gmail SMTP (smtplib + TLS on port 587)

Regards,
CodeVeil Engineering Team
"""
    success = send_email("sanabhuvi2529@gmail.com", subject, body)
    print(f"Direct send_email Result: {'SUCCESS' if success else 'FAILED'}")

    # Test 2: Trigger via Compliance Report Email Flow
    print("\n--- Sending Test 2: Compliance Report Flow ---")
    rep_ok, rep_msg = send_compliance_report_email(db, b1.id, "QUALIFIED", "Automated verification passed")
    print(f"Compliance Report Email Flow Result: {'SUCCESS' if rep_ok else 'FAILED'} -> Message: {rep_msg}")

    # Test 3: Verify mock routing for non-test recipient (@example.com)
    print("\n--- Sending Test 3: Mock Recipient Routing ---")
    mock_ok = send_email("bidder2@example.com", "[CodeVeil GeM] Mock Notice", "Mock body content")
    print(f"Mock Recipient Result: {'SUCCESS (Mocked)' if mock_ok else 'FAILED'}")

    db.close()

if __name__ == "__main__":
    main()

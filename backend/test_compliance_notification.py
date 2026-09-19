import os
import sys
import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal, ensure_db_schema_up_to_date
from app.models import Bidder, Tender, Requirement, VerificationResult, OfficerDecision, AuditLog
from app.notifications.compliance_email_service import (
    send_compliance_report_email, resend_compliance_report_email,
    build_qualified_email_body, build_disqualified_email_body, MAX_RESENDS_PER_HOUR
)

def run_tests():
    print("=" * 60)
    print("RUNNING COMPLIANCE REPORT NOTIFICATION & EMAIL TESTS")
    print("=" * 60)

    # 1. Database Schema & Backfill Check
    print("\n[Test 1] Verifying Database Schema & Email Backfill...")
    Base.metadata.create_all(bind=engine)
    ensure_db_schema_up_to_date()
    db = SessionLocal()

    b1 = db.query(Bidder).filter(Bidder.id == 1).first()
    assert b1 is not None, "Bidder ID 1 missing!"
    assert b1.email == "sanabhuvi2529@gmail.com", f"Expected 'sanabhuvi2529@gmail.com', got '{b1.email}'"
    assert b1.email_verified is True, "email_verified was not set to True!"
    print(f"  [OK] Bidder 1 correctly assigned target test email: {b1.legal_name} -> {b1.email}")

    total_with_email = db.query(Bidder).filter(Bidder.email.isnot(None)).count()
    total_bidders = db.query(Bidder).count()
    assert total_with_email == total_bidders, f"Backfill incomplete! {total_with_email}/{total_bidders} have emails."
    print(f"  [OK] All {total_bidders} bidders backfilled with valid email addresses.")

    # 2. Email Template Generation Test
    print("\n[Test 2] Testing QUALIFIED and DISQUALIFIED Email Templates...")
    tender = db.query(Tender).filter(Tender.id == b1.tender_id).first()
    verifications = db.query(VerificationResult).filter(VerificationResult.bidder_id == b1.id).all()

    qual_body = build_qualified_email_body(b1, tender, verifications)
    assert "Notice of Qualification" in qual_body, "Qualification title missing from body!"
    assert "procurement-support@cpcl.gov.in" in qual_body, "Contact reply-to footer missing!"
    print("  [OK] QUALIFIED template generated successfully with formal confirmation tone & contact footer.")

    b2 = db.query(Bidder).filter(Bidder.id == 2).first() # Vendhar Fire Solutions (Missing-doc archetype)
    v2_list = db.query(VerificationResult).filter(VerificationResult.bidder_id == b2.id).all()
    disqual_body = build_disqualified_email_body(b2, tender, v2_list)
    assert "Notice of Evaluation Outcome" in disqual_body, "Disqualification title missing!"
    assert "REQUIREMENT-BY-REQUIREMENT EVALUATION BREAKDOWN" in disqual_body, "Requirement breakdown missing!"
    assert "procurement-support@cpcl.gov.in" in disqual_body, "Contact reply-to footer missing!"
    print("  [OK] DISQUALIFIED template generated successfully with requirement breakdown.")

    # 3. Email Dispatch & Audit Trail Logging Test
    print("\n[Test 3] Testing Email Dispatch & Audit Logging...")
    ok, msg = send_compliance_report_email(db, b1.id, "QUALIFIED", "Meets all mandatory criteria")
    assert ok, f"Email dispatch failed: {msg}"
    assert b1.last_report_status == "SENT", "last_report_status was not set to SENT!"
    assert b1.last_report_sent_at is not None, "last_report_sent_at was not recorded!"

    audit_entry = db.query(AuditLog).filter(
        AuditLog.action_type == "BIDDER_REPORT_EMAIL_SENT",
        AuditLog.entity_id == str(b1.id)
    ).order_by(AuditLog.id.desc()).first()
    assert audit_entry is not None, "Audit log entry BIDDER_REPORT_EMAIL_SENT missing!"
    print("  [OK] Report email dispatched and logged under audit action 'BIDDER_REPORT_EMAIL_SENT'.")

    # 4. Resend Rate Limiting Test
    print("\n[Test 4] Testing Manual Resend Rate Limiting (Max 3 per hour)...")
    # Reset resend count in test DB for clean rate limit test
    db.query(AuditLog).filter(
        AuditLog.entity_id == str(b1.id),
        AuditLog.action_type.in_(["BIDDER_REPORT_EMAIL_SENT", "BIDDER_REPORT_RESENT"])
    ).delete()
    db.commit()

    # Resend 3 times successfully
    for i in range(MAX_RESENDS_PER_HOUR):
        ok_r, msg_r = resend_compliance_report_email(db, b1.id, "officer@cpcl.gov.in")
        assert ok_r, f"Resend attempt {i+1} failed: {msg_r}"
    print(f"  [OK] Successfully executed {MAX_RESENDS_PER_HOUR} manual resends.")

    # 4th resend must fail with HTTP 429 Rate Limit
    try:
        resend_compliance_report_email(db, b1.id, "officer@cpcl.gov.in")
        assert False, "4th resend attempt was wrongly allowed! Rate limit failed."
    except Exception as e:
        assert "429" in str(e) or "Rate limit exceeded" in str(e), f"Unexpected exception: {e}"
        print("  [OK] Rate limit enforced: 4th manual resend correctly blocked with HTTP 429.")

    db.close()
    print("\n" + "=" * 60)
    print("ALL COMPLIANCE REPORT NOTIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

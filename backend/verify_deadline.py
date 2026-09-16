import os
import sys
import datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import Tender, User, AuditLog
from app.auth import create_access_token

client = TestClient(app)

def run_deadline_verification():
    print("=" * 80)
    print("CODEVEIL TENDER SUBMISSION DEADLINE & AUTO-CLOSE VERIFICATION SUITE")
    print("=" * 80)

    db = SessionLocal()

    # Get or create officer token for auth
    officer = db.query(User).filter(User.role == "Procurement Officer").first()
    if not officer:
        print("❌ Error: Default officer user not found in database. Run seed.py first.")
        sys.exit(1)

    token = create_access_token(data={"sub": officer.email, "user_id": officer.id, "role": officer.role})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test Creating a Tender Without a Deadline (Must be rejected with 400)
    print("\n[TEST 1/6] Attempting to create a tender without a submission deadline...")
    res1 = client.post(
        "/api/tenders/upload",
        headers=headers,
        data={
            "tender_number": "GEM/2026/B/TEST-NO-DEADLINE",
            "title": "Test Tender Without Deadline",
            "issuing_authority": "CPCL Testing Dept",
            "category": "Safety Equipment"
        },
        files={"file": ("test.pdf", b"%PDF-1.4 dummy tender content for testing", "application/pdf")}
    )
    print(f"  Response Status: {res1.status_code}, Detail: {res1.json().get('detail')}")
    assert res1.status_code == 400, "Creating tender without submission deadline MUST be rejected with HTTP 400"
    assert "Submission deadline is required" in res1.json()["detail"]
    print("  [OK] PASSED: Missing submission deadline rejected.")

    # 2. Test Creating a Tender With a Past Deadline (Must be rejected with 400)
    print("\n[TEST 2/6] Attempting to create a tender with a PAST submission deadline...")
    past_deadline = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat()
    res2 = client.post(
        "/api/tenders/upload",
        headers=headers,
        data={
            "tender_number": "GEM/2026/B/TEST-PAST-DEADLINE",
            "title": "Test Tender With Past Deadline",
            "issuing_authority": "CPCL Testing Dept",
            "category": "Safety Equipment",
            "submission_deadline": past_deadline
        },
        files={"file": ("test.pdf", b"%PDF-1.4 dummy tender content for testing", "application/pdf")}
    )
    print(f"  Response Status: {res2.status_code}, Detail: {res2.json().get('detail')}")
    assert res2.status_code == 400, "Creating tender with past deadline MUST be rejected with HTTP 400"
    assert "in the future" in res2.json()["detail"]
    print("  [OK] PASSED: Past submission deadline rejected.")

    # 3. Create an Expired Tender directly in DB to test direct API rejection of uploads
    print("\n[TEST 3/6] Setting up a closed tender with past deadline in database...")
    expired_tender = Tender(
        tender_number="GEM/2026/B/EXPIRED-001",
        title="Expired Maintenance Tender Scenario",
        issuing_authority="CPCL Refineries",
        category="Maintenance Service",
        status="ACTIVE",
        submission_deadline=datetime.datetime.utcnow() - datetime.timedelta(hours=2),
        created_by_id=officer.id
    )
    db.add(expired_tender)
    db.commit()
    db.refresh(expired_tender)
    print(f"  Created Tender #{expired_tender.id} ({expired_tender.tender_number}) with deadline: {expired_tender.submission_deadline}")

    # 4. Test Raw API Call Uploading Bidder Document Package to Closed Tender (Must be rejected with 403)
    print("\n[TEST 4/6] Executing raw API call POST /api/bidders/upload to the closed tender...")
    res3 = client.post(
        "/api/bidders/upload",
        headers=headers,
        data={
            "tender_id": str(expired_tender.id),
            "legal_name": "Late Attacker Submissions Ltd",
            "archetype": "Clean",
            "bid_amount_inr": "5000000"
        },
        files={"files": ("PAN.pdf", b"%PDF-1.4 dummy bidder pdf content", "application/pdf")}
    )
    print(f"  Response Status: {res3.status_code}, Detail: {res3.json().get('detail')}")
    assert res3.status_code == 403, "Direct API upload to a closed tender MUST be rejected with HTTP 403"
    assert "deadline has passed" in res3.json()["detail"]
    print("  [OK] PASSED: Raw API call upload to closed tender rejected with HTTP 403.")

    # 5. Verify Audit Logs for Late Submission Rejection
    print("\n[TEST 5/6] Verifying audit logs for LATE_SUBMISSION_REJECTED event...")
    late_log = db.query(AuditLog).filter(AuditLog.action_type == "LATE_SUBMISSION_REJECTED").order_by(AuditLog.id.desc()).first()
    assert late_log is not None, "Audit log for LATE_SUBMISSION_REJECTED must be created"
    print(f"  Found Audit Log #{late_log.id}: Action='{late_log.action_type}', Details='{late_log.details_json[:80]}...'")
    print("  [OK] PASSED: Late submission rejection audit trail verified.")

    # 6. Test Reading Closed Tender Data (Must remain fully viewable with HTTP 200)
    print("\n[TEST 6/6] Verifying closed tender data (bidders, requirements) remains readable...")
    res4 = client.get(f"/api/tenders/{expired_tender.id}", headers=headers)
    print(f"  GET /api/tenders/{expired_tender.id} Status: {res4.status_code}")
    assert res4.status_code == 200
    t_data = res4.json()
    assert t_data["is_closed"] is True
    assert t_data["effective_status"] == "CLOSED"
    print(f"  Tender Status evaluated dynamically: is_closed={t_data['is_closed']}, effective_status='{t_data['effective_status']}'")

    res5 = client.get(f"/api/bidders/tender/{expired_tender.id}", headers=headers)
    print(f"  GET /api/bidders/tender/{expired_tender.id} Status: {res5.status_code}")
    assert res5.status_code == 200
    print("  [OK] PASSED: Closed tender data remains 100% accessible for viewing.")

    print("\n" + "=" * 80)
    print("ALL TENDER DEADLINE & AUTO-CLOSE VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_deadline_verification()

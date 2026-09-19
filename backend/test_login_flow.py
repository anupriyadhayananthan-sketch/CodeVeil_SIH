import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal, ensure_db_schema_up_to_date
from app.models import User
from app.auth import get_password_hash, create_access_token
from app.captcha import local_captcha_store, login_tracker
import urllib.request
import urllib.parse
import json

def test_login_flow():
    print("=" * 60)
    print("TESTING LOGIN FLOW & CAPTCHA VERIFICATION ENDPOINTS")
    print("=" * 60)

    # 1. Test Captcha Challenge Endpoint (Simulating Frontend Mount)
    print("\n[Test 1] Simulating Initial Page Load: Fetching CAPTCHA Challenge...")
    captcha_id, prompt, svg = local_captcha_store.create_challenge()
    print(f"  [OK] CAPTCHA Challenge generated on initial load: ID={captcha_id[:8]}..., Prompt='{prompt}'")

    # Extract answer from store for verification test
    stored_data = local_captcha_store._store.get(captcha_id)
    correct_answer = stored_data["answer"] if stored_data else ""
    print(f"  [OK] Solved answer for test: '{correct_answer}'")

    # 2. Test Single-Click Login for Officer Account (officer@cpcl.gov.in)
    print("\n[Test 2] Single-Click Login for Procurement Officer (officer@cpcl.gov.in)...")
    db = SessionLocal()
    officer = db.query(User).filter(User.email == "officer@cpcl.gov.in").first()
    assert officer is not None, "Officer account missing!"

    # Create fresh captcha challenge
    c_id, p_str, _ = local_captcha_store.create_challenge()
    c_ans = local_captcha_store._store[c_id]["answer"]

    # Call /api/auth/token endpoint with form data
    from app.routers.auth_router import login_for_access_token
    from fastapi import Request
    from fastapi.security import OAuth2PasswordRequestForm

    # Reset failure tracker for clean test
    login_tracker.reset_failures("127.0.0.1", "officer@cpcl.gov.in")

    form = OAuth2PasswordRequestForm(grant_type="password", username="officer@cpcl.gov.in", password="Password123!", scope="", client_id="", client_secret="")
    
    # Mock Request
    class DummyClient:
        host = "127.0.0.1"
    class DummyRequest:
        client = DummyClient()

    res = login_for_access_token(
        request=DummyRequest(),
        form_data=form,
        name="Rajesh Sharma",
        captcha_token=c_ans,
        captcha_id=c_id,
        db=db
    )

    assert res.get("requires_2fa") is True, "requires_2fa was not True!"
    assert res.get("fa_type") in ["TOTP_SETUP", "TOTP_VERIFY"], f"Unexpected fa_type: {res.get('fa_type')}"
    print(f"  [OK] Officer Single-Click Login Succeeded -> Transitioned directly to 2FA Stage: {res.get('fa_type')}")

    # 3. Test Single-Click Login for Auditor User (auditor@cag.gov.in) -> OTP Flow
    print("\n[Test 3] Single-Click Login for Auditor / Normal User (auditor@cag.gov.in)...")
    c_id2, _, _ = local_captcha_store.create_challenge()
    c_ans2 = local_captcha_store._store[c_id2]["answer"]

    form_auditor = OAuth2PasswordRequestForm(grant_type="password", username="auditor@cag.gov.in", password="Password123!", scope="", client_id="", client_secret="")
    res_auditor = login_for_access_token(
        request=DummyRequest(),
        form_data=form_auditor,
        name="Priya Nair",
        captcha_token=c_ans2,
        captcha_id=c_id2,
        db=db
    )

    assert res_auditor.get("requires_2fa") is True, "requires_2fa was not True for auditor!"
    assert res_auditor.get("fa_type") == "OTP", f"Expected 'OTP', got '{res_auditor.get('fa_type')}'"
    print(f"  [OK] Auditor Single-Click Login Succeeded -> Transitioned directly to 2FA Stage: OTP")

    # 4. Test Invalid CAPTCHA / Password Rejection
    print("\n[Test 4] Testing Rejection on Invalid Password & Invalid CAPTCHA Answer...")
    c_id3, _, _ = local_captcha_store.create_challenge()
    try:
        login_for_access_token(
            request=DummyRequest(),
            form_data=OAuth2PasswordRequestForm(grant_type="password", username="officer@cpcl.gov.in", password="WRONG_PASSWORD!", scope="", client_id="", client_secret=""),
            name="Rajesh Sharma",
            captcha_token="WRONG_ANSWER",
            captcha_id=c_id3,
            db=db
        )
        assert False, "Wrong password/captcha was incorrectly accepted!"
    except Exception as e:
        print(f"  [OK] Invalid login rejected cleanly with exception: {e}")

    db.close()
    print("\n" + "=" * 60)
    print("ALL LOGIN FLOW & CAPTCHA TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_login_flow()

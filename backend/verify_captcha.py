import os
import sys
import json
import logging
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.captcha import get_captcha_provider, log_captcha_startup_status, local_captcha_store, login_tracker

client = TestClient(app)

def run_captcha_verification():
    print("=" * 80)
    print("CODEVEIL CAPTCHA PROTECTION VERIFICATION SUITE")
    print("=" * 80)

    # 1. Test Secret Key Isolation (Frontend Source Code Audit)
    print("[TEST 1/5] Auditing Frontend Source Files for Secret Key Leakage...")
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "src")
    secret_found = False
    if os.path.exists(frontend_dir):
        for root, _, files in os.walk(frontend_dir):
            for file in files:
                if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.html', '.css')):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if 'RECAPTCHA_SECRET_KEY' in content:
                            secret_found = True
                            print(f"  [X] ERROR: RECAPTCHA_SECRET_KEY found in {filepath}")
    if not secret_found:
        print("  [OK] PASSED: No RECAPTCHA_SECRET_KEY found anywhere in frontend source bundle.")
    else:
        sys.exit(1)

    # 2. Test Provider Configuration & Startup Logging
    print("\n[TEST 2/5] Testing CAPTCHA_PROVIDER environment variable switching & startup logs...")
    for provider in ["disabled", "local", "recaptcha"]:
        os.environ["CAPTCHA_PROVIDER"] = provider
        current = get_captcha_provider()
        assert current == provider, f"Expected {provider}, got {current}"
        print(f"  -> Testing startup log for CAPTCHA_PROVIDER={provider}:")
        log_captcha_startup_status()
    print("  [OK] PASSED: Provider switching and startup logging verified successfully.")

    # 3. Test Local CAPTCHA Single-Use & Replay Protection
    print("\n[TEST 3/5] Testing Local CAPTCHA Generation & Single-Use Replay Protection...")
    os.environ["CAPTCHA_PROVIDER"] = "local"
    
    captcha_id, prompt, svg = local_captcha_store.create_challenge()
    expected_answer = local_captcha_store._store[captcha_id]["answer"]
    print(f"  Generated challenge {captcha_id[:8]}... Prompt: '{prompt}', Expected Answer: '{expected_answer}'")
    
    # First verification attempt (should succeed and immediately invalidate)
    valid_first = local_captcha_store.verify_and_invalidate(captcha_id, expected_answer)
    print(f"  First attempt with answer '{expected_answer}': {'[OK] VALID' if valid_first else '[X] INVALID'}")
    assert valid_first is True, "First local captcha verification should succeed"

    # Second verification attempt with same ID (replay attack - must fail!)
    valid_second = local_captcha_store.verify_and_invalidate(captcha_id, expected_answer)
    print(f"  Second attempt (replay attack) with same challenge ID: {'[X] UNEXPECTED VALID' if valid_second else '[OK] REJECTED (SINGLE-USE ENFORCED)'}")
    assert valid_second is False, "Reusing local CAPTCHA answer twice MUST be rejected"
    print("  [OK] PASSED: Single-use replay protection verified.")

    # 4. Test API Direct Call Without CAPTCHA Token (Smart Triggering & Failure Enforcement)
    print("\n[TEST 4/5] Testing Backend /api/auth/token CAPTCHA Enforcement...")
    os.environ["CAPTCHA_PROVIDER"] = "local"
    login_tracker.reset_failures("127.0.0.1", "testuser@codeveil.gov.in")

    # Attempt 1: First failed login attempt (password wrong, no captcha required yet)
    res1 = client.post("/api/auth/token", data={"username": "testuser@codeveil.gov.in", "password": "wrongpassword"})
    print(f"  Attempt 1 (No CAPTCHA): Status {res1.status_code} ({res1.json().get('detail')})")
    assert res1.status_code == 401, "First wrong password should return 401 Incorrect email or password"

    # Attempt 2: Second failed login attempt (triggers failure threshold = 2)
    res2 = client.post("/api/auth/token", data={"username": "testuser@codeveil.gov.in", "password": "wrongpassword"})
    print(f"  Attempt 2 (No CAPTCHA): Status {res2.status_code} ({res2.json().get('detail')})")
    assert res2.status_code == 401

    # Attempt 3: Direct API call without CAPTCHA token when CAPTCHA IS REQUIRED
    res3 = client.post("/api/auth/token", data={"username": "testuser@codeveil.gov.in", "password": "Password123!"})
    print(f"  Attempt 3 (API call without CAPTCHA token when required): Status {res3.status_code} ({res3.json().get('detail')})")
    assert res3.status_code == 400
    assert res3.json()["detail"] == "Verification failed, please try again"
    print("  [OK] PASSED: Missing CAPTCHA token on triggered threshold rejected by backend.")

    # 5. Test Successful Login with Valid Local CAPTCHA
    print("\n[TEST 5/5] Testing Successful Login with Valid CAPTCHA...")
    # Create valid local captcha
    cid, prompt, svg = local_captcha_store.create_challenge()
    ans = local_captcha_store._store[cid]["answer"]
    
    res4 = client.post(
        "/api/auth/token",
        data={
            "username": "officer@cpcl.gov.in",
            "password": "Password123!",
            "captcha_token": ans,
            "captcha_id": cid
        }
    )
    print(f"  Login with valid credentials and valid CAPTCHA: Status {res4.status_code}")
    assert res4.status_code == 200
    assert "access_token" in res4.json()
    print("  [OK] PASSED: Successful authentication with valid CAPTCHA token verified.")

    print("\n" + "=" * 80)
    print("ALL CAPTCHA VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_captcha_verification()

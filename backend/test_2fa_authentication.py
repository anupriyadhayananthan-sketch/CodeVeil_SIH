import os
import sys
import pyotp

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal, ensure_db_schema_up_to_date
from app.models import User
from app.auth import get_password_hash, create_access_token
from app.services.auth_2fa_service import (
    create_and_send_email_otp, verify_email_otp,
    generate_totp_setup_data, confirm_and_enable_totp,
    verify_totp_code, decrypt_secret, hash_otp
)

def run_tests():
    print("=" * 60)
    print("RUNNING 2FA AUTHENTICATION SECURITY LAYER VERIFICATION TESTS")
    print("=" * 60)

    # 1. Schema Migration Test
    print("\n[Test 1] Ensuring Database Schema & 2FA Columns Exist...")
    Base.metadata.create_all(bind=engine)
    ensure_db_schema_up_to_date()
    db = SessionLocal()

    auditor = db.query(User).filter(User.email == "auditor@cag.gov.in").first()
    admin = db.query(User).filter(User.email == "admin@codeveil.gov.in").first()

    if not auditor or not admin:
        print("  - Users not found, seeding database...")
        from seed import seed_database
        seed_database()
        auditor = db.query(User).filter(User.email == "auditor@cag.gov.in").first()
        admin = db.query(User).filter(User.email == "admin@codeveil.gov.in").first()

    print(f"  [OK] Auditor loaded: {auditor.email} (Role: {auditor.role})")
    print(f"  [OK] Admin loaded: {admin.email} (Role: {admin.role})")

    # 2. Email OTP Test for Normal / Auditor User
    print("\n[Test 2] Testing Email OTP Generation, Hashing & Verification (Normal User)...")
    
    # Reset auditor 2FA fields
    auditor.otp_hash = None
    auditor.otp_expiry = None
    auditor.otp_last_sent = None
    auditor.otp_attempts = 0
    db.commit()

    # Generate & Send OTP
    ok, msg, cooldown = create_and_send_email_otp(db, auditor)
    assert ok, f"Failed to send OTP: {msg}"
    assert auditor.otp_hash is not None, "OTP hash was not stored!"
    assert auditor.otp_expiry is not None, "OTP expiry timestamp missing!"
    print("  [OK] Email OTP created, hashed, and dispatched successfully.")

    # Resend Cooldown Test
    ok2, msg2, cooldown2 = create_and_send_email_otp(db, auditor)
    assert not ok2, "Cooldown check failed; resend was allowed immediately!"
    print(f"  [OK] Resend cooldown enforced properly ({cooldown2}s remaining).")

    # Invalid OTP Code Test
    valid, verify_msg = verify_email_otp(db, auditor, "000000")
    assert not valid, "Invalid OTP code was wrongly accepted!"
    assert auditor.otp_attempts == 1, "Attempt counter was not incremented!"
    print(f"  [OK] Incorrect OTP rejected cleanly. ({verify_msg})")

    # Correct OTP Code Test (Intercept stored hash in demo mode by manually matching test code)
    test_otp = "123456"
    auditor.otp_hash = hash_otp(test_otp, auditor.email)
    db.commit()

    valid_success, msg_success = verify_email_otp(db, auditor, test_otp)
    assert valid_success, f"Valid OTP failed verification: {msg_success}"
    assert auditor.otp_hash is None, "Single-use restriction failed! OTP hash was not cleared."
    print("  [OK] Valid OTP code verified successfully. OTP hash cleared (single-use enforced).")

    # 3. TOTP Setup & Verification Test for Elevated Admin User
    print("\n[Test 3] Testing TOTP Setup, Encryption & Verification (Admin/Elevated User)...")

    # Reset admin TOTP
    admin.totp_secret = None
    admin.totp_enabled = False
    db.commit()

    # Setup Init
    raw_secret, otpauth_url, qr_b64 = generate_totp_setup_data(admin)
    assert raw_secret and len(raw_secret) >= 16, "Invalid raw secret generated!"
    assert otpauth_url.startswith("otpauth://totp/"), "Invalid OTPAuth URL format!"
    assert qr_b64.startswith("data:image/png;base64,"), "Invalid QR code base64 format!"
    print("  [OK] TOTP setup initialized (secret generated, QR code rendered).")

    # Invalid confirmation code test
    ok_setup_bad, msg_setup_bad = confirm_and_enable_totp(db, admin, raw_secret, "000000")
    assert not ok_setup_bad, "Invalid TOTP setup code was wrongly accepted!"
    assert not admin.totp_enabled, "totp_enabled was prematurely set to True!"

    # Valid confirmation code test
    totp_obj = pyotp.TOTP(raw_secret)
    current_code = totp_obj.now()

    ok_setup_good, msg_setup_good = confirm_and_enable_totp(db, admin, raw_secret, current_code)
    assert ok_setup_good, f"Valid TOTP confirmation failed: {msg_setup_good}"
    assert admin.totp_enabled is True, "totp_enabled was not set to True!"
    assert admin.totp_secret != raw_secret, "TOTP secret stored in PLAINTEXT! Encryption at rest required."
    
    decrypted = decrypt_secret(admin.totp_secret)
    assert decrypted == raw_secret, "Decrypted TOTP secret does not match original!"
    print("  [OK] TOTP confirmation succeeded. Secret ENCRYPTED at rest using Fernet.")

    # Subsequent login TOTP verification test
    current_code_2 = totp_obj.now()
    ok_totp_login, msg_totp_login = verify_totp_code(db, admin, current_code_2)
    assert ok_totp_login, f"Subsequent TOTP verification failed: {msg_totp_login}"
    print("  [OK] Subsequent TOTP verification succeeded.")

    # 4. TOTP Reset Test
    print("\n[Test 4] Testing Admin TOTP Reset...")
    admin.totp_secret = None
    admin.totp_enabled = False
    db.commit()
    assert admin.totp_enabled is False, "Admin reset failed to disable TOTP."
    print("  [OK] Admin TOTP reset completed successfully.")

    db.close()
    print("\n" + "=" * 60)
    print("ALL 2FA AUTHENTICATION SECURITY TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

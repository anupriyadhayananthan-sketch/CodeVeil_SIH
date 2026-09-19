import os
import io
import time
import base64
import secrets
import hashlib
import datetime
from typing import Optional, Tuple
import pyotp
import qrcode
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.models import User, AuditLog
from app.auth import SECRET_KEY, create_audit_log

# Derive a 32-byte URL-safe base64-encoded key for Fernet encryption from SECRET_KEY
def _get_fernet_key() -> bytes:
    key_hash = hashlib.sha256(SECRET_KEY.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(key_hash)

_fernet = Fernet(_get_fernet_key())

def encrypt_secret(plain_secret: str) -> str:
    """Encrypt a secret string at rest using Fernet symmetric encryption."""
    if not plain_secret:
        return ""
    return _fernet.encrypt(plain_secret.encode('utf-8')).decode('utf-8')

def decrypt_secret(cipher_secret: str) -> str:
    """Decrypt a cipher string stored at rest."""
    if not cipher_secret:
        return ""
    return _fernet.decrypt(cipher_secret.encode('utf-8')).decode('utf-8')


# Email OTP Helpers
OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 45

def hash_otp(otp: str, email: str) -> str:
    """Compute a secure SHA-256 hash of the OTP combined with email and SECRET_KEY salt."""
    salt = f"{SECRET_KEY}:{email.lower()}"
    return hashlib.sha256(f"{salt}:{otp}".encode('utf-8')).hexdigest()

def generate_numeric_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))

REAL_TEST_RECIPIENT = "sanabhuvi2529@gmail.com"

def _load_env_file():
    """Load .env file from project root or parent directories into os.environ."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    while current_dir:
        env_path = os.path.join(current_dir, ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip("'").strip('"')
                            if key:
                                os.environ[key] = val
                return
            except Exception as e:
                print(f"[Env Load Warning] Could not load .env file from {env_path}: {e}")
        parent_dir = os.path.dirname(current_dir)
        if parent_dir == current_dir:
            break
        current_dir = parent_dir

def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Delivers email via Gmail SMTP for real test recipient (sanabhuvi2529@gmail.com)
    or logs mock dispatch for all other addresses without making network calls.
    """
    _load_env_file()

    clean_target = (to_email or "").strip().lower()
    clean_real = REAL_TEST_RECIPIENT.strip().lower()

    if clean_target == clean_real:
        # Real Email Dispatch via Gmail SMTP
        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", clean_real)
        smtp_pass = os.environ.get("SMTP_APP_PASSWORD") or os.environ.get("SMTP_PASS")
        sender_email = os.environ.get("SMTP_FROM", smtp_user)

        if not smtp_pass:
            print(f"[REAL EMAIL ERROR] Cannot send real email to {to_email}: SMTP_APP_PASSWORD is not configured.")
            return False

        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        try:
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = to_email
            msg['Subject'] = subject

            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(sender_email, [to_email], msg.as_string())
            server.quit()

            print(f"\n==================================================")
            print(f"[REAL EMAIL DISPATCH SUCCESS] Real email sent via Gmail SMTP")
            print(f"Recipient : {to_email}")
            print(f"Subject   : {subject}")
            print(f"==================================================\n")
            return True
        except Exception as e:
            print(f"\n==================================================")
            print(f"[REAL EMAIL DISPATCH FAILED] Gmail SMTP error for recipient {to_email}: {e}")
            print(f"==================================================\n")
            return False
    else:
        # Recipient-based Mock Logging (simulate success for synthetic bidder addresses)
        print(f"\n==================================================")
        print(f"[MOCK EMAIL] Would have sent to: {to_email}, subject: {subject}")
        print(f"==================================================\n")
        return True

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Send OTP via email. Backward compatible wrapper delegating to send_email.
    """
    if "SUBJECT:" in otp_code:
        lines = otp_code.split("\n")
        subj_line = [l for l in lines if l.startswith("SUBJECT:")]
        subject = subj_line[0].replace("SUBJECT:", "").strip() if subj_line else "CodeVeil Platform Notice"
        body = otp_code
    else:
        subject = "CodeVeil Platform - Your Login Verification Code (OTP)"
        body = f"""Dear User,

Your 6-digit login verification code for CodeVeil Platform is:

    {otp_code}

This code is valid for 10 minutes. Do not share this code with anyone.

If you did not request this code, please contact system administration immediately.

Regards,
CodeVeil Platform Team
CPCL GeM Bid Compliance & Risk Intelligence Platform
"""
    return send_email(to_email, subject, body)

def create_and_send_email_otp(db: Session, user: User) -> Tuple[bool, str, int]:
    """
    Generates a fresh OTP for a user, updates database hash/expiry, and dispatches email.
    Enforces 45s resend cooldown.
    """
    now = datetime.datetime.utcnow()

    if user.otp_last_sent:
        elapsed = (now - user.otp_last_sent).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            cooldown_left = int(RESEND_COOLDOWN_SECONDS - elapsed)
            return False, f"Please wait {cooldown_left} seconds before requesting a new OTP.", cooldown_left

    otp_code = generate_numeric_otp(6)
    user.otp_hash = hash_otp(otp_code, user.email)
    user.otp_expiry = now + datetime.timedelta(minutes=OTP_EXPIRY_MINUTES)
    user.otp_attempts = 0
    user.otp_last_sent = now
    db.commit()

    send_otp_email(user.email, otp_code)
    return True, "Verification code sent to your email.", 0

def verify_email_otp(db: Session, user: User, otp_input: str) -> Tuple[bool, str]:
    """
    Verifies entered OTP against hashed value, checking expiry, attempt limits, and single-use invalidation.
    """
    now = datetime.datetime.utcnow()

    if not user.otp_hash or not user.otp_expiry:
        return False, "No active OTP found. Please request a new verification code."

    if now > user.otp_expiry:
        user.otp_hash = None
        user.otp_expiry = None
        db.commit()
        return False, "OTP has expired. Please request a fresh verification code."

    if user.otp_attempts >= MAX_OTP_ATTEMPTS:
        user.otp_hash = None
        user.otp_expiry = None
        db.commit()
        return False, "Maximum verification attempts exceeded. Please request a new OTP."

    computed_hash = hash_otp(otp_input.strip(), user.email)
    if not secrets.compare_digest(user.otp_hash, computed_hash):
        user.otp_attempts += 1
        db.commit()
        remaining = MAX_OTP_ATTEMPTS - user.otp_attempts
        return False, f"Invalid OTP code. {remaining} attempt(s) remaining."

    # Single-use: invalidate OTP upon successful verification
    user.otp_hash = None
    user.otp_expiry = None
    user.otp_attempts = 0
    db.commit()

    return True, "OTP verified successfully."


# TOTP Helpers (Google Authenticator / PyOTP)

def generate_totp_setup_data(user: User) -> Tuple[str, str, str]:
    """
    Generates an unconfirmed TOTP secret, URI, and base64 QR code image for first-time setup.
    Returns (raw_secret, otpauth_url, qr_code_base64_data_url).
    """
    raw_secret = pyotp.random_base32()
    issuer_name = "CodeVeil CPCL"
    totp = pyotp.TOTP(raw_secret)
    otpauth_url = totp.provisioning_uri(name=user.email, issuer_name=issuer_name)

    # Generate QR Code image as PNG buffer
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=6,
        border=3,
    )
    qr.add_data(otpauth_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer)
    qr_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    qr_data_url = f"data:image/png;base64,{qr_b64}"

    return raw_secret, otpauth_url, qr_data_url

def confirm_and_enable_totp(db: Session, user: User, raw_secret: str, code_input: str) -> Tuple[bool, str]:
    """
    Confirms first-time TOTP setup by verifying entered 6-digit authenticator code against the raw secret.
    If valid, encrypts secret at rest, sets totp_enabled=True.
    """
    totp = pyotp.TOTP(raw_secret)
    if not totp.verify(code_input.strip(), valid_window=1):
        return False, "Invalid authenticator code. Please check your authenticator app and try again."

    user.totp_secret = encrypt_secret(raw_secret)
    user.totp_enabled = True
    db.commit()

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type="TOTP_SETUP_COMPLETE",
        entity_type="User",
        entity_id=str(user.id),
        details_json="Two-factor authentication (TOTP) successfully configured and enabled"
    )

    return True, "Two-factor authentication successfully enabled."

def verify_totp_code(db: Session, user: User, code_input: str) -> Tuple[bool, str]:
    """
    Verifies entered 6-digit TOTP code against decrypted secret stored at rest.
    Allows ±1 window (30s drift).
    """
    if not user.totp_enabled or not user.totp_secret:
        return False, "Two-factor authentication is not enabled for this account."

    try:
        plain_secret = decrypt_secret(user.totp_secret)
    except Exception:
        return False, "Failed to decrypt 2FA secret credentials."

    totp = pyotp.TOTP(plain_secret)
    if not totp.verify(code_input.strip(), valid_window=1):
        return False, "Invalid authenticator code. Please check your app and try again."

    return True, "Authenticator code verified successfully."

def is_elevated_role(role: str) -> bool:
    """Returns True if the role is flagged as elevated (Admin or Procurement Officer)."""
    return role in ["Admin", "Procurement Officer"]

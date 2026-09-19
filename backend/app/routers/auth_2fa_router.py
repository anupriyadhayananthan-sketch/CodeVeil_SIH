import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.database import get_db
from app.models import User
from app.auth import (
    SECRET_KEY, ALGORITHM, create_access_token, get_current_user,
    require_admin, create_audit_log
)
from app.services.auth_2fa_service import (
    create_and_send_email_otp, verify_email_otp,
    generate_totp_setup_data, confirm_and_enable_totp,
    verify_totp_code, is_elevated_role
)

router = APIRouter(prefix="/api/auth/2fa", tags=["Auth 2FA"])

# Request / Response Pydantic Models for 2FA
class SendOtpRequest(BaseModel):
    pre_auth_token: str

class VerifyOtpRequest(BaseModel):
    pre_auth_token: str
    otp_code: str

class TotpSetupInitRequest(BaseModel):
    pre_auth_token: str

class TotpSetupConfirmRequest(BaseModel):
    pre_auth_token: str
    raw_secret: str
    totp_code: str

class VerifyTotpRequest(BaseModel):
    pre_auth_token: str
    totp_code: str

class ResetTotpRequest(BaseModel):
    target_user_id: Optional[int] = None
    target_email: Optional[EmailStr] = None


def decode_pre_auth_token(db: Session, token: str) -> User:
    """Validate temporary pre-authentication JWT token and retrieve associated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired pre-authentication token. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "pre_auth":
            raise credentials_exception
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise credentials_exception
    return user


@router.post("/send-otp")
def send_otp(data: SendOtpRequest, db: Session = Depends(get_db)):
    """Resend Email OTP to normal users with 45s cooldown enforcement."""
    user = decode_pre_auth_token(db, data.pre_auth_token)
    if is_elevated_role(user.role):
        raise HTTPException(status_code=400, detail="Elevated accounts require TOTP authenticator app verification.")

    success, msg, cooldown_left = create_and_send_email_otp(db, user)
    if not success:
        raise HTTPException(status_code=429, detail=msg)
    return {"message": msg, "cooldown_seconds": cooldown_left}


@router.post("/verify-otp")
def verify_otp(data: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Verify Email OTP for normal user and issue full access token upon success."""
    user = decode_pre_auth_token(db, data.pre_auth_token)

    ok, msg = verify_email_otp(db, user, data.otp_code)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    user.last_login = datetime.datetime.utcnow()
    db.commit()

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type="USER_LOGIN_2FA_SUCCESS",
        entity_type="User",
        entity_id=str(user.id),
        details_json="Successful post-login Email OTP 2FA verification"
    )

    return {"access_token": access_token, "token_type": "bearer", "message": "Email OTP verification successful."}


@router.post("/totp-setup-init")
def totp_setup_init(data: TotpSetupInitRequest, db: Session = Depends(get_db)):
    """Generates a raw secret, provisioning URI, and QR code base64 image for first-time elevated TOTP setup."""
    user = decode_pre_auth_token(db, data.pre_auth_token)
    if not is_elevated_role(user.role):
        raise HTTPException(status_code=400, detail="TOTP setup is reserved for elevated roles.")
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled on this account. Proceed to verification.")

    raw_secret, otpauth_url, qr_code_data_url = generate_totp_setup_data(user)
    return {
        "raw_secret": raw_secret,
        "otpauth_url": otpauth_url,
        "qr_code_url": qr_code_data_url,
        "user_email": user.email
    }


@router.post("/totp-setup-confirm")
def totp_setup_confirm(data: TotpSetupConfirmRequest, db: Session = Depends(get_db)):
    """Confirm first-time TOTP code, encrypt secret at rest, set totp_enabled=True, and issue access token."""
    user = decode_pre_auth_token(db, data.pre_auth_token)
    if not is_elevated_role(user.role):
        raise HTTPException(status_code=400, detail="TOTP setup is reserved for elevated roles.")

    ok, msg = confirm_and_enable_totp(db, user, data.raw_secret, data.totp_code)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    user.last_login = datetime.datetime.utcnow()
    db.commit()

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type="USER_LOGIN_2FA_SUCCESS",
        entity_type="User",
        entity_id=str(user.id),
        details_json="Successful first-time TOTP setup and post-login verification"
    )

    return {"access_token": access_token, "token_type": "bearer", "message": msg}


@router.post("/verify-totp")
def verify_totp(data: VerifyTotpRequest, db: Session = Depends(get_db)):
    """Verify 6-digit TOTP code for returning elevated users and issue full access token."""
    user = decode_pre_auth_token(db, data.pre_auth_token)
    if not is_elevated_role(user.role):
        raise HTTPException(status_code=400, detail="TOTP verification is reserved for elevated roles.")

    ok, msg = verify_totp_code(db, user, data.totp_code)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    user.last_login = datetime.datetime.utcnow()
    db.commit()

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type="USER_LOGIN_2FA_SUCCESS",
        entity_type="User",
        entity_id=str(user.id),
        details_json="Successful post-login TOTP 2FA verification"
    )

    return {"access_token": access_token, "token_type": "bearer", "message": "TOTP verification successful."}


@router.post("/reset-totp")
def reset_totp(
    data: ResetTotpRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only endpoint to reset a user's 2FA setup if they lose their device.
    Requires Admin authorization header.
    """
    if not data.target_user_id and not data.target_email:
        raise HTTPException(status_code=400, detail="Must specify target_user_id or target_email to reset 2FA.")

    query = db.query(User)
    if data.target_user_id:
        target_user = query.filter(User.id == data.target_user_id).first()
    else:
        target_user = query.filter(User.email == data.target_email).first()

    if not target_user:
        raise HTTPException(status_code=4404, detail="Target user account not found.")

    target_user.totp_secret = None
    target_user.totp_enabled = False
    target_user.otp_hash = None
    target_user.otp_expiry = None
    target_user.otp_attempts = 0
    db.commit()

    create_audit_log(
        db,
        actor_id=current_admin.id,
        actor_email=current_admin.email,
        action_type="ADMIN_RESET_2FA",
        entity_type="User",
        entity_id=str(target_user.id),
        details_json=f"Admin '{current_admin.email}' reset 2FA for user '{target_user.email}'"
    )

    return {"message": f"Successfully reset 2FA for user '{target_user.email}'. User will re-configure 2FA on next sign-in."}

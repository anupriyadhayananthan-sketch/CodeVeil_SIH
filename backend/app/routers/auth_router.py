import os
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    Token, UserCreate, UserOut, PasswordChange, ForgotPasswordRequest,
    CaptchaConfigResponse, CaptchaChallengeResponse, CaptchaStatusResponse
)
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user, create_audit_log, blacklist_token, oauth2_scheme
from app.captcha import (
    get_captcha_provider, login_tracker, local_captcha_store, verify_captcha_token
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.get("/captcha-config", response_model=CaptchaConfigResponse)
def get_captcha_config():
    provider = get_captcha_provider()
    site_key = os.environ.get("RECAPTCHA_SITE_KEY", "") if provider == "recaptcha" else None
    return {
        "provider": provider,
        "site_key": site_key,
        "disabled": provider == "disabled"
    }

@router.get("/captcha-challenge", response_model=CaptchaChallengeResponse)
def get_captcha_challenge():
    captcha_id, prompt, svg = local_captcha_store.create_challenge()
    return {
        "captcha_id": captcha_id,
        "prompt": prompt,
        "svg": svg
    }

@router.get("/captcha-status", response_model=CaptchaStatusResponse)
def get_captcha_status(request: Request, email: Optional[str] = None):
    client_ip = request.client.host if request.client else "127.0.0.1"
    provider = get_captcha_provider()
    failed_attempts = login_tracker.get_failure_count(client_ip, email or "")
    required = login_tracker.is_captcha_required(client_ip, email or "")
    return {
        "captcha_required": required,
        "provider": provider,
        "failed_attempts": failed_attempts
    }

@router.post("/signup", response_model=UserOut)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    provider = get_captcha_provider()
    if provider != "disabled":
        if not verify_captcha_token(user_in.captcha_token, user_in.captcha_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification failed, please try again"
            )

    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    # Restrict initial self-signup role to lowest privilege unless first user
    user_count = db.query(User).count()
    assigned_role = user_in.role if user_count == 0 else "Viewer/Auditor"

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=assigned_role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    create_audit_log(
        db,
        actor_id=new_user.id,
        actor_email=new_user.email,
        action_type="USER_SIGNUP",
        entity_type="User",
        entity_id=str(new_user.id),
        details_json=f"User signed up with role {assigned_role}"
    )
    return new_user

@router.post("/token", response_model=Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    name: Optional[str] = Form(None),
    captcha_token: Optional[str] = Form(None),
    captcha_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    email = form_data.username
    provider = get_captcha_provider()

    captcha_required = login_tracker.is_captcha_required(client_ip, email)

    if provider != "disabled" and (captcha_required or captcha_token or captcha_id):
        if not verify_captcha_token(captcha_token, captcha_id):
            login_tracker.record_failure(client_ip, email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification failed, please try again"
            )

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        login_tracker.record_failure(client_ip, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated.")

    if name and name.strip():
        user.full_name = name.strip()

    # Reset failure counter on successful password auth
    login_tracker.reset_failures(client_ip, email)

    # Issue short-lived pre-auth token for 2FA verification step
    pre_auth_expires = datetime.timedelta(minutes=10)
    pre_auth_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "type": "pre_auth"},
        expires_delta=pre_auth_expires
    )

    from app.services.auth_2fa_service import is_elevated_role, create_and_send_email_otp

    if is_elevated_role(user.role):
        fa_type = "TOTP_VERIFY" if user.totp_enabled else "TOTP_SETUP"
        cooldown = 0
    else:
        fa_type = "OTP"
        # Auto-send email OTP for normal users
        _, _, cooldown = create_and_send_email_otp(db, user)

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type="USER_PASSWORD_AUTH_SUCCESS",
        entity_type="User",
        entity_id=str(user.id),
        details_json=f"Password validated successfully. Proceeding to 2FA stage ({fa_type})"
    )

    return {
        "access_token": None,
        "token_type": "bearer",
        "requires_2fa": True,
        "fa_type": fa_type,
        "pre_auth_token": pre_auth_token,
        "email": user.email,
        "cooldown_seconds": cooldown
    }

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    blacklist_token(db, token)
    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="USER_LOGOUT",
        entity_type="User",
        entity_id=str(current_user.id),
        details_json="User logged out and auth token blacklisted"
    )
    return {"message": "Logged out successfully. Token invalidated."}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(data: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="PASSWORD_CHANGE",
        entity_type="User",
        entity_id=str(current_user.id),
        details_json="Password changed successfully"
    )
    return {"message": "Password updated successfully."}

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    provider = get_captcha_provider()
    if provider != "disabled":
        if not verify_captcha_token(data.captcha_token, data.captcha_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification failed, please try again"
            )

    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        return {"message": "If the email is registered, a password reset token has been generated."}

    reset_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "type": "reset"},
        expires_delta=datetime.timedelta(minutes=15)
    )
    return {
        "message": "Password reset token generated successfully (demonstration mode).",
        "demo_reset_token": reset_token
    }

# ---------------------------------------------------------------------------
# DEMO / PRESENTATION ONLY — Do NOT ship this endpoint to production.
# Issues a full access token for the seeded demo user, bypassing 2FA entirely,
# so the frontend can silently establish a valid session on first load without
# showing a login form. Remove or gate behind an env-var before going live.
# ---------------------------------------------------------------------------
@router.post("/demo-session", response_model=Token)
def create_demo_session(db: Session = Depends(get_db)):
    """
    Issues a full JWT access token for the demo Procurement Officer account
    without requiring 2FA. Used exclusively for the auto-login flow in the
    demo/presentation frontend build. NOT suitable for production use.
    """
    DEMO_EMAIL = "officer@cpcl.gov.in"

    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo user account not found. Please re-seed the database."
        )

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type="DEMO_AUTO_LOGIN",
        entity_type="User",
        entity_id=str(user.id),
        details_json="Silent auto-login via /api/auth/demo-session (demo mode only)"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
        "fa_type": None,
        "pre_auth_token": None,
        "email": user.email,
        "cooldown_seconds": 0
    }

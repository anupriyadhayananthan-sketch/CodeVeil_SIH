import os
import datetime
import hashlib
import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, AuditLog, TokenBlacklist
from app.schemas import TokenData

SECRET_KEY = os.environ.get("CODEVEIL_SECRET_KEY", "codeveil-super-secret-sih2026-production-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # 30 minutes short-lived token

import bcrypt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    # Ensure password bytes <= 72 for bcrypt
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    if "jti" not in to_encode:
        to_encode["jti"] = str(uuid.uuid4())
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def blacklist_token(db: Session, token: str) -> bool:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        user_id = payload.get("user_id")
        exp_ts = payload.get("exp")
        if not jti or not user_id:
            return False
        
        expires_at = datetime.datetime.utcfromtimestamp(exp_ts) if exp_ts else datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        
        existing = db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first()
        if not existing:
            blacklisted = TokenBlacklist(
                jti=jti,
                user_id=user_id,
                expires_at=expires_at
            )
            db.add(blacklisted)
            db.commit()
        return True
    except Exception:
        return False

def is_token_blacklisted(db: Session, jti: str) -> bool:
    if not jti:
        return False
    entry = db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first()
    return entry is not None

def create_temporary_document_token(user_id: int, document_id: str, expires_minutes: int = 5) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=expires_minutes)
    payload = {
        "sub": "temp_doc_access",
        "type": "temp_doc_access",
        "user_id": user_id,
        "document_id": str(document_id),
        "jti": str(uuid.uuid4()),
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_temporary_document_token(token: str, db: Session) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired temporary document access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "temp_doc_access":
            raise credentials_exception
        jti = payload.get("jti")
        if is_token_blacklisted(db, jti):
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception

def create_audit_log(db: Session, actor_id: Optional[int], actor_email: Optional[str], action_type: str, entity_type: Optional[str] = None, entity_id: Optional[str] = None, details_json: Optional[str] = None):
    # Fetch last audit log to compute tamper-evident hash chain
    last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev_hash = last_log.current_hash if last_log else "0" * 64
    
    timestamp = datetime.datetime.utcnow()
    raw_payload = f"{prev_hash}|{timestamp.isoformat()}|{actor_id}|{action_type}|{entity_type}|{entity_id}|{details_json}"
    current_hash = hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()

    log_entry = AuditLog(
        timestamp=timestamp,
        actor_id=actor_id,
        actor_email=actor_email,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        details_json=details_json,
        prev_hash=prev_hash,
        current_hash=current_hash
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        role: str = payload.get("role")
        jti: str = payload.get("jti")
        if email is None or user_id is None:
            raise credentials_exception
        if jti and is_token_blacklisted(db, jti):
            raise credentials_exception
        token_data = TokenData(email=email, user_id=user_id, role=role)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin privilege required."
        )
    return current_user

def require_officer_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["Admin", "Procurement Officer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Procurement Officer or Admin privilege required."
        )
    return current_user


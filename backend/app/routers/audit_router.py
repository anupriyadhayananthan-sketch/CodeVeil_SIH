import hashlib
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, DocumentAccessLog, User
from app.schemas import AuditLogOut, DocumentAccessLogOut
from app.auth import get_current_user

router = APIRouter(prefix="/api/audit", tags=["Audit"])

@router.get("/logs", response_model=List[AuditLogOut])
def get_audit_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).all()

@router.get("/document-access-logs", response_model=List[DocumentAccessLogOut])
def get_document_access_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(DocumentAccessLog).order_by(DocumentAccessLog.id.desc()).all()

@router.get("/verify-hash-chain")
def verify_hash_chain(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Validates tamper-evident hash-chain integrity of all audit log records.
    """
    logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    if not logs:
        return {"tamper_evident_valid": True, "total_logs": 0, "message": "No audit records to verify."}

    prev_hash = "0" * 64
    tampered_ids = []

    for log in logs:
        if log.prev_hash != prev_hash:
            tampered_ids.append(log.id)

        raw_payload = f"{prev_hash}|{log.timestamp.isoformat()}|{log.actor_id}|{log.action_type}|{log.entity_type}|{log.entity_id}|{log.details_json}"
        expected_hash = hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()

        if expected_hash != log.current_hash:
            tampered_ids.append(log.id)

        prev_hash = log.current_hash

    is_valid = len(tampered_ids) == 0
    return {
        "tamper_evident_valid": is_valid,
        "total_logs": len(logs),
        "tampered_log_ids": tampered_ids,
        "message": "Audit trail hash-chain verification PASSED. Log integrity confirmed." if is_valid else "ALERT: Audit log tampering detected!"
    }

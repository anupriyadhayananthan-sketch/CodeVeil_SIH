import os
from typing import Tuple, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, Bidder, Tender, DocumentAccessLog, User
from app.schemas import DocumentOut, TempDocumentTokenResponse
from app.auth import (
    get_current_user, create_audit_log,
    create_temporary_document_token, verify_temporary_document_token
)

router = APIRouter(prefix="/api/documents", tags=["Documents"])

def find_document(document_id: str, db: Session) -> Document:
    doc = None
    if str(document_id).isdigit():
        doc = db.query(Document).filter(Document.id == int(document_id)).first()
    if not doc:
        doc = db.query(Document).filter(Document.doc_uuid == str(document_id)).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return doc

def validate_document_access(doc: Document, user: User, action_type: str, db: Session) -> Tuple[Bidder, Optional[Tender]]:
    bidder = db.query(Bidder).filter(Bidder.id == doc.bidder_id).first()
    tender = db.query(Tender).filter(Tender.id == bidder.tender_id).first() if bidder else None

    is_allowed = True
    denial_reason = ""

    if not user or not user.is_active:
        is_allowed = False
        denial_reason = "Unauthenticated or inactive user account."
    elif user.role == "Admin":
        is_allowed = True
    elif user.role == "Procurement Officer":
        # Check officer tender scope assignment
        if tender:
            assigned_ids = [tid for tid in [tender.created_by_id, tender.assigned_officer_id] if tid is not None]
            if assigned_ids and user.id not in assigned_ids:
                is_allowed = False
                denial_reason = f"Officer '{user.email}' is not assigned to Tender #{tender.id} ({tender.tender_number})."
    elif user.role == "Viewer/Auditor":
        if action_type == "DOWNLOAD":
            is_allowed = False
            denial_reason = "Viewer/Auditor role is not authorized to download raw binary PDF files. Access restricted to inline metadata viewing."
        else:
            is_allowed = True
    else:
        is_allowed = False
        denial_reason = f"Role '{user.role}' is not authorized to access documents."

    if not is_allowed:
        # Audit log access denial attempt
        access_log = DocumentAccessLog(
            user_id=user.id if user else 0,
            user_email=user.email if user else "anonymous",
            tender_id=tender.id if tender else None,
            bidder_id=doc.bidder_id,
            document_id=doc.id,
            document_name=doc.filename,
            action_type=action_type,
            status="DENIED",
            denial_reason=denial_reason
        )
        db.add(access_log)
        db.commit()

        create_audit_log(
            db,
            actor_id=user.id if user else None,
            actor_email=user.email if user else "anonymous",
            action_type="DOCUMENT_ACCESS_DENIED",
            entity_type="Document",
            entity_id=str(doc.id),
            details_json=f"Denied {action_type} access to document '{doc.filename}' for user '{user.email if user else 'anonymous'}'. Reason: {denial_reason}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {denial_reason}"
        )

    # Log successful access event
    access_log = DocumentAccessLog(
        user_id=user.id,
        user_email=user.email,
        tender_id=tender.id if tender else None,
        bidder_id=doc.bidder_id,
        document_id=doc.id,
        document_name=doc.filename,
        action_type=action_type,
        status="ALLOWED",
        denial_reason=None
    )
    db.add(access_log)
    db.commit()

    create_audit_log(
        db,
        actor_id=user.id,
        actor_email=user.email,
        action_type=f"DOCUMENT_{action_type}",
        entity_type="Document",
        entity_id=str(doc.id),
        details_json=f"User '{user.email}' ({user.role}) successfully executed {action_type} on document '{doc.filename}' for bidder '{bidder.legal_name if bidder else doc.bidder_id}'"
    )

    return bidder, tender

@router.get("/{document_id}/meta", response_model=DocumentOut)
def get_document_meta(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = find_document(document_id, db)
    validate_document_access(doc, current_user, "VIEW", db)
    return doc

@router.get("/{document_id}/signed-url", response_model=TempDocumentTokenResponse)
def generate_signed_document_url(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generates a short-lived (5 minute) signed token for evidence viewer / temporary viewing.
    """
    doc = find_document(document_id, db)
    validate_document_access(doc, current_user, "VIEW", db)
    temp_token = create_temporary_document_token(current_user.id, document_id=str(doc.id), expires_minutes=5)
    return {
        "document_id": str(doc.id),
        "temp_token": temp_token,
        "expires_in_seconds": 300
    }

@router.get("/signed-view")
def view_document_with_signed_token(token: str = Query(...), db: Session = Depends(get_db)):
    """
    Views document content using a short-lived signed temporary token.
    """
    payload = verify_temporary_document_token(token, db)
    user_id = payload.get("user_id")
    document_id = payload.get("document_id")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account deactivated or invalid.")

    doc = find_document(document_id, db)
    bidder, tender = validate_document_access(doc, user, "VIEW", db)

    if os.path.exists(doc.file_path):
        return FileResponse(
            path=doc.file_path,
            filename=doc.filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=\"{doc.filename}\""}
        )
    else:
        content = f"""================================================================================
SYNTHETIC DEMONSTRATION DOCUMENT (SIGNED TEMPORARY TOKEN ACCESS)
Document Type: {doc.document_type}
Filename: {doc.filename}
Bidder Legal Name: {bidder.legal_name if bidder else 'N/A'}
Flaw Status: {doc.flaw_injected}
================================================================================
{doc.extracted_text or 'Synthetic document text payload.'}
"""
        return PlainTextResponse(content=content)

@router.get("/{document_id}/content")
def view_document_content(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    IDOR-Protected document content viewer (inline display).
    """
    doc = find_document(document_id, db)
    bidder, tender = validate_document_access(doc, current_user, "VIEW", db)

    if os.path.exists(doc.file_path):
        return FileResponse(
            path=doc.file_path,
            filename=doc.filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=\"{doc.filename}\""}
        )
    else:
        content = f"""================================================================================
SYNTHETIC DEMONSTRATION DOCUMENT - NOT A GOVERNMENT CERTIFICATE
Document Type: {doc.document_type}
Filename: {doc.filename}
Bidder Legal Name: {bidder.legal_name if bidder else 'N/A'}
Flaw Status: {doc.flaw_injected}
================================================================================
{doc.extracted_text or 'Synthetic document text payload.'}
"""
        return PlainTextResponse(content=content)

@router.get("/{document_id}/download")
def download_document_file(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    IDOR-Protected document binary PDF file downloader (attachment download).
    Restricted to Admin and authorized Procurement Officer roles.
    """
    doc = find_document(document_id, db)
    bidder, tender = validate_document_access(doc, current_user, "DOWNLOAD", db)

    if os.path.exists(doc.file_path):
        return FileResponse(
            path=doc.file_path,
            filename=doc.filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{doc.filename}\""}
        )
    else:
        content = f"Synthetic demonstration file payload for {doc.filename} ({doc.document_type})."
        return PlainTextResponse(content=content, headers={"Content-Disposition": f"attachment; filename=\"{doc.filename}.txt\""})


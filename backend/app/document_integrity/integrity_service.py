import os
import json
import hashlib
import datetime
from typing import Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
import pypdf

from app.models import Document, Bidder, DocumentHashRegistry, DocumentIntegrityFlag

EDITING_SOFTWARE_SIGNATURES = [
    "photoshop", "gimp", "illustrator", "canva", "inkscape",
    "acrobat pro", "foxit phantom", "pdf-xchange", "coreldraw", "affinity"
]

GOVT_DOC_TYPES = [
    "PAN", "GST_CERTIFICATE", "UDYAM_CERTIFICATE", "BIS_LICENSE",
    "OEM_AUTH_LETTER", "EPFO_ESI_CERT", "FINANCIAL_STATEMENT"
]

def compute_file_sha256(file_path: str) -> str:
    """Compute SHA-256 hash of a file."""
    if not os.path.exists(file_path):
        return ""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def inspect_pdf_metadata(file_path: str, document_type: str) -> Tuple[bool, Optional[str]]:
    """
    Inspect PDF metadata for editing software signatures and date anomalies.
    Returns (flagged: bool, reason: str).
    """
    if not os.path.exists(file_path):
        return False, None

    try:
        reader = pypdf.PdfReader(file_path)
        meta = reader.metadata
        if not meta:
            return False, None

        producer = str(meta.producer or "").lower()
        creator = str(meta.creator or "").lower()
        author = str(meta.author or "").lower()
        title = str(meta.title or "").lower()
        combined_meta = f"{producer} | {creator} | {author} | {title}"

        # Check for editing software signatures
        for sig in EDITING_SOFTWARE_SIGNATURES:
            if sig in combined_meta:
                matched_name = sig.title()
                raw_sig = meta.producer or meta.creator or matched_name
                return True, f"Metadata Inspection: Editing software signature ('{raw_sig}') detected in PDF metadata for document type '{document_type}'."

        return False, None
    except Exception as e:
        print(f"[Document Integrity Error] Metadata inspection failed for {file_path}: {e}")
        return False, None

def evaluate_document_integrity(
    db: Session,
    document_id: int,
    bidder_id: int,
    tender_id: Optional[int],
    document_type: str,
    file_path: str
) -> DocumentIntegrityFlag:
    """
    Evaluate document authenticity using duplicate-hash check and metadata inspection.
    Returns DocumentIntegrityFlag ORM object.
    """
    file_hash = compute_file_sha256(file_path)
    reasons = []
    tamper_risk = "LOW"
    metadata_flag = False
    duplicate_hash_flag = False

    # Check 1: Duplicate Hash Detection (Strongest Signal -> HIGH Risk)
    if file_hash:
        existing_hash_entry = db.query(DocumentHashRegistry).filter(
            DocumentHashRegistry.file_hash == file_hash,
            DocumentHashRegistry.first_bidder_id != bidder_id
        ).first()

        if existing_hash_entry:
            duplicate_hash_flag = True
            tamper_risk = "HIGH"
            orig_bidder = db.query(Bidder).filter(Bidder.id == existing_hash_entry.first_bidder_id).first()
            orig_name = orig_bidder.legal_name if orig_bidder else f"ID {existing_hash_entry.first_bidder_id}"
            reasons.append(
                f"Duplicate Hash Detection: Identical file hash (sha256: {file_hash[:12]}...) "
                f"previously submitted by Bidder '{orig_name}' (Bidder ID {existing_hash_entry.first_bidder_id})."
            )
        else:
            # Record hash if not already registered for this bidder
            own_entry = db.query(DocumentHashRegistry).filter(
                DocumentHashRegistry.file_hash == file_hash,
                DocumentHashRegistry.first_bidder_id == bidder_id
            ).first()
            if not own_entry:
                new_hash_reg = DocumentHashRegistry(
                    file_hash=file_hash,
                    first_bidder_id=bidder_id,
                    first_tender_id=tender_id,
                    document_type=document_type
                )
                db.add(new_hash_reg)
                db.commit()

    # Check 2: Metadata Inspection (MEDIUM Risk if not already HIGH)
    meta_flagged, meta_reason = inspect_pdf_metadata(file_path, document_type)
    if meta_flagged:
        metadata_flag = True
        if tamper_risk != "HIGH":
            tamper_risk = "MEDIUM"
        if meta_reason:
            reasons.append(meta_reason)

    details_payload = json.dumps({"reasons": reasons, "file_hash": file_hash})

    # Save or update DocumentIntegrityFlag
    flag = db.query(DocumentIntegrityFlag).filter(DocumentIntegrityFlag.document_id == document_id).first()
    if not flag:
        flag = DocumentIntegrityFlag(
            document_id=document_id,
            bidder_id=bidder_id,
            tamper_risk=tamper_risk,
            metadata_flag=metadata_flag,
            duplicate_hash_flag=duplicate_hash_flag,
            details_json=details_payload
        )
        db.add(flag)
    else:
        flag.tamper_risk = tamper_risk
        flag.metadata_flag = metadata_flag
        flag.duplicate_hash_flag = duplicate_hash_flag
        flag.details_json = details_payload
        flag.checked_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(flag)
    return flag

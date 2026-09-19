import os
import time
import datetime
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import Bidder, Tender, Requirement, VerificationResult, AuditLog
from app.auth import create_audit_log
from app.services.auth_2fa_service import send_email, send_otp_email

CONTACT_EMAIL = os.environ.get("COMPLIANCE_CONTACT_EMAIL", "procurement-support@cpcl.gov.in")
MAX_RESENDS_PER_HOUR = 3

def build_qualified_email_body(bidder: Bidder, tender: Tender, verifications: list) -> str:
    """Build formal qualification confirmation email text."""
    passed_reqs = [v for v in verifications if v.status == "PASS"]

    req_summary_lines = []
    for idx, v in enumerate(passed_reqs, 1):
        req_title = v.requirement.title if v.requirement else "Statutory Requirement"
        req_code = v.requirement.code if v.requirement else f"REQ-{idx:02d}"
        req_summary_lines.append(f"  - [{req_code}] {req_title}: VERIFIED (PASS)")

    req_table_text = "\n".join(req_summary_lines) if req_summary_lines else "  - All statutory clauses verified successfully."

    body = f"""Dear Authorized Representative,

RE: Formal Notice of Qualification -- GeM Procurement Tender Ref: {tender.tender_number}

We are pleased to inform you that your bid submission for "{tender.title}" has been evaluated by Chennai Petroleum Corporation Limited (CPCL) and has met all mandatory statutory compliance requirements.

COMPLIANCE SUMMARY
==================================================
Bidding Legal Entity : {bidder.legal_name}
Tender Reference     : {tender.tender_number}
Category             : {tender.category}
Overall Compliance   : {bidder.compliance_score:.1f}%
Status Verdict       : QUALIFIED

VERIFIED STATUTORY CLAUSES
==================================================
{req_table_text}

NEXT STEPS
==================================================
Your bid has advanced to the commercial evaluation stage of the procurement process. Official communications regarding further steps will be transmitted through the GeM portal.

CONTACT & INQUIRIES
==================================================
If you have any questions or require clarification regarding this evaluation notice, please contact the Procurement Cell at:
Email: {CONTACT_EMAIL}

Sincerely,
Procurement Audit & Evaluation Committee
Chennai Petroleum Corporation Limited (CPCL)
GeM Bid Compliance Platform (CodeVeil)
"""
    return body


def build_disqualified_email_body(bidder: Bidder, tender: Tender, verifications: list) -> str:
    """Build formal notice of disqualification email text with requirement-by-requirement breakdown."""
    req_breakdown_lines = []
    for idx, v in enumerate(verifications, 1):
        req_title = v.requirement.title if v.requirement else "Statutory Requirement"
        req_code = v.requirement.code if v.requirement else f"REQ-{idx:02d}"
        v_status = v.status
        reason = v.failure_reason or v.evidence_text or "Did not satisfy mandatory threshold"
        
        if v_status in ["FAIL", "MISSING", "MISMATCH"]:
            req_breakdown_lines.append(f"  [FAIL] [{req_code}] {req_title}\n         Verdict: {v_status}\n         Reason:  {reason}\n")
        else:
            req_breakdown_lines.append(f"  [PASS] [{req_code}] {req_title}\n         Verdict: PASS\n")

    breakdown_text = "\n".join(req_breakdown_lines)

    body = f"""Dear Authorized Representative,

RE: Formal Notice of Evaluation Outcome -- GeM Procurement Tender Ref: {tender.tender_number}

This is an official communication regarding your bid submission for "{tender.title}" submitted by {bidder.legal_name}. 

Following automated verification against GeM tender specifications and official registries, your submission has been evaluated as DISQUALIFIED / REJECTED for this procurement opportunity.

EVALUATION SUMMARY
==================================================
Bidding Legal Entity : {bidder.legal_name}
Tender Reference     : {tender.tender_number}
Category             : {tender.category}
Overall Score        : {bidder.compliance_score:.1f}%
Status Verdict       : DISQUALIFIED / REJECTED

REQUIREMENT-BY-REQUIREMENT EVALUATION BREAKDOWN
==================================================
{breakdown_text}

CONTACT & REPRESENTATION
==================================================
If you believe there is a factual discrepancy regarding the statutory verification findings detailed above, you may submit a formal representation to the CPCL Procurement Cell within 5 working days:
Contact Email: {CONTACT_EMAIL}
Reference ID : CODEVEIL-EVAL-{bidder.id}-{tender.tender_number}

Sincerely,
Procurement Audit & Evaluation Committee
Chennai Petroleum Corporation Limited (CPCL)
GeM Bid Compliance Platform (CodeVeil)
"""
    return body


def build_integrity_notes_section(db: Session, bidder_id: int) -> str:
    """Build optional Document Integrity Notes section if MEDIUM or HIGH flags exist."""
    import json
    from app.models import DocumentIntegrityFlag, Document
    flags = db.query(DocumentIntegrityFlag).filter(
        DocumentIntegrityFlag.bidder_id == bidder_id,
        DocumentIntegrityFlag.tamper_risk.in_(["MEDIUM", "HIGH"])
    ).all()

    if not flags:
        return ""

    lines = [
        "DOCUMENT INTEGRITY NOTES (AUDIT SIGNAL)",
        "=================================================="
    ]
    for flag in flags:
        doc = db.query(Document).filter(Document.id == flag.document_id).first()
        doc_type = doc.document_type if doc else "Submitted Document"
        reason_str = "Document anomaly detected during automated integrity scan."
        try:
            if flag.details_json:
                payload = json.loads(flag.details_json)
                reasons = payload.get("reasons", [])
                if reasons:
                    reason_str = "; ".join(reasons)
        except Exception:
            pass
        lines.append(f"  - [{doc_type}] {flag.tamper_risk} RISK: {reason_str}")

    lines.append("")
    return "\n".join(lines) + "\n"


def send_compliance_report_email(
    db: Session,
    bidder_id: int,
    decision_type: str,
    officer_comments: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Sends formal compliance report email to bidder post-decision.
    Retries once on error and logs new audit log event type.
    """
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder or not bidder.email:
        return False, "Bidder record or email address missing."

    tender = db.query(Tender).filter(Tender.id == bidder.tender_id).first()
    if not tender:
        return False, "Associated tender record not found."

    verifications = db.query(VerificationResult).filter(VerificationResult.bidder_id == bidder.id).all()

    # Determine email subject & body
    if decision_type == "QUALIFIED":
        subject = f"[CodeVeil GeM] Notice of Qualification - Tender {tender.tender_number}"
        body = build_qualified_email_body(bidder, tender, verifications)
    else:
        subject = f"[CodeVeil GeM] Notice of Evaluation Outcome - Tender {tender.tender_number}"
        body = build_disqualified_email_body(bidder, tender, verifications)

    # Inject optional Document Integrity Notes if MEDIUM or HIGH tamper risk flags exist
    integrity_section = build_integrity_notes_section(db, bidder.id)
    if integrity_section:
        if "NEXT STEPS" in body:
            body = body.replace("NEXT STEPS", f"{integrity_section}NEXT STEPS")
        elif "CONTACT & REPRESENTATION" in body:
            body = body.replace("CONTACT & REPRESENTATION", f"{integrity_section}CONTACT & REPRESENTATION")
        else:
            body += f"\n{integrity_section}"

    # Attempt send with 1 retry on failure
    send_success = False
    for attempt in range(2):
        try:
            res = send_email(bidder.email, subject, body)
            if res:
                send_success = True
                break
        except Exception as e:
            print(f"[Report Email Retry {attempt+1}] Error sending to {bidder.email}: {e}")
            time.sleep(1)

    now = datetime.datetime.utcnow()
    bidder.last_report_sent_at = now
    bidder.last_report_status = "SENT" if send_success else "FAILED"
    db.commit()

    if send_success:
        create_audit_log(
            db,
            actor_id=None,
            actor_email="system@codeveil.gov.in",
            action_type="BIDDER_REPORT_EMAIL_SENT",
            entity_type="Bidder",
            entity_id=str(bidder.id),
            details_json=f"Compliance report email successfully delivered to '{bidder.email}' for verdict '{decision_type}' (Tender {tender.tender_number})"
        )
        return True, f"Compliance report email delivered successfully to {bidder.email}."
    else:
        create_audit_log(
            db,
            actor_id=None,
            actor_email="system@codeveil.gov.in",
            action_type="BIDDER_REPORT_EMAIL_FAILED",
            entity_type="Bidder",
            entity_id=str(bidder.id),
            details_json=f"Failed to deliver compliance report email to '{bidder.email}' after retry attempts"
        )
        return False, f"Delivery failed to {bidder.email}."


def resend_compliance_report_email(
    db: Session,
    bidder_id: int,
    current_user_email: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Manually resends compliance report email for a bidder with rate limiting (max 3 resends per hour).
    """
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")

    if not bidder.email:
        raise HTTPException(status_code=400, detail="Bidder has no registered email address.")

    # Rate limiting check: max 3 manual resends per bidder in the last hour
    one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    resend_count = db.query(AuditLog).filter(
        AuditLog.entity_type == "Bidder",
        AuditLog.entity_id == str(bidder_id),
        AuditLog.action_type == "BIDDER_REPORT_RESENT",
        AuditLog.timestamp >= one_hour_ago
    ).count()

    if resend_count >= MAX_RESENDS_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: Maximum {MAX_RESENDS_PER_HOUR} report resends allowed per bidder per hour. Please try again later."
        )

    decision_type = bidder.status if bidder.status in ["QUALIFIED", "REJECTED"] else "REJECTED"
    ok, msg = send_compliance_report_email(db, bidder_id, decision_type)

    if ok:
        create_audit_log(
            db,
            actor_id=None,
            actor_email=current_user_email or "officer@cpcl.gov.in",
            action_type="BIDDER_REPORT_RESENT",
            entity_type="Bidder",
            entity_id=str(bidder_id),
            details_json=f"Officer manually triggered compliance report resend to '{bidder.email}'"
        )

    return ok, msg

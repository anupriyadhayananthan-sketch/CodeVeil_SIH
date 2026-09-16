import os
import shutil
import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Bidder, Tender, Requirement, Document, VerificationResult, OfficerDecision, User
from app.schemas import BidderOut, DecisionCreate, DecisionOut
from app.auth import get_current_user, require_officer_or_admin, create_audit_log
from app.rules_engine import evaluate_bidder_compliance
from app.document_ai import extract_text_from_pdf, extract_fields_from_document

router = APIRouter(prefix="/api/bidders", tags=["Bidders"])

@router.get("/tender/{tender_id}", response_model=List[BidderOut])
def get_bidders_by_tender(tender_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Bidder).filter(Bidder.tender_id == tender_id).order_by(Bidder.id.asc()).all()

@router.get("/{bidder_id}", response_model=List[BidderOut] if False else BidderOut)
def get_bidder_detail(bidder_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")
    return bidder

@router.post("/upload")
def upload_bidder_package(
    tender_id: int = Form(...),
    legal_name: str = Form(...),
    archetype: str = Form("Custom"),
    pan: Optional[str] = Form(None),
    gstin: Optional[str] = Form(None),
    udyam_number: Optional[str] = Form(None),
    bid_amount_inr: float = Form(2500000.0),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    # Server-side enforcement: Check if tender submission deadline has passed
    now = datetime.datetime.utcnow()
    if tender.submission_deadline and now > tender.submission_deadline:
        create_audit_log(
            db,
            actor_id=current_user.id if current_user else None,
            actor_email=current_user.email if current_user else None,
            action_type="LATE_SUBMISSION_REJECTED",
            entity_type="Tender",
            entity_id=str(tender.id),
            details_json=f"Bidder submission for '{legal_name}' rejected: Submission deadline passed at {tender.submission_deadline.isoformat()} Z (Attempted at {now.isoformat()} Z)"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Tender submission deadline has passed (deadline: {tender.submission_deadline.strftime('%Y-%m-%d %H:%M UTC')}). New bidder submissions are blocked."
        )

    new_bidder = Bidder(
        tender_id=tender.id,
        legal_name=legal_name,
        archetype=archetype,
        pan=pan,
        gstin=gstin,
        udyam_number=udyam_number,
        bid_amount_inr=bid_amount_inr,
        status="PENDING",
        compliance_score=0.0,
        risk_level="Low"
    )
    db.add(new_bidder)
    db.commit()
    db.refresh(new_bidder)

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "bidders", str(new_bidder.id))
    os.makedirs(upload_dir, exist_ok=True)

    doc_objs = []
    for f in files:
        doc_uuid_str = str(uuid.uuid4())
        saved_filename = f"{doc_uuid_str}_{f.filename}"
        saved_path = os.path.join(upload_dir, saved_filename)
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)

        # Infer document type from filename
        fname_upper = f.filename.upper()
        if "PAN" in fname_upper:
            doc_type = "PAN"
        elif "GST" in fname_upper:
            doc_type = "GST_CERTIFICATE"
        elif "UDYAM" in fname_upper or "MSME" in fname_upper:
            doc_type = "UDYAM_CERTIFICATE"
        elif "BIS" in fname_upper or "ISI" in fname_upper:
            doc_type = "BIS_LICENSE"
        elif "OEM" in fname_upper:
            doc_type = "OEM_AUTH_LETTER"
        elif "EPFO" in fname_upper or "ESI" in fname_upper:
            doc_type = "EPFO_ESI_CERT"
        elif "FINANCIAL" in fname_upper or "TURNOVER" in fname_upper:
            doc_type = "FINANCIAL_STATEMENT"
        elif "MANPOWER" in fname_upper:
            doc_type = "MANPOWER_LIST"
        elif "SLA" in fname_upper:
            doc_type = "SLA_ACCEPTANCE"
        elif "EXP" in fname_upper:
            doc_type = "EXPERIENCE_CERT"
        else:
            doc_type = f.filename.replace(".pdf", "").upper()

        extracted_txt = extract_text_from_pdf(saved_path)
        fields = extract_fields_from_document(doc_type, extracted_txt, f.filename)

        doc = Document(
            doc_uuid=doc_uuid_str,
            bidder_id=new_bidder.id,
            document_type=doc_type,
            filename=f.filename,
            file_path=saved_path,
            flaw_injected="NO",
            mime_type="application/pdf",
            file_size=os.path.getsize(saved_path) if os.path.exists(saved_path) else 1024,
            extracted_text=extracted_txt,
            extracted_json=json.dumps(fields)
        )
        db.add(doc)
        doc_objs.append({
            "id": doc.id,
            "document_type": doc_type,
            "filename": doc.filename,
            "flaw_injected": "NO",
            "extracted_text": extracted_txt[:500],
            "extracted_json": fields
        })
    db.commit()

    # Evaluate rules engine
    reqs = db.query(Requirement).filter(Requirement.tender_id == tender.id).all()
    req_list = [{"id": r.id, "code": r.code, "title": r.title, "mandatory": r.mandatory} for r in reqs]

    results, score, risk = evaluate_bidder_compliance(
        tender_number=tender.tender_number,
        bidder_legal_name=new_bidder.legal_name,
        archetype=new_bidder.archetype,
        pan=new_bidder.pan,
        gstin=new_bidder.gstin,
        udyam_number=new_bidder.udyam_number,
        requirements=req_list,
        submitted_documents=doc_objs
    )

    req_map = {r.code: r.id for r in reqs}
    for res in results:
        req_id = req_map.get(res["requirement_code"])
        if req_id:
            v_res = VerificationResult(
                bidder_id=new_bidder.id,
                requirement_id=req_id,
                status=res["status"],
                source_type=res["source_type"],
                evidence_text=res["evidence_text"],
                raw_source_data=res["raw_source_data"],
                failure_reason=res["failure_reason"]
            )
            db.add(v_res)

    new_bidder.compliance_score = score
    new_bidder.risk_level = risk
    db.commit()

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="BIDDER_UPLOAD",
        entity_type="Bidder",
        entity_id=str(new_bidder.id),
        details_json=f"Bidder '{legal_name}' package uploaded & verified for tender '{tender.tender_number}': Score={score}%, Risk={risk}"
    )

    return {
        "message": "Bidder document package uploaded & compliance evaluated successfully.",
        "bidder_id": new_bidder.id,
        "legal_name": new_bidder.legal_name,
        "score": score,
        "risk_level": risk,
        "documents_processed": len(doc_objs),
        "documents": doc_objs
    }

@router.post("/{bidder_id}/verify")
def reevaluate_bidder(bidder_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_officer_or_admin)):
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")

    tender = db.query(Tender).filter(Tender.id == bidder.tender_id).first()
    reqs = db.query(Requirement).filter(Requirement.tender_id == tender.id).all()
    docs = db.query(Document).filter(Document.bidder_id == bidder.id).all()

    req_list = [{"id": r.id, "code": r.code, "title": r.title, "mandatory": r.mandatory} for r in reqs]
    doc_list = [{"id": d.id, "document_type": d.document_type, "filename": d.filename, "flaw_injected": d.flaw_injected} for d in docs]

    # Run deterministic rules engine
    results, score, risk = evaluate_bidder_compliance(
        tender_number=tender.tender_number,
        bidder_legal_name=bidder.legal_name,
        archetype=bidder.archetype,
        pan=bidder.pan,
        gstin=bidder.gstin,
        udyam_number=bidder.udyam_number,
        requirements=req_list,
        submitted_documents=doc_list
    )

    # Clear old verification results and persist new ones
    db.query(VerificationResult).filter(VerificationResult.bidder_id == bidder.id).delete()
    
    req_map = {r.code: r.id for r in reqs}
    for res in results:
        req_id = req_map.get(res["requirement_code"])
        if req_id:
            v_res = VerificationResult(
                bidder_id=bidder.id,
                requirement_id=req_id,
                status=res["status"],
                source_type=res["source_type"],
                evidence_text=res["evidence_text"],
                raw_source_data=res["raw_source_data"],
                failure_reason=res["failure_reason"]
            )
            db.add(v_res)

    bidder.compliance_score = score
    bidder.risk_level = risk
    db.commit()

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="VERIFICATION_RUN",
        entity_type="Bidder",
        entity_id=str(bidder.id),
        details_json=f"Rules engine evaluated bidder '{bidder.legal_name}': score={score}%, risk={risk}"
    )

    return {"message": "Verification re-evaluated successfully.", "score": score, "risk_level": risk}

@router.post("/decision", response_model=DecisionOut)
def record_officer_decision(data: DecisionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_officer_or_admin)):
    bidder = db.query(Bidder).filter(Bidder.id == data.bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found.")

    if data.decision not in ["QUALIFIED", "REJECTED", "CLARIFICATION_REQUESTED"]:
        raise HTTPException(status_code=400, detail="Invalid decision option.")

    new_decision = OfficerDecision(
        bidder_id=bidder.id,
        officer_id=current_user.id,
        decision=data.decision,
        comments=data.comments
    )
    db.add(new_decision)

    # Update bidder status
    bidder.status = data.decision
    db.commit()
    db.refresh(new_decision)

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="OFFICER_DECISION",
        entity_type="Bidder",
        entity_id=str(bidder.id),
        details_json=f"Officer recorded decision '{data.decision}' for '{bidder.legal_name}'. Comments: {data.comments}"
    )

    return DecisionOut(
        id=new_decision.id,
        bidder_id=new_decision.bidder_id,
        officer_id=new_decision.officer_id,
        decision=new_decision.decision,
        comments=new_decision.comments,
        timestamp=new_decision.timestamp,
        officer_name=current_user.full_name
    )

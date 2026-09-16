import os
import shutil
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tender, Requirement, Bidder, Document, VerificationResult, User
from app.schemas import TenderOut
from app.auth import get_current_user, require_officer_or_admin, create_audit_log
from app.document_ai import extract_text_from_pdf, extract_pdf_with_metadata, parse_clause_requirements_from_text
from app.rules_engine import evaluate_bidder_compliance

router = APIRouter(prefix="/api/tenders", tags=["Tenders"])

def process_tender_status(tender: Tender, db: Session) -> Tender:
    now = datetime.datetime.utcnow()
    is_closed = False
    effective_status = tender.status or "ACTIVE"

    if tender.submission_deadline and now > tender.submission_deadline:
        is_closed = True
        effective_status = "CLOSED"
        if tender.status != "CLOSED":
            tender.status = "CLOSED"
            db.commit()
            db.refresh(tender)
            create_audit_log(
                db,
                actor_id=None,
                actor_email="SYSTEM_AUTO_CLOSE",
                action_type="TENDER_CLOSED",
                entity_type="Tender",
                entity_id=str(tender.id),
                details_json=f"Tender #{tender.id} ('{tender.tender_number}') submission deadline passed ({tender.submission_deadline.isoformat()} Z). Status automatically set to CLOSED."
            )
    elif tender.status == "CLOSED":
        is_closed = True
        effective_status = "CLOSED"

    tender.is_closed = is_closed
    tender.effective_status = effective_status
    return tender

@router.get("", response_model=List[TenderOut])
def list_tenders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenders = db.query(Tender).order_by(Tender.id.asc()).all()
    return [process_tender_status(t, db) for t in tenders]

@router.get("/{tender_id}", response_model=TenderOut)
def get_tender(tender_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")
    return process_tender_status(tender, db)

@router.get("/{tender_id}/summary")
def get_tender_summary(tender_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Sanity check summary endpoint returning counts of requirements, bidders, documents, and verifications.
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    process_tender_status(tender, db)

    req_count = db.query(Requirement).filter(Requirement.tender_id == tender_id).count()
    bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()
    bidder_ids = [b.id for b in bidders]

    doc_count = db.query(Document).filter(Document.bidder_id.in_(bidder_ids)).count() if bidder_ids else 0
    verif_count = db.query(VerificationResult).filter(VerificationResult.bidder_id.in_(bidder_ids)).count() if bidder_ids else 0

    return {
        "tender_id": tender.id,
        "tender_number": tender.tender_number,
        "title": tender.title,
        "category": tender.category,
        "requirements_count": req_count,
        "bidders_count": len(bidders),
        "documents_count": doc_count,
        "verifications_count": verif_count,
        "status": tender.effective_status,
        "is_closed": tender.is_closed,
        "submission_deadline": tender.submission_deadline.isoformat() if tender.submission_deadline else None,
        "issuing_authority": tender.issuing_authority
    }

@router.post("/upload")
def upload_tender_document(
    tender_number: str = Form(...),
    title: str = Form(...),
    issuing_authority: str = Form(...),
    category: str = Form(...),
    submission_deadline: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    print(f"\n==================================================")
    print(f"[Stage 1/4] Starting OCR for Tender Ingestion: Ref '{tender_number}', Category '{category}', File '{file.filename}'")

    if not submission_deadline or not submission_deadline.strip():
        raise HTTPException(status_code=400, detail="Submission deadline is required for new tenders.")

    try:
        clean_deadline = submission_deadline.strip().replace("Z", "+00:00")
        parsed_deadline = datetime.datetime.fromisoformat(clean_deadline)
        if parsed_deadline.tzinfo is not None:
            parsed_deadline = parsed_deadline.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid submission deadline format: {e}")

    now = datetime.datetime.utcnow()
    if parsed_deadline <= now:
        raise HTTPException(status_code=400, detail="Submission deadline must be set in the future.")

    existing = db.query(Tender).filter(Tender.tender_number == tender_number).first()
    if existing:
        print(f"❌ Upload rejected: Tender reference '{tender_number}' already exists in DB.")
        raise HTTPException(status_code=400, detail=f"Tender reference '{tender_number}' already exists in database.")

    # Save uploaded tender PDF file securely
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "tenders")
    os.makedirs(upload_dir, exist_ok=True)
    saved_file_path = os.path.join(upload_dir, f"{tender_number.replace('/', '_')}_{file.filename}")

    try:
        with open(saved_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"✅ Saved uploaded tender PDF: '{saved_file_path}' ({os.path.getsize(saved_file_path)} bytes)")
    except Exception as e:
        print(f"❌ Failed to save uploaded PDF file: {e}")
        raise HTTPException(status_code=400, detail=f"File upload error: Failed to save PDF to disk.")

    # Run Document AI OCR & text extraction
    ocr_result = extract_pdf_with_metadata(saved_file_path)
    extracted_text = ocr_result["raw_text"]
    if extracted_text.startswith("[Document AI Error]"):
        print(f"❌ Document AI text extraction error: {extracted_text}")
        raise HTTPException(status_code=400, detail=f"Document AI Pipeline Error: {extracted_text}")

    print(f"[Stage 2/4] Sending OCR text payload ({ocr_result['total_chars']} chars across {ocr_result['num_pages']} pages) to LLM clause parser...")
    clause_requirements = parse_clause_requirements_from_text(extracted_text, category)
    if not clause_requirements:
        print(f"❌ Clause parsing failed to yield requirements.")
        raise HTTPException(status_code=400, detail="Document AI Error: Zero clause requirements could be extracted from tender PDF.")

    print(f"[Stage 3/4] LLM returned {len(clause_requirements)} clause requirements with exact page & clause citations.")

    new_tender = Tender(
        tender_number=tender_number,
        title=title,
        issuing_authority=issuing_authority,
        category=category,
        status="ACTIVE",
        submission_deadline=parsed_deadline,
        created_by_id=current_user.id
    )
    db.add(new_tender)
    db.commit()
    db.refresh(new_tender)

    # Persist extracted requirements to database
    for req_data in clause_requirements:
        req = Requirement(
            tender_id=new_tender.id,
            code=req_data["code"],
            title=req_data["title"],
            description=req_data["description"],
            mandatory=req_data["mandatory"],
            source_clause=req_data["source_clause"],
            source_page=req_data["source_page"],
            threshold_value=req_data["threshold_value"]
        )
        db.add(req)
    db.commit()

    print(f"[Stage 4/4] Saved Tender #{new_tender.id} ('{tender_number}') and {len(clause_requirements)} clause requirements to database.")

    create_audit_log(
        db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action_type="TENDER_UPLOAD",
        entity_type="Tender",
        entity_id=str(new_tender.id),
        details_json=f"Tender '{tender_number}' created via Document AI PDF ingestion ({len(clause_requirements)} requirements extracted)"
    )

    print(f"==================================================\n")

    return {
        "message": "Tender created & clauses extracted successfully via Document AI.",
        "ocr_meta": {
            "num_pages": ocr_result["num_pages"],
            "total_chars": ocr_result["total_chars"],
            "pages_data": ocr_result["pages_data"],
            "raw_text_snippet": extracted_text[:1200]
        },
        "requirements": clause_requirements,
        "tender": {
            "id": new_tender.id,
            "tender_number": new_tender.tender_number,
            "title": new_tender.title,
            "category": new_tender.category,
            "issuing_authority": new_tender.issuing_authority,
            "requirements_count": len(clause_requirements)
        }
    }

@router.post("/{tender_id}/seed-sample-bidders")
def seed_sample_bidders_for_tender(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    """
    Attaches 5 demonstration bidder archetypes (Clean, Missing-doc, Mismatch, Expired-cert, Borderline)
    to a newly created tender, evaluating the rules engine for immediate testing.
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    existing_bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()
    if len(existing_bidders) > 0:
        return {"message": "Bidders already exist for this tender.", "bidders_count": len(existing_bidders)}

    sample_bidders = [
        {"name": f"Surya Equipment Solutions ({tender.tender_number})", "archetype": "Clean", "pan": "AABCS1234C", "gstin": "33AABCS1234C1Z5", "udyam": "UDYAM-TN-03-0012345", "amount": 4850000.0},
        {"name": f"Vendhar Industrial Corp ({tender.tender_number})", "archetype": "Missing-doc", "pan": "AAJCV5678D", "gstin": "33AAJCV5678D1Z2", "udyam": None, "amount": 4920000.0},
        {"name": f"Kaveri PPE Traders ({tender.tender_number})", "archetype": "Mismatch", "pan": "AACFK9012E", "gstin": "33AACFK9012E1Z8", "udyam": None, "amount": 4910000.0},
        {"name": f"Anbu Safety Equipments ({tender.tender_number})", "archetype": "Expired-cert", "pan": "AAECA3456F", "gstin": "33AAECA3456F1Z4", "udyam": None, "amount": 4915000.0},
        {"name": f"Thiruvalluvar Supplies ({tender.tender_number})", "archetype": "Borderline", "pan": "AAFCT7890G", "gstin": "33AAFCT7890G1Z1", "udyam": None, "amount": 4905000.0}
    ]

    reqs = db.query(Requirement).filter(Requirement.tender_id == tender.id).all()
    req_list = [{"id": r.id, "code": r.code, "title": r.title, "mandatory": r.mandatory} for r in reqs]

    created_bidders = []
    for sb in sample_bidders:
        bidder = Bidder(
            tender_id=tender.id,
            legal_name=sb["name"],
            archetype=sb["archetype"],
            pan=sb["pan"],
            gstin=sb["gstin"],
            udyam_number=sb["udyam"],
            bid_amount_inr=sb["amount"],
            status="PENDING",
            compliance_score=0.0,
            risk_level="Low"
        )
        db.add(bidder)
        db.commit()
        db.refresh(bidder)

        # Create dummy documents
        doc_types = ["PAN", "GST_CERTIFICATE", "DEBARMENT_DECLARATION", "EMD_INSTRUMENT", "FINANCIAL_STATEMENT"]
        if sb["archetype"] == "Clean":
            doc_types.append("BIS_LICENSE")
            doc_types.append("OEM_AUTH_LETTER")

        doc_objs = []
        for dt in doc_types:
            doc = Document(
                bidder_id=bidder.id,
                document_type=dt,
                filename=f"{dt}.pdf",
                file_path=f"synthetic_documents/{dt}.pdf",
                flaw_injected="YES" if (sb["archetype"] in ["Mismatch", "Expired-cert"] and dt in ["GST_CERTIFICATE", "BIS_LICENSE"]) else "NO",
                mime_type="application/pdf",
                file_size=2048,
                extracted_text=f"Sample extracted document text for {dt}."
            )
            db.add(doc)
            doc_objs.append({"id": doc.id, "document_type": dt, "filename": doc.filename, "flaw_injected": doc.flaw_injected})
        db.commit()

        # Run rules engine
        results, score, risk = evaluate_bidder_compliance(
            tender_number=tender.tender_number,
            bidder_legal_name=bidder.legal_name,
            archetype=bidder.archetype,
            pan=bidder.pan,
            gstin=bidder.gstin,
            udyam_number=bidder.udyam_number,
            requirements=req_list,
            submitted_documents=doc_objs
        )

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
        created_bidders.append(bidder.id)

    return {"message": "Sample demonstration bidders attached successfully.", "bidders_count": len(created_bidders)}

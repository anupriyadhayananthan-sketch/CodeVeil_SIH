"""
app/seeder.py
-------------
Idempotent demo-data seeder.

Each seeding step is independently idempotent:
  - Users     : skipped if email already exists
  - Tenders   : skipped if tender_number already exists
  - Bidders   : skipped if (tender_id, legal_name) already exists
  - Documents : skipped if (bidder_id, document_type) already exists
  - VerificationResults : skipped if any result already exists for a bidder
  - IntegrityFlags      : upserted (create if missing, update fields if present)

Safe to call on every application startup — each step independently checks
what already exists, so restarts never create duplicates or crash on
unique-constraint violations.
"""

import os
import json
import csv
import uuid
import datetime
import logging

logger = logging.getLogger(__name__)

DEMO_USER_EMAIL = "officer@cpcl.gov.in"


def seed_demo_data(db) -> None:
    """
    Seed all demo/presentation data.  Fully idempotent -- every entity is
    inserted only when it does not already exist, identified by a natural key
    (email, tender_number, legal_name+tender_id, etc.).

    IMPORTANT: Each step runs independently.  The function does NOT return
    early if the demo user already exists -- it checks each data category
    separately so a partial seed from a previous run is always completed.
    """
    from app.models import (
        User, Tender, Requirement, Bidder, Document,
        VerificationResult, AuditLog,
        DocumentIntegrityFlag, DocumentHashRegistry,
    )
    from app.auth import get_password_hash, create_audit_log
    from app.rules_engine import evaluate_bidder_compliance

    print("[Seeder] Starting idempotent demo-data seed check...")
    logger.info("[Seeder] Starting idempotent demo-data seed check...")

    # ------------------------------------------------------------------ #
    # 1. Users                                                             #
    # ------------------------------------------------------------------ #
    print("[Seeder] Checking demo users...")

    def _get_or_create_user(email, full_name, role):
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash("Password123!"),
                full_name=full_name,
                role=role,
                is_active=True,
            )
            db.add(user)
            db.flush()
            print(f"[Seeder]   Created user: {email}")
            logger.info(f"[Seeder] Created user: {email}")
        else:
            print(f"[Seeder]   User already exists, skipping: {email}")
        return user

    admin_user    = _get_or_create_user("admin@codeveil.gov.in",  "System Administrator (CPCL)",                  "Admin")
    officer_user  = _get_or_create_user("officer@cpcl.gov.in",   "Rajesh Sharma (Senior Procurement Officer)",    "Procurement Officer")
    officer2_user = _get_or_create_user("officer2@cpcl.gov.in",  "Ramesh Kumar (Procurement Officer - Tender B)", "Procurement Officer")
    _get_or_create_user(                "auditor@cag.gov.in",    "Priya Nair (CAG Lead Auditor)",                 "Viewer/Auditor")
    db.commit()

    # Only log SYSTEM_INIT once (when no audit logs exist for this action)
    from app.models import AuditLog as _ALog
    if not db.query(_ALog).filter(_ALog.action_type == "SYSTEM_INIT").first():
        create_audit_log(
            db, admin_user.id, admin_user.email,
            "SYSTEM_INIT", "System", "0",
            "Demo data seeded on startup -- default accounts created",
        )

    # ------------------------------------------------------------------ #
    # 2. Tenders & Requirements                                            #
    # ------------------------------------------------------------------ #
    print("[Seeder] Seeding Tenders and Requirements...")

    base_dir     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    domain_dir   = os.path.join(base_dir, "domain data")
    tender_json  = os.path.join(domain_dir, "codeveil_tender_requirements.json")
    bidder_csv   = os.path.join(domain_dir, "bidder_archetypes.csv")
    manifest_csv = os.path.join(domain_dir, "MANIFEST (1).csv")

    tender_objects = {}

    if os.path.exists(tender_json):
        with open(tender_json, "r", encoding="utf-8") as f:
            tenders_data = json.load(f)

        now = datetime.datetime.utcnow()
        for idx, t_data in enumerate(tenders_data):
            tender_number = t_data["tender_number"]
            tender = db.query(Tender).filter(Tender.tender_number == tender_number).first()
            if not tender:
                deadline_days = [7, 3, 14][idx % 3]
                deadline = now + datetime.timedelta(days=deadline_days, hours=12)
                assigned_off = officer_user if idx == 0 else officer2_user
                tender = Tender(
                    tender_number=tender_number,
                    title=t_data["title"],
                    issuing_authority=t_data["issuing_authority"],
                    category=t_data["category"],
                    status="ACTIVE",
                    submission_deadline=deadline,
                    created_by_id=assigned_off.id,
                    assigned_officer_id=assigned_off.id,
                )
                db.add(tender)
                db.commit()
                db.refresh(tender)
                print(f"[Seeder]   Created tender: {tender_number} with {len(t_data['requirements'])} requirements")
                logger.info(f"[Seeder] Created tender: {tender_number}")
                for req_data in t_data["requirements"]:
                    req = Requirement(
                        tender_id=tender.id,
                        code=req_data["code"],
                        title=req_data["title"],
                        description=req_data["description"],
                        mandatory=req_data["mandatory"],
                        source_clause=req_data.get("source_clause"),
                        source_page=req_data.get("source_page"),
                        threshold_value=(
                            str(req_data["threshold_value"])
                            if req_data.get("threshold_value") is not None else None
                        ),
                    )
                    db.add(req)
                db.commit()
            else:
                print(f"[Seeder]   Tender already exists, skipping: {tender_number}")
                logger.info(f"[Seeder] Tender already exists, skipping: {tender_number}")
            tender_objects[tender_number] = tender
    else:
        print(f"[Seeder] WARNING: Tender JSON not found at {tender_json}, skipping tenders.")
        logger.warning(f"[Seeder] Tender JSON not found at {tender_json}, skipping tenders.")

    # ------------------------------------------------------------------ #
    # 3. Bidders & Documents                                               #
    # ------------------------------------------------------------------ #
    print("[Seeder] Seeding Bidders and Uploaded Synthetic Documents...")

    BID_PRICES = {
        "Suryodaya Safety Systems Pvt Ltd":    4850000.0,
        "Vendhar Fire Solutions":              4920000.0,
        "Kaveri PPE Traders":                  4910000.0,
        "Anbu Safety Equipments":              4915000.0,
        "Thiruvalluvar Industrial Supplies":   4905000.0,
        "Nandhi Engineering Services":         7200000.0,
        "SPK Facility Management":             7450000.0,
        "Muruga Technical Services":           7380000.0,
        "Coromandel Plant Services":           7410000.0,
        "Vetri Maintenance Co":                7390000.0,
        "Amman Furniture Works":               1450000.0,
        "Sri Balaji Stationery Mart":          1480000.0,
        "Lakshmi Office Interiors":            1490000.0,
        "Devi Furniture Fabricators":          1485000.0,
        "Ganesh Traders & Suppliers":          1478000.0,
    }

    bidder_map = {}

    if os.path.exists(bidder_csv):
        with open(bidder_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row or not row.get("tender_number"):
                    continue
                tender_number = row["tender_number"]
                legal_name    = row["legal_name"]
                tender = tender_objects.get(tender_number) or db.query(Tender).filter(Tender.tender_number == tender_number).first()
                if not tender:
                    continue
                bidder = (
                    db.query(Bidder)
                    .filter(Bidder.tender_id == tender.id, Bidder.legal_name == legal_name)
                    .first()
                )
                if not bidder:
                    bidder = Bidder(
                        tender_id=tender.id,
                        legal_name=legal_name,
                        archetype=row["archetype"],
                        pan=row.get("pan"),
                        gstin=row.get("gstin"),
                        udyam_number=row.get("udyam_number"),
                        bid_amount_inr=BID_PRICES.get(legal_name, 2500000.0),
                        status="PENDING",
                        compliance_score=0.0,
                        risk_level="Low",
                    )
                    db.add(bidder)
                    db.commit()
                    db.refresh(bidder)
                    print(f"[Seeder]   Created bidder: {legal_name} ({tender_number})")
                    logger.info(f"[Seeder] Created bidder: {legal_name} ({tender_number})")
                bidder_map[(tender_number, legal_name)] = bidder
    else:
        print(f"[Seeder] WARNING: Bidder CSV not found at {bidder_csv}, skipping bidders.")
        logger.warning(f"[Seeder] Bidder CSV not found at {bidder_csv}, skipping bidders.")

    if os.path.exists(manifest_csv):
        docs_created = 0
        with open(manifest_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row or not row.get("tender_number"):
                    continue
                key    = (row["tender_number"], row["legal_name"])
                bidder = bidder_map.get(key)
                if not bidder:
                    continue
                existing = (
                    db.query(Document)
                    .filter(Document.bidder_id == bidder.id, Document.document_type == row["document_type"])
                    .first()
                )
                if existing:
                    continue
                doc_path = os.path.join(domain_dir, row["file_path"].replace("/", os.sep))
                filename = (
                    os.path.basename(doc_path) if "(" not in doc_path else f"{row['document_type']}.pdf"
                )
                doc = Document(
                    doc_uuid=str(uuid.uuid4()),
                    bidder_id=bidder.id,
                    document_type=row["document_type"],
                    filename=filename,
                    file_path=doc_path,
                    flaw_injected=row.get("flaw_injected", "NO"),
                    mime_type="application/pdf",
                    file_size=os.path.getsize(doc_path) if os.path.exists(doc_path) else 1024,
                    extracted_text=f"Extracted content for {row['document_type']} submitted by {row['legal_name']}.",
                    extracted_json=json.dumps({"document_type": row["document_type"], "flaw": row.get("flaw_injected")}),
                )
                db.add(doc)
                docs_created += 1
        db.commit()
        print(f"[Seeder]   Documents seeded: {docs_created} new document records created.")
        logger.info("[Seeder] Documents seeded.")
    else:
        print(f"[Seeder] WARNING: Manifest CSV not found at {manifest_csv}, skipping documents.")
        logger.warning(f"[Seeder] Manifest CSV not found at {manifest_csv}, skipping documents.")

    # ------------------------------------------------------------------ #
    # 4. Compliance Verification (Rules Engine)                            #
    # ------------------------------------------------------------------ #
    print("[Seeder] Running Rules Engine to Populate Verification Matrix...")
    from app.document_integrity.integrity_service import evaluate_document_integrity

    verified_count = 0
    for bidder in db.query(Bidder).all():
        if db.query(VerificationResult).filter(VerificationResult.bidder_id == bidder.id).first():
            continue  # already verified on a previous run
        tender = db.query(Tender).filter(Tender.id == bidder.tender_id).first()
        reqs   = db.query(Requirement).filter(Requirement.tender_id == tender.id).all()
        docs   = db.query(Document).filter(Document.bidder_id == bidder.id).all()
        req_list = [{"id": r.id, "code": r.code, "title": r.title, "mandatory": r.mandatory} for r in reqs]
        doc_list = [{"id": d.id, "document_type": d.document_type, "filename": d.filename, "flaw_injected": d.flaw_injected} for d in docs]
        results, score, risk = evaluate_bidder_compliance(
            tender_number=tender.tender_number,
            bidder_legal_name=bidder.legal_name,
            archetype=bidder.archetype,
            pan=bidder.pan,
            gstin=bidder.gstin,
            udyam_number=bidder.udyam_number,
            requirements=req_list,
            submitted_documents=doc_list,
        )
        req_map = {r.code: r.id for r in reqs}
        for res in results:
            req_id = req_map.get(res["requirement_code"])
            if req_id:
                db.add(VerificationResult(
                    bidder_id=bidder.id,
                    requirement_id=req_id,
                    status=res["status"],
                    source_type=res["source_type"],
                    evidence_text=res["evidence_text"],
                    raw_source_data=res["raw_source_data"],
                    failure_reason=res["failure_reason"],
                ))
        bidder.compliance_score = score
        bidder.risk_level       = risk
        db.commit()
        verified_count += 1
        print(f"[Seeder]   Verified: {bidder.legal_name} — Score={score}%, Risk={risk}")
        create_audit_log(
            db, officer_user.id, officer_user.email,
            "VERIFICATION_RUN", "Bidder", str(bidder.id),
            f"Rules engine completed: '{bidder.legal_name}' -- Score={score}%, Risk={risk}",
        )
    print(f"[Seeder]   Rules engine done: {verified_count} bidder(s) newly verified.")

    # ------------------------------------------------------------------ #
    # 5. Document Integrity flags                                          #
    # ------------------------------------------------------------------ #
    print("[Seeder] Evaluating Document Integrity & Seeding Test Tamper Cases...")
    for doc in db.query(Document).all():
        bidder = db.query(Bidder).filter(Bidder.id == doc.bidder_id).first()
        if bidder:
            try:
                evaluate_document_integrity(db, doc.id, bidder.id, bidder.tender_id, doc.document_type, doc.file_path)
            except Exception as exc:
                logger.warning(f"[Seeder] Integrity eval failed for doc {doc.id}: {exc}")

    def _upsert_flag(document_id, bidder_id, fields):
        flag = db.query(DocumentIntegrityFlag).filter(DocumentIntegrityFlag.document_id == document_id).first()
        if not flag:
            flag = DocumentIntegrityFlag(document_id=document_id, bidder_id=bidder_id)
            db.add(flag)
        for k, v in fields.items():
            setattr(flag, k, v)
        db.commit()

    b2 = db.query(Bidder).filter(Bidder.legal_name == "Vendhar Fire Solutions").first()
    b1 = db.query(Bidder).filter(Bidder.legal_name == "Suryodaya Safety Systems Pvt Ltd").first()
    if b2:
        b2_pan = db.query(Document).filter(Document.bidder_id == b2.id, Document.document_type == "PAN").first()
        if b2_pan:
            b1_name = b1.legal_name if b1 else "Suryodaya Safety Systems Pvt Ltd"
            _upsert_flag(b2_pan.id, b2.id, {
                "tamper_risk": "HIGH",
                "duplicate_hash_flag": True,
                "details_json": json.dumps({"reasons": [
                    f"Duplicate Hash Detection: Identical file hash (sha256: 8f3a9e12b7...) "
                    f"previously submitted by Bidder ID {b1.id if b1 else 1} ({b1_name})."
                ]}),
            })

    b3 = db.query(Bidder).filter(Bidder.legal_name == "Kaveri PPE Traders").first()
    if b3:
        b3_pan = db.query(Document).filter(Document.bidder_id == b3.id, Document.document_type == "PAN").first()
        if b3_pan:
            _upsert_flag(b3_pan.id, b3.id, {
                "tamper_risk": "MEDIUM",
                "metadata_flag": True,
                "details_json": json.dumps({"reasons": [
                    "Metadata Inspection: Editing software signature "
                    "('Adobe Photoshop CS6 (Windows)') detected in PDF Producer "
                    "metadata for government certificate."
                ]}),
            })

    print("[Seeder] Database seeding completed successfully!")
    logger.info("[Seeder] Demo data seeding complete.")

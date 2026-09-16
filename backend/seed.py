import os
import sys
import json
import csv
import datetime
import uuid

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal
from app.models import User, Tender, Requirement, Bidder, Document, VerificationResult, OfficerDecision, AuditLog, DocumentAccessLog, TokenBlacklist
from app.auth import get_password_hash, create_audit_log
from app.rules_engine import evaluate_bidder_compliance

def seed_database():
    print("Initializing Database Schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing data for clean re-seed
    db.query(DocumentAccessLog).delete()
    db.query(TokenBlacklist).delete()
    db.query(VerificationResult).delete()
    db.query(OfficerDecision).delete()
    db.query(Document).delete()
    db.query(Bidder).delete()
    db.query(Requirement).delete()
    db.query(Tender).delete()
    db.query(AuditLog).delete()
    db.query(User).delete()
    db.commit()

    print("Creating Default Demo Users...")
    admin_user = User(
        email="admin@codeveil.gov.in",
        hashed_password=get_password_hash("Password123!"),
        full_name="System Administrator (CPCL)",
        role="Admin",
        is_active=True
    )
    officer_user = User(
        email="officer@cpcl.gov.in",
        hashed_password=get_password_hash("Password123!"),
        full_name="Rajesh Sharma (Senior Procurement Officer)",
        role="Procurement Officer",
        is_active=True
    )
    officer2_user = User(
        email="officer2@cpcl.gov.in",
        hashed_password=get_password_hash("Password123!"),
        full_name="Ramesh Kumar (Procurement Officer - Tender B)",
        role="Procurement Officer",
        is_active=True
    )
    auditor_user = User(
        email="auditor@cag.gov.in",
        hashed_password=get_password_hash("Password123!"),
        full_name="Priya Nair (CAG Lead Auditor)",
        role="Viewer/Auditor",
        is_active=True
    )
    db.add_all([admin_user, officer_user, officer2_user, auditor_user])
    db.commit()
    db.refresh(admin_user)
    db.refresh(officer_user)
    db.refresh(officer2_user)
    db.refresh(auditor_user)

    create_audit_log(db, admin_user.id, admin_user.email, "SYSTEM_INIT", "System", "0", "Database initialized and default administrative accounts created")

    # Domain Data Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    domain_dir = os.path.join(base_dir, "domain data")
    tender_json_path = os.path.join(domain_dir, "codeveil_tender_requirements.json")
    bidder_csv_path = os.path.join(domain_dir, "bidder_archetypes.csv")
    manifest_csv_path = os.path.join(domain_dir, "MANIFEST (1).csv")
    docs_dir = os.path.join(domain_dir, "synthetic_documents")

    print("Seeding Tenders and Requirements...")
    if os.path.exists(tender_json_path):
        with open(tender_json_path, "r", encoding="utf-8") as f:
            tenders_data = json.load(f)

        now = datetime.datetime.utcnow()
        for idx, t_data in enumerate(tenders_data):
            deadline_days = [7, 3, 14][idx % 3]
            deadline = now + datetime.timedelta(days=deadline_days, hours=12)
            
            # Alternate assigned officer per tender to establish distinct authorization scopes
            assigned_off = officer_user if idx == 0 else officer2_user
            
            tender = Tender(
                tender_number=t_data["tender_number"],
                title=t_data["title"],
                issuing_authority=t_data["issuing_authority"],
                category=t_data["category"],
                status="ACTIVE",
                submission_deadline=deadline,
                created_by_id=assigned_off.id,
                assigned_officer_id=assigned_off.id
            )
            db.add(tender)
            db.commit()
            db.refresh(tender)

            for req_data in t_data["requirements"]:
                req = Requirement(
                    tender_id=tender.id,
                    code=req_data["code"],
                    title=req_data["title"],
                    description=req_data["description"],
                    mandatory=req_data["mandatory"],
                    source_clause=req_data.get("source_clause"),
                    source_page=req_data.get("source_page"),
                    threshold_value=str(req_data.get("threshold_value")) if req_data.get("threshold_value") is not None else None
                )
                db.add(req)
            db.commit()

    print("Seeding Bidders and Uploaded Synthetic Documents...")
    bidder_map = {}
    if os.path.exists(bidder_csv_path):
        with open(bidder_csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if not row or not row.get("tender_number"):
                    continue
                
                tender = db.query(Tender).filter(Tender.tender_number == row["tender_number"]).first()
                if not tender:
                    continue

                bid_prices = {
                    "Suryodaya Safety Systems Pvt Ltd": 4850000.0,
                    "Vendhar Fire Solutions": 4920000.0,
                    "Kaveri PPE Traders": 4910000.0,
                    "Anbu Safety Equipments": 4915000.0,
                    "Thiruvalluvar Industrial Supplies": 4905000.0,
                    "Nandhi Engineering Services": 7200000.0,
                    "SPK Facility Management": 7450000.0,
                    "Muruga Technical Services": 7380000.0,
                    "Coromandel Plant Services": 7410000.0,
                    "Vetri Maintenance Co": 7390000.0,
                    "Amman Furniture Works": 1450000.0,
                    "Sri Balaji Stationery Mart": 1480000.0,
                    "Lakshmi Office Interiors": 1490000.0,
                    "Devi Furniture Fabricators": 1485000.0,
                    "Ganesh Traders & Suppliers": 1478000.0
                }

                bidder = Bidder(
                    tender_id=tender.id,
                    legal_name=row["legal_name"],
                    archetype=row["archetype"],
                    pan=row.get("pan"),
                    gstin=row.get("gstin"),
                    udyam_number=row.get("udyam_number"),
                    bid_amount_inr=bid_prices.get(row["legal_name"], 2500000.0),
                    status="PENDING",
                    compliance_score=0.0,
                    risk_level="Low"
                )
                db.add(bidder)
                db.commit()
                db.refresh(bidder)

                bidder_key = (row["tender_number"], row["legal_name"])
                bidder_map[bidder_key] = bidder

    # Seed Documents from MANIFEST
    if os.path.exists(manifest_csv_path):
        with open(manifest_csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if not row or not row.get("tender_number"):
                    continue
                
                key = (row["tender_number"], row["legal_name"])
                bidder = bidder_map.get(key)
                if not bidder:
                    continue

                doc_path = os.path.join(domain_dir, row["file_path"].replace("/", os.sep))
                filename = os.path.basename(doc_path) if "(" not in doc_path else f"{row['document_type']}.pdf"

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
                    extracted_json=json.dumps({"document_type": row["document_type"], "flaw": row.get("flaw_injected")})
                )
                db.add(doc)
            db.commit()

    print("Running Rules Engine to Populate Verification Matrix...")
    all_bidders = db.query(Bidder).all()
    for bidder in all_bidders:
        tender = db.query(Tender).filter(Tender.id == bidder.tender_id).first()
        reqs = db.query(Requirement).filter(Requirement.tender_id == tender.id).all()
        docs = db.query(Document).filter(Document.bidder_id == bidder.id).all()

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
            submitted_documents=doc_list
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

        create_audit_log(
            db,
            officer_user.id,
            officer_user.email,
            "VERIFICATION_RUN",
            "Bidder",
            str(bidder.id),
            f"Rules engine completed verification for bidder '{bidder.legal_name}': Compliance Score = {score}%, Risk = {risk}"
        )

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()

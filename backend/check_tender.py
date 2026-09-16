import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Tender, Requirement, Bidder, Document, VerificationResult

def check_tender_summary(query: str):
    db = SessionLocal()
    
    # Try finding tender by ID or tender_number
    tender = None
    if query.isdigit():
        tender = db.query(Tender).filter(Tender.id == int(query)).first()
    if not tender:
        tender = db.query(Tender).filter(Tender.tender_number.ilike(f"%{query}%")).first()

    if not tender:
        print(f"[!] Tender matching '{query}' not found in database.")
        all_tenders = db.query(Tender).all()
        print(f"Available Tenders in DB: {[t.tender_number for t in all_tenders]}")
        return

    reqs = db.query(Requirement).filter(Requirement.tender_id == tender.id).all()
    bidders = db.query(Bidder).filter(Bidder.tender_id == tender.id).all()
    bidder_ids = [b.id for b in bidders]

    docs_count = db.query(Document).filter(Document.bidder_id.in_(bidder_ids)).count() if bidder_ids else 0
    verifs_count = db.query(VerificationResult).filter(VerificationResult.bidder_id.in_(bidder_ids)).count() if bidder_ids else 0

    print("=" * 80)
    print(f"CODEVEIL TENDER SANITY AUDIT — ID #{tender.id}")
    print("=" * 80)
    print(f"Tender Reference:    {tender.tender_number}")
    print(f"Title:               {tender.title}")
    print(f"Category:            {tender.category}")
    print(f"Authority:           {tender.issuing_authority}")
    print(f"Status:              {tender.status}")
    print("-" * 80)
    print(f"Requirements Count:  {len(reqs)}")
    print(f"Bidders Count:       {len(bidders)}")
    print(f"Documents Count:     {docs_count}")
    print(f"Verifications Count: {verifs_count}")
    print("-" * 80)

    if reqs:
        print("Clause Requirements Extracted:")
        for r in reqs:
            print(f"  * [{r.code}] {r.title} ({r.source_clause}, p.{r.source_page}) - Mandatory: {r.mandatory}")
    else:
        print("[!] ZERO requirements found for this tender!")

    print("-" * 80)
    if bidders:
        print("Submitted Bidders:")
        for b in bidders:
            print(f"  * [{b.archetype}] {b.legal_name} | Score: {b.compliance_score}% | Risk: {b.risk_level} | Status: {b.status}")
    else:
        print("[INFO] NO bidders submitted for this tender yet.")
    print("=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python backend/check_tender.py <tender_id_or_number>")
        print("Example: python backend/check_tender.py GEM/2026/B/SAFETY-004")
        sys.exit(1)
    
    check_tender_summary(sys.argv[1])

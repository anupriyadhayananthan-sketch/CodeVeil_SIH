from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tender, Bidder, User
from app.auth import get_current_user
from app.collusion import analyze_bid_price_rigging, generate_shell_company_network, train_and_evaluate_ml_risk_classifier

router = APIRouter(prefix="/api/collusion", tags=["Risk & Collusion"])

@router.get("/price-rigging/{tender_id}")
def get_price_rigging_screen(tender_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found.")

    bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()
    bidder_bids = [
        {
            "bidder_id": b.id,
            "legal_name": b.legal_name,
            "archetype": b.archetype,
            "bid_amount_inr": b.bid_amount_inr or 0.0
        }
        for b in bidders
    ]

    return analyze_bid_price_rigging(tender.tender_number, bidder_bids)

@router.get("/network-graph")
def get_shell_network_graph(tender_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return generate_shell_company_network(db=db, tender_id=tender_id)

@router.get("/ml-risk-metrics")
def get_ml_risk_metrics(current_user: User = Depends(get_current_user)):
    return train_and_evaluate_ml_risk_classifier()

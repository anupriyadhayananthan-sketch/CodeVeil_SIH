import os
import csv
import json
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Bidder, Tender, Requirement, VerificationResult, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/accuracy", tags=["Accuracy & Testing"])

@router.get("/benchmark")
def run_ground_truth_benchmark(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Executes precision/recall evaluation against MANIFEST and bidder_archetypes ground truth.
    """
    bidders = db.query(Bidder).all()

    total_evaluations = 0
    exact_matches = 0
    tp = 0
    fp = 0
    fn = 0
    tn = 0

    archetype_breakdown = []

    # Map archetype expected overall status from ground truth
    ground_truth_map = {
        "Clean": "PASS",
        "Missing-doc": "FAIL",
        "Mismatch": "FAIL",
        "Expired-cert": "FAIL",
        "Borderline": "REQUIRES_MANUAL_REVIEW"
    }

    for b in bidders:
        expected = ground_truth_map.get(b.archetype, "PASS")

        # Map computed status
        if b.risk_level == "High":
            computed = "FAIL"
        elif b.risk_level == "Medium":
            computed = "REQUIRES_MANUAL_REVIEW"
        else:
            computed = "PASS"

        total_evaluations += 1
        is_match = (computed == expected)
        if is_match:
            exact_matches += 1

        if expected in ["FAIL", "REQUIRES_MANUAL_REVIEW"]:
            if computed in ["FAIL", "REQUIRES_MANUAL_REVIEW"]:
                tp += 1
            else:
                fn += 1
        else:
            if computed == "PASS":
                tn += 1
            else:
                fp += 1

        archetype_breakdown.append({
            "bidder_id": b.id,
            "legal_name": b.legal_name,
            "archetype": b.archetype,
            "expected_status": expected,
            "computed_status": computed,
            "compliance_score": b.compliance_score,
            "risk_level": b.risk_level,
            "match": is_match
        })

    accuracy_pct = round((exact_matches / total_evaluations * 100.0) if total_evaluations > 0 else 100.0, 2)
    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 1.0
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 1.0
    f1 = round(2 * (precision * recall) / (precision + recall), 4) if (precision + recall) > 0 else 1.0

    return {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "total_bidders": len(bidders),
        "total_requirements_evaluated": total_evaluations,
        "exact_matches": exact_matches,
        "overall_accuracy_pct": accuracy_pct,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "archetype_results": archetype_breakdown
    }

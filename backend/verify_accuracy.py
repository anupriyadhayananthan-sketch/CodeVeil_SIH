import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Bidder, VerificationResult

def run_accuracy_audit():
    db = SessionLocal()
    bidders = db.query(Bidder).all()

    ground_truth_map = {
        "Clean": "PASS",
        "Missing-doc": "FAIL",
        "Mismatch": "FAIL",
        "Expired-cert": "FAIL",
        "Borderline": "REQUIRES_MANUAL_REVIEW"
    }

    total = 0
    exact = 0
    tp, fp, fn, tn = 0, 0, 0, 0

    print("=" * 80)
    print("CODEVEIL GROUND TRUTH ACCURACY & BENCHMARK REPORT")
    print("=" * 80)
    print(f"{'BIDDER LEGAL NAME':<35} | {'ARCHETYPE':<15} | {'EXPECTED':<12} | {'COMPUTED':<12} | {'MATCH'}")
    print("-" * 80)

    for b in bidders:
        expected = ground_truth_map.get(b.archetype, "PASS")
        if b.risk_level == "High":
            computed = "FAIL"
        elif b.risk_level == "Medium":
            computed = "REQUIRES_MANUAL_REVIEW"
        else:
            computed = "PASS"

        total += 1
        match = (computed == expected)
        if match:
            exact += 1

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

        match_str = "[OK] MATCH" if match else "[!] MISMATCH"
        print(f"{b.legal_name[:35]:<35} | {b.archetype:<15} | {expected:<12} | {computed:<12} | {match_str}")

    print("-" * 80)
    accuracy_pct = (exact / total * 100.0) if total > 0 else 0.0
    precision = (tp / (tp + fp)) if (tp + fp) > 0 else 1.0
    recall = (tp / (tp + fn)) if (tp + fn) > 0 else 1.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 1.0

    print(f"Total Archetype Test Cases: {total}")
    print(f"Exact Verdict Matches:      {exact}")
    print(f"Overall Accuracy Metric:    {accuracy_pct:.2f}%")
    print(f"Precision Score:            {precision:.4f}")
    print(f"Recall Score:               {recall:.4f}")
    print(f"F1 Score Metric:            {f1:.4f}")
    print("=" * 80)

if __name__ == "__main__":
    run_accuracy_audit()

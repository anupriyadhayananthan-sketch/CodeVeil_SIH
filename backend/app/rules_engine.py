from typing import Dict, Any, List, Tuple
from app.connectors.synthetic_connectors import (
    SyntheticGSTConnector,
    SyntheticUdyamConnector,
    SyntheticPANConnector,
    SyntheticDebarmentConnector
)

gst_connector = SyntheticGSTConnector()
udyam_connector = SyntheticUdyamConnector()
pan_connector = SyntheticPANConnector()
debarment_connector = SyntheticDebarmentConnector()

def evaluate_bidder_compliance(
    tender_number: str,
    bidder_legal_name: str,
    archetype: str,
    pan: str,
    gstin: str,
    udyam_number: str,
    requirements: List[Dict[str, Any]],
    submitted_documents: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], float, str]:
    """
    Deterministic rules engine (plain Python, rules-as-data).
    Evaluates PASS / FAIL / MISSING / MISMATCH / MANUAL_REVIEW per requirement.
    Returns: (verification_results, compliance_score_pct, overall_risk_level)
    """
    doc_map = {doc["document_type"]: doc for doc in submitted_documents}
    results = []
    total_mandatory = 0
    passed_mandatory = 0
    has_hard_fail = False
    has_manual_review = False

    for req in requirements:
        code = req["code"]
        mandatory = req["mandatory"]
        if mandatory:
            total_mandatory += 1

        status = "PASS"
        source_type = "synthetic"
        evidence_text = ""
        raw_source_data = {}
        failure_reason = ""

        # Requirement-specific deterministic rule logic
        if code == "REQ-PAN-01":
            doc = doc_map.get("PAN")
            if not doc:
                status = "MISSING" if mandatory else "PASS"
                failure_reason = "Mandatory PAN card document missing from submission."
            else:
                verify_res = pan_connector.verify({"pan": pan, "legal_name": bidder_legal_name})
                raw_source_data = verify_res
                source_type = verify_res["source_type"]
                if verify_res["status"] == "MISMATCH":
                    status = "MISMATCH"
                    failure_reason = f"PAN verification response legal name ('{verify_res['registered_legal_name']}') does not match bidder's registered legal name ('{bidder_legal_name}')."
                elif verify_res["verified"]:
                    status = "PASS"
                    evidence_text = f"PAN {pan} verified matching '{bidder_legal_name}' on Income Tax database."
                else:
                    status = "FAIL"
                    failure_reason = verify_res["details"]

        elif code in ["REQ-GST-01"]:
            doc = doc_map.get("GST_CERTIFICATE")
            if not doc:
                status = "MISSING" if mandatory else "PASS"
                failure_reason = "Mandatory GST Registration certificate missing from submission."
            else:
                verify_res = gst_connector.verify({"gstin": gstin, "legal_name": bidder_legal_name})
                raw_source_data = verify_res
                source_type = verify_res["source_type"]
                if verify_res["status"] == "MISMATCH":
                    status = "MISMATCH"
                    failure_reason = f"GST verification response legal name ('{verify_res['registry_legal_name']}') does not match bidder's registered legal name ('{bidder_legal_name}')."
                elif verify_res["status"] == "INACTIVE":
                    status = "FAIL"
                    failure_reason = f"GSTIN status is '{verify_res['filing_status']}' or active filing < 6 months."
                elif verify_res["verified"]:
                    status = "PASS"
                    evidence_text = f"GSTIN {gstin} active for {verify_res['active_months']} months, registered to '{bidder_legal_name}'."
                else:
                    status = "FAIL"
                    failure_reason = verify_res["details"]

        elif code in ["REQ-MSME-UDYAM-01", "REQ-UDYAM-01"]:
            doc = doc_map.get("UDYAM_CERTIFICATE")
            if not doc:
                if mandatory:
                    status = "MISSING"
                    failure_reason = "This tender mandates Udyam Registration; no Udyam certificate uploaded."
                else:
                    status = "PASS"
                    evidence_text = "Optional MSME preference not claimed (no Udyam cert provided)."
            else:
                verify_res = udyam_connector.verify({"udyam_number": udyam_number, "legal_name": bidder_legal_name})
                raw_source_data = verify_res
                source_type = verify_res["source_type"]
                if verify_res["status"] == "MISMATCH":
                    status = "MISMATCH"
                    failure_reason = f"Udyam registry response legal name ('{verify_res['registry_legal_name']}') does not match bidder's legal name ('{bidder_legal_name}')."
                elif verify_res["status"] == "CANCELLED":
                    status = "FAIL"
                    failure_reason = "Udyam registration shows status 'Cancelled' / 'Inactive' in registry."
                elif verify_res["verified"]:
                    status = "PASS"
                    evidence_text = f"Udyam registration {udyam_number} valid, category {verify_res['enterprise_category']}."
                else:
                    status = "FAIL"
                    failure_reason = verify_res["details"]

        elif code == "REQ-BIS-CERT-01":
            doc = doc_map.get("BIS_LICENSE")
            if not doc:
                status = "MISSING"
                failure_reason = "BIS License / ISI mark certificate missing."
            elif doc.get("flaw_injected") == "YES" or archetype == "Expired-cert":
                status = "FAIL"
                failure_reason = "BIS License for quoted safety gear expired prior to tender submission date."
            else:
                status = "PASS"
                evidence_text = "Valid BIS License IS/ISO 15291 on record, active validity."

        elif code == "REQ-OEM-AUTH-01":
            doc = doc_map.get("OEM_AUTH_LETTER")
            if not doc or doc.get("flaw_injected") == "MISSING" or archetype == "Missing-doc":
                status = "MISSING"
                failure_reason = "Mandatory OEM Authorization Letter not submitted by dealer bidder."
            else:
                status = "PASS"
                evidence_text = "OEM Authorization Letter submitted and verified with OEM seal."

        elif code in ["REQ-EPFO-ESIC-01"]:
            doc = doc_map.get("EPFO_ESI_CERT")
            if not doc or archetype == "Missing-doc":
                status = "MISSING"
                failure_reason = "Mandatory EPFO & ESIC registration certificate missing."
            elif archetype == "Expired-cert":
                status = "FAIL"
                failure_reason = "ESIC registration status is Inactive / Lapsed as of tender submission date."
            else:
                status = "PASS"
                evidence_text = "EPFO & ESIC registration active and validated against EPFO portal."

        elif code == "REQ-MANPOWER-01":
            doc = doc_map.get("MANPOWER_LIST")
            if not doc:
                status = "MISSING"
                failure_reason = "Technical Manpower deployment list missing."
            elif archetype == "Borderline":
                status = "MANUAL_REVIEW"
                evidence_text = "Deployment plan submits 5 certified technicians vs 6 required; 2 pending certification."
                failure_reason = "Shortfall of 1 technician resolvable during mobilisation window. Officer review required."
            else:
                status = "PASS"
                evidence_text = "Qualified technical manpower deployment plan verified with certs."

        elif code in ["REQ-TURNOVER-01", "REQ-TURNOVER-RELAXED-01"]:
            doc = doc_map.get("FINANCIAL_STATEMENT")
            if not doc:
                status = "MISSING"
                failure_reason = "Financial Statement / Audited Turnover statement missing."
            elif archetype == "Borderline":
                status = "MANUAL_REVIEW"
                evidence_text = "Average 3-year turnover evaluated near threshold boundary with unaudited/self-certified FY."
                failure_reason = "Turnover value sits within 1% of required threshold; unaudited FY requires officer validation."
            else:
                status = "PASS"
                evidence_text = "Audited financial statements confirm average annual turnover meets threshold."

        elif code in ["REQ-DEBAR-01"]:
            verify_res = debarment_connector.verify({"legal_name": bidder_legal_name})
            raw_source_data = verify_res
            source_type = verify_res["source_type"]
            if not verify_res["verified"]:
                status = "FAIL"
                failure_reason = verify_res["details"]
            else:
                status = "PASS"
                evidence_text = "Self-declaration confirmed against MoPNG / GeM Central Debarment Portal."

        else:
            # Generic document check for remaining requirements (MII, EMD, EXPERIENCE, SLA, QUALITY, etc.)
            expected_doc_type = {
                "REQ-MII-01": "MII_DECLARATION",
                "REQ-EMD-01": "EMD_INSTRUMENT",
                "REQ-EXP-01": "EXPERIENCE_CERT",
                "REQ-EXP-AMC-01": "EXPERIENCE_CERT",
                "REQ-SLA-01": "SLA_ACCEPTANCE",
                "REQ-MSE-CATEGORY-01": "UDYAM_CERTIFICATE",
                "REQ-EMD-EXEMPT-01": "UDYAM_CERTIFICATE",
                "REQ-L1-PREFERENCE-01": "UDYAM_CERTIFICATE",
                "REQ-EXP-RELAXED-01": "EXPERIENCE_CERT",
                "REQ-QUALITY-CERT-01": "QUALITY_CERT"
            }.get(code)

            if expected_doc_type and expected_doc_type in doc_map:
                status = "PASS"
                evidence_text = f"Valid document '{expected_doc_type}' uploaded for requirement '{code}'."
            else:
                if mandatory:
                    status = "MISSING"
                    failure_reason = f"Mandatory document for requirement '{code}' was not found in submission."
                else:
                    status = "PASS"
                    evidence_text = f"Optional requirement '{code}' - default pass."

        # Aggregate counts
        if status == "PASS":
            if mandatory:
                passed_mandatory += 1
        elif status in ["FAIL", "MISSING", "MISMATCH"]:
            has_hard_fail = True
        elif status == "MANUAL_REVIEW":
            has_manual_review = True

        results.append({
            "requirement_code": code,
            "mandatory": mandatory,
            "status": status,
            "source_type": source_type,
            "evidence_text": evidence_text,
            "raw_source_data": str(raw_source_data),
            "failure_reason": failure_reason
        })

    compliance_score = round((passed_mandatory / total_mandatory * 100.0) if total_mandatory > 0 else 100.0, 1)

    if has_hard_fail:
        risk_level = "High"
    elif has_manual_review:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return results, compliance_score, risk_level

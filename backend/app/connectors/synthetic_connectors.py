from typing import Dict, Any
from app.connectors.base import VerificationConnector

class SyntheticGSTConnector(VerificationConnector):
    source_name = "GSTN Registry API"
    source_type = "synthetic"

    def verify(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        gstin = query_params.get("gstin", "")
        bidder_legal_name = query_params.get("legal_name", "")

        # Database of known synthetic GST records matching the synthetic dataset
        mock_registry = {
            "33AABCS1234C1Z5": {"legal_name": "Suryodaya Safety Systems Pvt Ltd", "status": "Active", "filing_active_months": 12, "registration_date": "2018-04-15"},
            "33AAJCV5678D1Z2": {"legal_name": "Vendhar Fire Solutions", "status": "Active", "filing_active_months": 24, "registration_date": "2019-01-10"},
            "33AACFK9012E1Z8": {"legal_name": "Kaveri PPE Distributors", "status": "Active", "filing_active_months": 18, "registration_date": "2020-05-20"}, # Mismatch: Kaveri PPE Distributors vs Traders
            "33AAECA3456F1Z4": {"legal_name": "Anbu Safety Equipments", "status": "Active", "filing_active_months": 8, "registration_date": "2021-11-01"},
            "33AAFCT7890G1Z1": {"legal_name": "Thiruvalluvar Industrial Supplies", "status": "Active", "filing_active_months": 36, "registration_date": "2017-08-12"},
            "33AABCN2345H1Z7": {"legal_name": "Nandhi Engineering Services", "status": "Active", "filing_active_months": 48, "registration_date": "2016-03-01"},
            "33AAKFS6789J1Z3": {"legal_name": "SPK Facility Management", "status": "Active", "filing_active_months": 14, "registration_date": "2020-01-15"},
            "33AALFM0123K1Z9": {"legal_name": "Muruga Technical Services", "status": "Active", "filing_active_months": 30, "registration_date": "2018-09-09"},
            "33AAMCC4567L1Z6": {"legal_name": "Coromandel Plant Services", "status": "Active", "filing_active_months": 20, "registration_date": "2019-06-30"},
            "33AANCV8901M1Z2": {"legal_name": "Vetri Maintenance Co", "status": "Active", "filing_active_months": 15, "registration_date": "2021-02-14"},
            "33AAOFA1234N1Z8": {"legal_name": "Amman Furniture Works", "status": "Active", "filing_active_months": 60, "registration_date": "2015-10-10"},
            "33AAPFS5678P1Z4": {"legal_name": "Sri Balaji Stationery Mart", "status": "Active", "filing_active_months": 12, "registration_date": "2022-04-01"},
            "33AAQFL9012Q1Z0": {"legal_name": "Lakshmi Office Interiors", "status": "Active", "filing_active_months": 24, "registration_date": "2019-12-12"},
            "33AARFD3456R1Z5": {"legal_name": "Devi Furniture Fabricators", "status": "Active", "filing_active_months": 18, "registration_date": "2020-07-07"},
            "33AASFG7890S1Z1": {"legal_name": "Ganesh Traders & Suppliers", "status": "Active", "filing_active_months": 9, "registration_date": "2022-01-20"}
        }

        record = mock_registry.get(gstin)
        if not record:
            return {
                "verified": False,
                "status": "NOT_FOUND",
                "source_type": self.source_type,
                "source_name": self.source_name,
                "details": f"GSTIN {gstin} not found in GSTN database."
            }

        name_match = (record["legal_name"].strip().lower() == bidder_legal_name.strip().lower())
        status_active = (record["status"] == "Active" and record["filing_active_months"] >= 6)

        return {
            "verified": name_match and status_active,
            "status": "VERIFIED" if (name_match and status_active) else ("MISMATCH" if not name_match else "INACTIVE"),
            "source_type": self.source_type,
            "source_name": self.source_name,
            "registry_legal_name": record["legal_name"],
            "filing_status": record["status"],
            "active_months": record["filing_active_months"],
            "name_matched": name_match,
            "details": f"Registry Name: '{record['legal_name']}', Filing Status: '{record['status']}' ({record['filing_active_months']} mos active)"
        }

class SyntheticUdyamConnector(VerificationConnector):
    source_name = "Udyam Enterprise Registry API"
    source_type = "synthetic"

    def verify(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        udyam_number = query_params.get("udyam_number", "")
        bidder_legal_name = query_params.get("legal_name", "")

        mock_registry = {
            "UDYAM-TN-03-0012345": {"legal_name": "Suryodaya Safety Systems Pvt Ltd", "category": "Small", "status": "Active"},
            "UDYAM-TN-05-0034567": {"legal_name": "Amman Furniture Works", "category": "Micro", "status": "Active"},
            "UDYAM-TN-07-0045678": {"legal_name": "Lakshmi Modular Interiors", "category": "Small", "status": "Active"}, # Mismatch
            "UDYAM-TN-02-0056789": {"legal_name": "Devi Furniture Fabricators", "category": "Micro", "status": "Cancelled"}, # Expired / Cancelled
            "UDYAM-TN-09-0067890": {"legal_name": "Ganesh Traders & Suppliers", "category": "Micro", "status": "Active"}
        }

        record = mock_registry.get(udyam_number)
        if not record:
            return {
                "verified": False,
                "status": "NOT_FOUND",
                "source_type": self.source_type,
                "source_name": self.source_name,
                "details": f"Udyam registration {udyam_number} not found in MSME Udyam database."
            }

        name_match = (record["legal_name"].strip().lower() == bidder_legal_name.strip().lower())
        active = (record["status"] == "Active")

        return {
            "verified": name_match and active,
            "status": "VERIFIED" if (name_match and active) else ("MISMATCH" if not name_match else "CANCELLED"),
            "source_type": self.source_type,
            "source_name": self.source_name,
            "registry_legal_name": record["legal_name"],
            "enterprise_category": record["category"],
            "registration_status": record["status"],
            "name_matched": name_match,
            "details": f"Registry Entity: '{record['legal_name']}', Category: {record['category']}, Status: {record['status']}"
        }

class SyntheticPANConnector(VerificationConnector):
    source_name = "Income Tax PAN Verification API"
    source_type = "synthetic"

    def verify(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        pan = query_params.get("pan", "")
        bidder_legal_name = query_params.get("legal_name", "")

        mock_registry = {
            "AABCS1234C": "Suryodaya Safety Systems Pvt Ltd",
            "AAJCV5678D": "Vendhar Fire Solutions",
            "AACFK9012E": "Kaveri PPE Traders",
            "AAECA3456F": "Anbu Safety Equipments",
            "AAFCT7890G": "Thiruvalluvar Industrial Supplies",
            "AABCN2345H": "Nandhi Engineering Services",
            "AAKFS6789J": "SPK Facility Management",
            "AALFM0123K": "Muruga Technical Solutions Pvt Ltd", # Mismatch vs Muruga Technical Services
            "AAMCC4567L": "Coromandel Plant Services",
            "AANCV8901M": "Vetri Maintenance Co",
            "AAOFA1234N": "Amman Furniture Works",
            "AAPFS5678P": "Sri Balaji Stationery Mart",
            "AAQFL9012Q": "Lakshmi Office Interiors",
            "AARFD3456R": "Devi Furniture Fabricators",
            "AASFG7890S": "Ganesh Traders & Suppliers"
        }

        registered_name = mock_registry.get(pan)
        if not registered_name:
            return {
                "verified": False,
                "status": "NOT_FOUND",
                "source_type": self.source_type,
                "source_name": self.source_name,
                "details": f"PAN {pan} not found in Income Tax database."
            }

        name_match = (registered_name.strip().lower() == bidder_legal_name.strip().lower())
        return {
            "verified": name_match,
            "status": "VERIFIED" if name_match else "MISMATCH",
            "source_type": self.source_type,
            "source_name": self.source_name,
            "registered_legal_name": registered_name,
            "name_matched": name_match,
            "details": f"PAN Owner Legal Name: '{registered_name}'"
        }

class SyntheticDebarmentConnector(VerificationConnector):
    source_name = "MoPNG / GeM Central Debarment List"
    source_type = "synthetic"

    def verify(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        legal_name = query_params.get("legal_name", "")
        # Blacklist check
        blacklisted_entities = ["Blacklisted Supplies Corp", "Banned Equipment Pvt Ltd"]
        is_debarred = any(b.lower() in legal_name.lower() for b in blacklisted_entities)

        return {
            "verified": not is_debarred,
            "status": "CLEAN" if not is_debarred else "DEBARRED",
            "source_type": self.source_type,
            "source_name": self.source_name,
            "details": "No active debarment or blacklisting records found on GeM/MoPNG portal." if not is_debarred else "CRITICAL: Entity is listed on Central Debarment Portal!"
        }

import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import User, Tender, Bidder, Document, DocumentAccessLog, TokenBlacklist

client = TestClient(app)

class TestDocumentAccessControl(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        
        # Helper to get access token for a user
        def get_token(email, password="Password123!"):
            res = client.post("/api/auth/token", data={"username": email, "password": password})
            if res.status_code == 200:
                return res.json()["access_token"]
            raise Exception(f"Failed to obtain token for {email}: {res.text}")

        cls.admin_token = get_token("admin@codeveil.gov.in")
        cls.officer1_token = get_token("officer@cpcl.gov.in")
        cls.officer2_token = get_token("officer2@cpcl.gov.in")
        cls.auditor_token = get_token("auditor@cag.gov.in")

        # Find a document in Tender 1 (assigned to officer1)
        tender1 = cls.db.query(Tender).filter(Tender.assigned_officer_id != None).first()
        bidder1 = cls.db.query(Bidder).filter(Bidder.tender_id == tender1.id).first()
        cls.doc1 = cls.db.query(Document).filter(Document.bidder_id == bidder1.id).first()
        cls.tender1 = tender1

        # Find a document in a tender assigned to officer2
        tender2 = cls.db.query(Tender).filter(Tender.id != tender1.id).first()
        bidder2 = cls.db.query(Bidder).filter(Bidder.tender_id == tender2.id).first()
        cls.doc2 = cls.db.query(Document).filter(Document.bidder_id == bidder2.id).first()
        cls.tender2 = tender2

        print(f"\n==================================================================")
        print(f"CONFIDENTIAL DOCUMENT ACCESS SECURITY SUITE INITIALIZED")
        print(f"Tender 1 (ID: {cls.tender1.id}, Officer: officer@cpcl.gov.in), Doc ID: {cls.doc1.id} ({cls.doc1.doc_uuid})")
        print(f"Tender 2 (ID: {cls.tender2.id}, Officer: officer2@cpcl.gov.in), Doc ID: {cls.doc2.id} ({cls.doc2.doc_uuid})")
        print(f"==================================================================\n")

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_1_officer_cross_tender_access_rejected(self):
        """
        SCENARIO 1: An officer assigned to Tender 2 attempts to fetch a document from Tender 1 -> Rejected (403).
        Officer 1 (assigned to Tender 1) fetching Tender 1 document -> Allowed (200).
        """
        print("[TEST 1] Testing Officer Cross-Tender Scope Restrictions...")
        
        # Officer 2 (unassigned to Tender 1) attempts access
        headers_off2 = {"Authorization": f"Bearer {self.officer2_token}"}
        res = client.get(f"/api/documents/{self.doc1.id}/content", headers=headers_off2)
        self.assertEqual(res.status_code, 403, f"Expected 403 Forbidden, got {res.status_code}: {res.text}")
        self.assertIn("Access denied", res.json()["detail"])
        print("  [OK] Officer 2 denied access to unassigned Tender 1 document (403 Forbidden).")

        # Officer 1 (assigned to Tender 1) attempts access
        headers_off1 = {"Authorization": f"Bearer {self.officer1_token}"}
        res_ok = client.get(f"/api/documents/{self.doc1.id}/content", headers=headers_off1)
        self.assertEqual(res_ok.status_code, 200, f"Expected 200 OK, got {res_ok.status_code}: {res_ok.text}")
        print("  [OK] Officer 1 allowed access to assigned Tender 1 document (200 OK).")

    def test_2_auditor_download_restricted(self):
        """
        SCENARIO 2: A Viewer/Auditor attempts binary PDF download -> Rejected (403).
        Viewer/Auditor inline metadata/viewing -> Allowed (200).
        """
        print("[TEST 2] Testing Viewer/Auditor Role Download Restrictions...")

        headers_auditor = {"Authorization": f"Bearer {self.auditor_token}"}
        
        # Attempt raw download
        res_dl = client.get(f"/api/documents/{self.doc1.id}/download", headers=headers_auditor)
        self.assertEqual(res_dl.status_code, 403, f"Expected 403 Forbidden for Auditor download, got {res_dl.status_code}")
        self.assertIn("Viewer/Auditor role is not authorized to download raw binary PDF files", res_dl.json()["detail"])
        print("  [OK] Viewer/Auditor prohibited from binary PDF download (403 Forbidden).")

        # Attempt metadata view
        res_meta = client.get(f"/api/documents/{self.doc1.id}/meta", headers=headers_auditor)
        self.assertEqual(res_meta.status_code, 200, f"Expected 200 OK for Auditor metadata view, got {res_meta.status_code}")
        print("  [OK] Viewer/Auditor allowed inline metadata viewing (200 OK).")

    def test_3_static_direct_url_bypassing_api_fails(self):
        """
        SCENARIO 3: Accessing files directly via static URLs bypassing auth -> Fails (404).
        """
        print("[TEST 3] Testing Direct/Static File Path Bypass...")

        # Attempt to access upload directory directly
        res = client.get("/uploads/bidders/1/PAN.pdf")
        self.assertEqual(res.status_code, 404, "Static upload access should return 404 Not Found.")
        
        res_synthetic = client.get("/synthetic_documents/PAN.pdf")
        self.assertEqual(res_synthetic.status_code, 404, "Static synthetic document path access should return 404 Not Found.")
        print("  [OK] Direct static file URL access blocked and returns 404 Not Found.")

    def test_4_access_log_records_allowed_and_denied(self):
        """
        SCENARIO 4: DocumentAccessLog correctly records both ALLOWED and DENIED attempts with full details.
        """
        print("[TEST 4] Testing Access Audit Log Accuracy...")

        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        res = client.get("/api/audit/document-access-logs", headers=headers_admin)
        self.assertEqual(res.status_code, 200)
        logs = res.json()

        # Search for ALLOWED and DENIED entries
        allowed_entries = [l for l in logs if l.get("status") == "ALLOWED"]
        denied_entries = [l for l in logs if l.get("status") == "DENIED"]

        self.assertGreater(len(allowed_entries), 0, "Access log must record ALLOWED requests.")
        self.assertGreater(len(denied_entries), 0, "Access log must record DENIED requests.")

        denied_sample = denied_entries[0]
        self.assertIsNotNone(denied_sample.get("user_email"))
        self.assertIsNotNone(denied_sample.get("denial_reason"))
        self.assertIsNotNone(denied_sample.get("tender_id"))

        print(f"  [OK] Total Access Logs Evaluated: {len(logs)}")
        print(f"  [OK] ALLOWED log sample: User={allowed_entries[0]['user_email']}, DocID={allowed_entries[0]['document_id']}")
        print(f"  [OK] DENIED log sample: User={denied_sample['user_email']}, Reason='{denied_sample['denial_reason']}'")

    def test_5_logout_and_blacklisted_token_rejected(self):
        """
        SCENARIO 5: Logged-out token request to a document endpoint -> Rejected (401).
        """
        print("[TEST 5] Testing Session Invalidation & Token Blacklist...")

        # Create temporary user token to log out
        temp_token = client.post("/api/auth/token", data={"username": "officer@cpcl.gov.in", "password": "Password123!"}).json()["access_token"]
        headers_temp = {"Authorization": f"Bearer {temp_token}"}

        # Verify token works prior to logout
        res_before = client.get(f"/api/documents/{self.doc1.id}/meta", headers=headers_temp)
        self.assertEqual(res_before.status_code, 200)

        # Logout token
        res_logout = client.post("/api/auth/logout", headers=headers_temp)
        self.assertEqual(res_logout.status_code, 200)
        self.assertIn("Token invalidated", res_logout.json()["message"])

        # Attempt to replay token after logout
        res_after = client.get(f"/api/documents/{self.doc1.id}/meta", headers=headers_temp)
        self.assertEqual(res_after.status_code, 401, f"Expected 401 Unauthorized for blacklisted token, got {res_after.status_code}")
        print("  [OK] Logged-out token successfully blacklisted and rejected (401 Unauthorized).")

    def test_6_temporary_signed_url(self):
        """
        SCENARIO 6: Temporary signed viewing link generation & access.
        """
        print("[TEST 6] Testing Signed Expiring Temporary Links...")

        headers_off1 = {"Authorization": f"Bearer {self.officer1_token}"}
        res_signed = client.get(f"/api/documents/{self.doc1.id}/signed-url", headers=headers_off1)
        self.assertEqual(res_signed.status_code, 200)
        temp_token = res_signed.json()["temp_token"]
        self.assertIsNotNone(temp_token)

        # Access with signed token
        res_view = client.get(f"/api/documents/signed-view?token={temp_token}")
        self.assertEqual(res_view.status_code, 200)
        # Content can be binary PDF (%PDF-...) or text fallback
        is_pdf = res_view.content.startswith(b"%PDF")
        is_text = "SYNTHETIC DEMONSTRATION DOCUMENT" in res_view.text
        self.assertTrue(is_pdf or is_text, "Signed view output should be either PDF file binary or synthetic text payload.")
        print("  [OK] Temporary signed link validated and content streamed successfully.")

if __name__ == "__main__":
    unittest.main()

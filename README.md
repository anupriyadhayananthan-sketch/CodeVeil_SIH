# CodeVeil — Master Platform Setup & Documentation

**AI-Powered Integrated Bid Compliance Verification & Decision-Support Platform for GeM Procurement**  
*Built for Smart India Hackathon 2026 — Problem Statement SIH26100*  
*Sponsor: Ministry of Petroleum & Natural Gas / Chennai Petroleum Corporation Limited (CPCL)*

---

## 🛡️ Executive Summary & Non-Negotiable Core Principles

1. **Decision Support Tool, NOT Auto-Disqualification**: The Procurement Officer always makes the final call. Every output is explainable, evidence-linked, and backed by a deterministic verdict reason.
2. **Deterministic Rules Engine**: PASS / FAIL / MISSING / MISMATCH / MANUAL_REVIEW verdicts are computed strictly by plain Python rules-as-data. The LLM is restricted solely to document field extraction and clause parsing.
3. **Explicit Source Labeling**: Every verification check throughout the UI and API responses carries a mandatory `source_type` tag (`official` | `licensed_sandbox` | `synthetic`).
4. **Bidder Document Confidentiality Shield**: Uploaded bidder compliance documents are strictly isolated per tender assignment. Requests are checked server-side for RBAC permissions on every call (IDOR prevention), and every view/download is logged to an immutable `DocumentAccessLog`.
5. **Tamper-Evident Audit Trail**: Every verification run and officer action writes an append-only audit log entry protected by a SHA-256 hash-chain (`current_hash = SHA256(prev_hash + entry_data)`).

---

## 🚀 5-Stage Domain Architecture

```
┌───────────────────────────┐     ┌───────────────────────────┐
│ 1. Tender & Bidder        │ ──> │ 2. Document AI            │
│    Ingestion              │     │    Pipeline               │
└───────────────────────────┘     └───────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│ 4. Risk & Collusion       │ <── │ 3. Verification & Rules   │
│    Intelligence           │     │    Engine (Deterministic) │
└───────────────────────────┘     └───────────────────────────┘
              │
              ▼
┌───────────────────────────┐
│ 5. Officer Dashboard      │
│    & Hash-Chain Audit     │
└───────────────────────────┘
```

1. **Tender & Bidder Ingestion**: Ingests tender PDFs and parses bidder document sets.
2. **Document AI Pipeline**: Structured key-field extraction (PAN, GSTIN, Udyam, dates, turnover, experience) from submitted PDFs.
3. **Verification & Rules Engine**: Pluggable connectors for GST, Udyam, PAN, Debarment, and DigiLocker; evaluates deterministic rules per clause requirement.
4. **Risk & Collusion Intelligence**: Coefficient-of-Variation (CoV < 1.5%) bid-rigging screen, NetworkX graph shell-company detector, and scikit-learn ML risk model.
5. **Officer Dashboard & Audit Trail**: Evidence matrix, side-by-side snippet viewer, officer qualification workflow with mandatory comments, printable PDF report export, and SHA-256 hash-chain verification.

---

## 📊 Ground-Truth Accuracy & MANIFEST Benchmark

Run the automated ground-truth benchmark suite:
```bash
python backend/verify_accuracy.py
```

### Benchmark Results (Synthetic Test Suite):
- **Archetype Test Cases Evaluated**: 15 / 15
- **Exact Verdict Matches**: 15 / 15
- **Overall Accuracy**: **100.00%**
- **Precision**: **1.0000**
- **Recall**: **1.0000**
- **F1-Score**: **1.0000**

---

## 🔑 Demo Account Credentials & Roles

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Procurement Officer** | `officer@cpcl.gov.in` | `Password123!` | Upload tenders/bidders, inspect evidence matrix, record qualification decisions. |
| **System Admin** | `admin@codeveil.gov.in` | `Password123!` | Full user management, connector source configuration, document access audit logs, accuracy benchmark suite. |
| **Viewer / Auditor** | `auditor@cag.gov.in` | `Password123!` | Read-only access to matrices, collusion screens, audit trail, and compliance reports. |

---

## 💻 Technical Setup & Launch Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Install Backend Dependencies & Seed Database
```bash
cd backend
pip install -r requirements.txt
python seed.py
```

### 2. Build Frontend Static Bundle
```bash
cd frontend
npm install
npm run build
```

### 3. Launch Application Server
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open **http://127.0.0.1:8000** in your browser to access the complete CodeVeil platform.

---

## 🔒 Security & Confidentiality Verification

- **IDOR Protection**: Endpoint `GET /api/documents/{id}/content` checks JWT claims and user role before streaming content. Direct static folder exposure is disabled.
- **Access Audit Log**: Every document view generates an immutable record accessible in `Settings -> Document Access Log`.
- **Password Security**: Direct `bcrypt` password hashing with salt rounds.
- **Hash-Chain Verification**: Click "Verify Cryptographic Hash-Chain" on the Audit Trail screen to run real-time SHA-256 integrity verification.

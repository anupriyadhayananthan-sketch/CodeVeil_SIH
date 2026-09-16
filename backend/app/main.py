import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.routers import (
    auth_router,
    users_router,
    tenders_router,
    bidders_router,
    documents_router,
    audit_router,
    collusion_router,
    accuracy_router
)

from app.captcha import log_captcha_startup_status

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Log CAPTCHA Provider configuration on startup
log_captcha_startup_status()

app = FastAPI(
    title="CodeVeil Platform API",
    description="AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement (SIH26100)",
    version="1.0.0"
)

# CORS allow-list — reads from CORS_ORIGINS env var (comma-separated) in production,
# falls back to localhost for local development.
_cors_env = os.environ.get("CORS_ORIGINS", "")
if _cors_env.strip():
    origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Generic exception handler to prevent leaking stack traces or internal paths to client
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    print(f"[Internal Error Log] {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Transaction logged safely."}
    )

# Include API Routers
app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(tenders_router.router)
app.include_router(bidders_router.router)
app.include_router(documents_router.router)
app.include_router(audit_router.router)
app.include_router(collusion_router.router)
app.include_router(accuracy_router.router)

# Mount React production static dist directory if present
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist_dir = os.path.join(os.path.dirname(base_dir), "frontend", "dist")

if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path.startswith("synthetic_documents"):
            return JSONResponse(status_code=404, content={"detail": "Route or file path not found."})
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "platform": "CodeVeil",
            "problem_statement": "SIH26100 - AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement",
            "sponsor": "Ministry of Petroleum & Natural Gas / CPCL",
            "status": "ONLINE"
        }

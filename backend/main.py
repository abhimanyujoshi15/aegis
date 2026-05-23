import os
import shutil
import hashlib
import secrets
import sqlite3
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import tempfile

from parser import parse_ufdr
from search_engine import run_deterministic_nlp, run_semantic_llm

app = FastAPI(title="Aegis UFDR Analytics API", version="1.0.0")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all origins during local investigation
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).with_name("aegis_auth.db")
SESSIONS = {}
ACTIVE_CASES = {}

def init_auth_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS investigators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

def hash_password(password: str, salt: Optional[str] = None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"{salt}${digest}"

def verify_password(password: str, stored_hash: str):
    try:
        salt, digest = stored_hash.split("$", 1)
    except ValueError:
        return False
    return secrets.compare_digest(hash_password(password, salt).split("$", 1)[1], digest)

def public_user(row):
    return {"id": row[0], "name": row[1], "email": row[2]}

def require_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = authorization.split(" ", 1)[1].strip()
    user = SESSIONS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return user

@app.on_event("startup")
def startup():
    init_auth_db()

class SearchRequest(BaseModel):
    query: str
    domesticCode: Optional[str] = "91"
    apiKey: Optional[str] = ""
    model: Optional[str] = "gemini-3.5-flash"

class AuthRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""

@app.post("/api/register")
def register_investigator(payload: AuthRequest):
    init_auth_db()
    email = payload.email.strip().lower()
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Investigator name is required.")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                "INSERT INTO investigators (name, email, password_hash) VALUES (?, ?, ?)",
                (name, email, hash_password(payload.password)),
            )
            user = {"id": cur.lastrowid, "name": name, "email": email}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An investigator account already exists for this email.")

    token = secrets.token_urlsafe(32)
    SESSIONS[token] = user
    return {"token": token, "user": user}

@app.post("/api/login")
def login_investigator(payload: AuthRequest):
    init_auth_db()
    email = payload.email.strip().lower()
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT id, name, email, password_hash FROM investigators WHERE email = ?",
            (email,),
        ).fetchone()
    if not row or not verify_password(payload.password, row[3]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = public_user(row)
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = user
    return {"token": token, "user": user}

@app.get("/api/me")
def read_current_user(user=Depends(require_user)):
    case_data = ACTIVE_CASES.get(user["id"])
    return {
        "user": user,
        "has_active_case": bool(case_data),
        "case_data": case_data,
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "active_sessions": len(SESSIONS), "active_cases": len(ACTIVE_CASES)}

@app.post("/api/upload")
async def upload_ufdr(file: UploadFile = File(...), user=Depends(require_user)):
    """
    Receives an uploaded .ufdr or .xml, parses it, and populates the active case buffer.
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".ufdr", ".xml", ".zip"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a .ufdr (ZIP) or .xml report.")
    
    # Save file to a secure temporary location
    temp_fd, temp_path = tempfile.mkstemp(suffix=file_ext)
    try:
        with os.fdopen(temp_fd, 'wb') as tmp:
            shutil.copyfileobj(file.file, tmp)
        
        # Parse using our parsing module
        parsed_data = parse_ufdr(temp_path)
        
        # Override case name/examiner with actual uploaded file metadata
        parsed_data["device_info"]["case_name"] = file.filename
        parsed_data["device_info"]["examiner"] = user["name"]
        
        ACTIVE_CASES[user["id"]] = parsed_data
        return {
            "message": "File parsed and imported successfully.",
            "case_data": parsed_data,
            "device_info": parsed_data["device_info"],
            "import_diagnostics": parsed_data.get("_diagnostics", {}),
            "stats": {
                "contacts": len(parsed_data.get("contacts", [])),
                "calls": len(parsed_data.get("calls", [])),
                "chats": len(parsed_data.get("chats", [])),
                "locations": len(parsed_data.get("locations", []))
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forensic parsing error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/search")
async def search_case(payload: SearchRequest, user=Depends(require_user)):
    """
    Searches the active database. Combines deterministic extraction (regex, international codes)
    and optional semantic Gemini LLM generation.
    """
    active_case_data = ACTIVE_CASES.get(user["id"])
    if not active_case_data:
        raise HTTPException(status_code=400, detail="No active forensic report loaded. Please upload a UFDR first.")
    
    # Execute deterministic parser
    deterministic_results = run_deterministic_nlp(active_case_data, payload.query, payload.domesticCode)
    
    ai_analysis = ""
    # Execute Gemini API analysis if API key is provided
    if payload.apiKey and payload.apiKey.strip() != "":
        ai_analysis = await run_semantic_llm(active_case_data, payload.query, payload.apiKey.strip(), payload.model or "gemini-3.5-flash")
        
    return {
        "query": payload.query,
        "device_info": active_case_data["device_info"],
        "deterministic": deterministic_results,
        "local_analysis": deterministic_results.get("local_analysis", ""),
        "ai_analysis": ai_analysis
    }

@app.post("/api/report")
async def generate_report_metadata(flagged_ids: List[str] = Form(...), notes: str = Form(""), user=Depends(require_user)):
    """
    Receives indices/IDs of pinned evidence items and packages them into a clean report format.
    """
    active_case_data = ACTIVE_CASES.get(user["id"])
    if not active_case_data:
        raise HTTPException(status_code=400, detail="No active forensic case.")
        
    # Walk through active case records and gather items whose signatures or content matches flagged_ids
    flagged_evidence = []
    
    for c in active_case_data.get("chats", []):
        sig = f"chat-{c.get('timestamp')}-{c.get('sender')[:3]}"
        if sig in flagged_ids:
            flagged_evidence.append({"type": "Chat", "time": c.get("timestamp"), "party": f"{c.get('sender')} -> {c.get('recipient')}", "body": c.get("body")})
            
    for cl in active_case_data.get("calls", []):
        sig = f"call-{cl.get('timestamp')}-{cl.get('party')[:3]}"
        if sig in flagged_ids:
            flagged_evidence.append({"type": "Call", "time": cl.get("timestamp"), "party": cl.get("party"), "body": f"Direction: {cl.get('direction')} | Duration: {cl.get('duration')}"})
            
    for loc in active_case_data.get("locations", []):
        sig = f"loc-{loc.get('timestamp')}"
        if sig in flagged_ids:
            flagged_evidence.append({"type": "Location", "time": loc.get("timestamp"), "party": loc.get("source"), "body": f"Latitude: {loc.get('latitude')} | Longitude: {loc.get('longitude')}"})

    return {
        "device_info": active_case_data["device_info"],
        "notes": notes,
        "evidence": flagged_evidence
    }

if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port
    )
import os
import time
import uuid
import random
import logging
import urllib.request
import urllib.parse
import json
from typing import Dict, Tuple, Optional

logger = logging.getLogger("codeveil.captcha")

# Environment configuration
def get_captcha_provider() -> str:
    val = os.environ.get("CAPTCHA_PROVIDER", "").strip().lower()
    if not val:
        # Default to enabled (recaptcha if secret configured, otherwise local)
        if os.environ.get("RECAPTCHA_SECRET_KEY"):
            return "recaptcha"
        return "local"
    if val in ["recaptcha", "local", "disabled"]:
        return val
    return "local"

def log_captcha_startup_status():
    provider = get_captcha_provider()
    print("=" * 60)
    if provider == "disabled":
        print("WARNING: CAPTCHA is DISABLED")
        logger.warning("WARNING: CAPTCHA is DISABLED")
    elif provider == "recaptcha":
        site_key = os.environ.get("RECAPTCHA_SITE_KEY", "NOT_SET")
        print(f"CAPTCHA Provider initialized: Google reCAPTCHA v3 (SiteKey: {site_key[:8]}...)")
        logger.info(f"CAPTCHA Provider initialized: Google reCAPTCHA v3 (SiteKey: {site_key[:8]}...)")
    elif provider == "local":
        print("CAPTCHA Provider initialized: LOCAL (Math challenge engine)")
        logger.info("CAPTCHA Provider initialized: LOCAL (Math challenge engine)")
    print("=" * 60)

# Brute-force failure tracker
class FailedLoginTracker:
    def __init__(self, lockout_threshold: int = 2, time_window: int = 600):
        self.lockout_threshold = lockout_threshold
        self.time_window = time_window # 10 minutes
        # Key: (ip, email), Value: list of failure timestamps
        self._failures: Dict[Tuple[str, str], list] = {}

    def _clean_old(self, key: Tuple[str, str]):
        now = time.time()
        if key in self._failures:
            self._failures[key] = [t for t in self._failures[key] if now - t < self.time_window]
            if not self._failures[key]:
                del self._failures[key]

    def record_failure(self, ip: str, email: str):
        key = (ip, email.lower().strip() if email else "")
        self._clean_old(key)
        if key not in self._failures:
            self._failures[key] = []
        self._failures[key].append(time.time())

    def get_failure_count(self, ip: str, email: str) -> int:
        key = (ip, email.lower().strip() if email else "")
        self._clean_old(key)
        return len(self._failures.get(key, []))

    def is_captcha_required(self, ip: str, email: str) -> bool:
        provider = get_captcha_provider()
        if provider == "disabled":
            return False
        return self.get_failure_count(ip, email) >= self.lockout_threshold

    def reset_failures(self, ip: str, email: str):
        key = (ip, email.lower().strip() if email else "")
        if key in self._failures:
            del self._failures[key]

login_tracker = FailedLoginTracker(lockout_threshold=2)

# Local CAPTCHA challenge store
class LocalCaptchaStore:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        # Key: captcha_id, Value: {"answer": str, "expires_at": float, "used": bool}
        self._store: Dict[str, dict] = {}

    def _clean_expired(self):
        now = time.time()
        expired_ids = [cid for cid, data in self._store.items() if now > data["expires_at"] or data["used"]]
        for cid in expired_ids:
            del self._store[cid]

    def create_challenge(self) -> Tuple[str, str, str]:
        self._clean_expired()
        captcha_id = str(uuid.uuid4())
        
        # Simple accessible math challenge (a + b, a - b, a * b)
        ops = ['+', '-', '*']
        op = random.choice(ops)
        if op == '+':
            a = random.randint(1, 19)
            b = random.randint(1, 19)
            ans = a + b
        elif op == '-':
            a = random.randint(10, 25)
            b = random.randint(1, a)
            ans = a - b
        else: # '*'
            a = random.randint(2, 9)
            b = random.randint(2, 9)
            ans = a * b

        prompt = f"{a} {op} {b} = ?"
        answer_str = str(ans)
        expires_at = time.time() + self.ttl_seconds

        self._store[captcha_id] = {
            "answer": answer_str,
            "expires_at": expires_at,
            "used": False
        }

        # Generate a visually crisp dark-mode SVG image representation
        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <rect width="100%" height="100%" fill="#0f172a" rx="10"/>
  <path d="M 10 30 Q 50 10 90 30 T 170 30" fill="none" stroke="#334155" stroke-width="2" opacity="0.6"/>
  <circle cx="30" cy="15" r="2" fill="#6366f1" opacity="0.4"/>
  <circle cx="160" cy="45" r="3" fill="#38bdf8" opacity="0.4"/>
  <line x1="10" y1="48" x2="190" y2="48" stroke="#1e293b" stroke-width="2"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-family="monospace, sans-serif" font-size="22" font-weight="bold" letter-spacing="3">
    {a} {op} {b} = ?
  </text>
</svg>'''

        return captcha_id, prompt, svg_content

    def verify_and_invalidate(self, captcha_id: str, user_answer: str) -> bool:
        self._clean_expired()
        if not captcha_id or captcha_id not in self._store:
            return False

        data = self._store[captcha_id]
        
        # Single-use enforcement: immediately delete/mark used regardless of match!
        del self._store[captcha_id]

        if time.time() > data["expires_at"]:
            return False

        if not user_answer:
            return False

        return user_answer.strip() == data["answer"]

local_captcha_store = LocalCaptchaStore()

# Main verification routine
def verify_captcha_token(captcha_token: Optional[str], captcha_id: Optional[str] = None) -> bool:
    provider = get_captcha_provider()
    
    if provider == "disabled":
        return True

    if provider == "recaptcha":
        if not captcha_token:
            return False
        secret_key = os.environ.get("RECAPTCHA_SECRET_KEY", "")
        if not secret_key:
            # If secret key is not set, log warning and fall back to local validation if captcha_id is present
            logger.warning("RECAPTCHA_SECRET_KEY not set on backend. Falling back to local validation.")
            if captcha_id:
                return local_captcha_store.verify_and_invalidate(captcha_id, captcha_token)
            return False

        try:
            url = "https://www.google.com/recaptcha/api/siteverify"
            params = urllib.parse.urlencode({
                "secret": secret_key,
                "response": captcha_token
            }).encode('utf-8')
            
            req = urllib.request.Request(url, data=params, method="POST")
            with urllib.request.urlopen(req, timeout=5) as response:
                res_body = response.read().decode('utf-8')
                result = json.loads(res_body)

            success = result.get("success", False)
            score = result.get("score", 0.0)
            
            if success and score >= 0.5:
                return True
            else:
                logger.warning(f"Google reCAPTCHA verification failed. Success: {success}, Score: {score}")
                return False
        except Exception as e:
            logger.error(f"Error calling Google siteverify: {e}")
            return False

    if provider == "local":
        if not captcha_id or not captcha_token:
            return False
        return local_captcha_store.verify_and_invalidate(captcha_id, captcha_token)

    return False

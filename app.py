"""
JyotiYantra Backend — Connected to ThingsBoard
"""

import logging
import requests
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from functools import wraps

# ==============================
# CONFIG — FILLED WITH YOUR DATA
# ==============================

TB_BASE = "https://demo.thingsboard.io"

TB_USERNAME = "ay94994055@gmail.com"
TB_PASSWORD = "Ashutosh@thingsboard"

DEVICE_ID = "c0341b30-a2c6-11f0-a9b5-792e2194a5d4"

API_KEY = "mysecret123"

LOGIN_URL = f"{TB_BASE}/api/auth/login"
DATA_URL = f"{TB_BASE}/api/plugins/telemetry/DEVICE/{DEVICE_ID}/values/timeseries"

jwt_token = None

# ==============================
# Flask setup
# ==============================

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==============================
# API key protection
# ==============================

def api_key_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):

        key = request.headers.get("X-API-Key")

        if key != API_KEY:
            return jsonify({"error": "Invalid or missing API key"}), 401

        return f(*args, **kwargs)

    return wrapper

# ==============================
# ThingsBoard authentication
# ==============================

def get_token():
    global jwt_token

    try:
        r = requests.post(LOGIN_URL, json={
            "username": TB_USERNAME,
            "password": TB_PASSWORD
        })

        if r.status_code == 200:
            jwt_token = r.json()["token"]
            logger.info("✅ Connected to ThingsBoard")
            return jwt_token

        logger.error("❌ ThingsBoard login failed")
        return None

    except Exception as e:
        logger.error(f"Auth error: {e}")
        return None

# ==============================
# Serve dashboard
# ==============================

@app.route("/")
def dashboard():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)


# ==============================
# Health endpoint
# ==============================

@app.route("/health")
def health():
    return jsonify({
        "status": "running",
        "time": datetime.now(timezone.utc).isoformat()
    })

# ==============================
# Telemetry endpoint
# ==============================

@app.route("/api/data")
@api_key_required
def telemetry():

    token = jwt_token or get_token()

    if not token:
        return jsonify({"error": "ThingsBoard auth failed"}), 500

    headers = {
        "X-Authorization": f"Bearer {token}"
    }

    params = {
        "keys": "voltage,current,temperature",
        "limit": 10
    }

    r = requests.get(DATA_URL, headers=headers, params=params)

    if r.status_code == 401:
        token = get_token()
        headers["X-Authorization"] = f"Bearer {token}"
        r = requests.get(DATA_URL, headers=headers, params=params)

    if r.status_code != 200:
        return jsonify({"error": "Telemetry fetch failed"}), 500

    return jsonify(r.json())

# ==============================
# Error handlers
# ==============================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal(e):
    logger.error(e)
    return jsonify({"error": "Server error"}), 500

# ==============================
# Run server
# ==============================

if __name__ == "__main__":

    logger.info("🚀 JyotiYantra backend starting...")
    get_token()

    app.run(host="127.0.0.1", port=5500)

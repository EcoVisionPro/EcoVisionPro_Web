"""
JyotiYantra - Professional Renewable Energy Monitoring System Backend
Flask application for ingesting sensor data and interfacing with ThingsBoard
"""

import os
import json
import logging
import requests
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('jyotiyantra.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration from environment variables
THINGSBOARD_HOST = os.getenv('THINGSBOARD_HOST', 'localhost')
THINGSBOARD_PORT = os.getenv('THINGSBOARD_PORT', '8080')
THINGSBOARD_USERNAME = os.getenv('THINGSBOARD_USERNAME', 'tenant@thingsboard.org')
THINGSBOARD_PASSWORD = os.getenv('THINGSBOARD_PASSWORD', 'tenant')
DEVICE_ID = os.getenv('DEVICE_ID')
DEVICE_TOKEN = os.getenv('DEVICE_TOKEN')
API_KEY = os.getenv('API_KEY')
PANEL_AREA = float(os.getenv('PANEL_AREA', '1.5'))  # m²

# ThingsBoard URLs
THINGSBOARD_BASE = f"http://{THINGSBOARD_HOST}:{THINGSBOARD_PORT}"
TELEMETRY_URL = f"{THINGSBOARD_BASE}/api/v1/{DEVICE_TOKEN}/telemetry"
LOGIN_URL = f"{THINGSBOARD_BASE}/api/auth/login"
HISTORICAL_DATA_URL = f"{THINGSBOARD_BASE}/api/plugins/telemetry/DEVICE/{DEVICE_ID}/values/timeseries"

# Global variable to store JWT token
jwt_token = None

def api_key_required(f):
    """Decorator to require API key authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != API_KEY:
            logger.warning(f"Unauthorized access attempt from {request.remote_addr}")
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_jwt_token():
    """Authenticate with ThingsBoard and get JWT token"""
    global jwt_token
    try:
        auth_data = {
            'username': THINGSBOARD_USERNAME,
            'password': THINGSBOARD_PASSWORD
        }
        response = requests.post(LOGIN_URL, json=auth_data, timeout=10)

        if response.status_code == 200:
            jwt_token = response.json().get('token')
            logger.info("Successfully authenticated with ThingsBoard")
            return jwt_token
        else:
            logger.error(f"ThingsBoard authentication failed: {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to ThingsBoard for authentication: {e}")
        return None

def calculate_power_output(voltage, current):
    """Calculate power output from voltage and current"""
    try:
        return float(voltage) * float(current)
    except (ValueError, TypeError):
        return 0.0

def calculate_efficiency(voltage, current, irradiance):
    """Calculate solar panel efficiency"""
    try:
        power_output = float(voltage) * float(current)
        irradiance_val = float(irradiance)

        if irradiance_val <= 0 or PANEL_AREA <= 0:
            return 0.0

        efficiency = (power_output / (irradiance_val * PANEL_AREA)) * 100
        return round(efficiency, 2)
    except (ValueError, TypeError, ZeroDivisionError):
        return 0.0

def validate_sensor_data(data):
    """Validate incoming sensor data"""
    required_fields = ['voltage', 'current', 'irradiance', 'temperature', 'battery_voltage']

    if not isinstance(data, dict):
        return False, "Data must be a JSON object"

    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"

        try:
            float(data[field])
        except (ValueError, TypeError):
            return False, f"Invalid value for {field}: must be a number"

    return True, "Valid"

def forward_to_thingsboard(data):
    """Forward sensor data to ThingsBoard"""
    try:
        # Add timestamp if not present
        if 'timestamp' not in data:
            data['timestamp'] = datetime.now(timezone.utc).isoformat()

        response = requests.post(TELEMETRY_URL, json=data, timeout=10)

        if response.status_code == 200:
            logger.info("Successfully forwarded data to ThingsBoard")
            return True, "Data forwarded successfully"
        else:
            logger.error(f"ThingsBoard telemetry API error: {response.status_code}")
            return False, f"ThingsBoard API error: {response.status_code}"

    except requests.exceptions.RequestException as e:
        logger.error(f"Error forwarding data to ThingsBoard: {e}")
        return False, f"Connection error: {str(e)}"

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'JyotiYantra Backend',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'version': '1.0.0'
    })

@app.route('/ingest', methods=['POST'])
@api_key_required
def ingest_data():
    """Ingest sensor data and forward to ThingsBoard"""
    try:
        # Get JSON data from request
        sensor_data = request.get_json()

        if not sensor_data:
            return jsonify({'error': 'No JSON data provided'}), 400

        # Validate sensor data
        is_valid, message = validate_sensor_data(sensor_data)
        if not is_valid:
            logger.warning(f"Invalid sensor data: {message}")
            return jsonify({'error': message}), 400

        # Calculate derived values
        power_output = calculate_power_output(
            sensor_data['voltage'], 
            sensor_data['current']
        )

        efficiency = calculate_efficiency(
            sensor_data['voltage'], 
            sensor_data['current'], 
            sensor_data['irradiance']
        )

        # Prepare data for ThingsBoard
        thingsboard_data = {
            'timestamp': sensor_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'voltage': float(sensor_data['voltage']),
            'current': float(sensor_data['current']),
            'irradiance': float(sensor_data['irradiance']),
            'temperature': float(sensor_data['temperature']),
            'battery_voltage': float(sensor_data['battery_voltage']),
            'power_output': power_output,
            'efficiency': efficiency
        }

        # Forward to ThingsBoard
        success, forward_message = forward_to_thingsboard(thingsboard_data)

        if success:
            logger.info(f"Data ingested successfully: {thingsboard_data}")
            return jsonify({
                'status': 'success',
                'message': 'Data ingested and forwarded successfully',
                'data': thingsboard_data
            }), 200
        else:
            logger.error(f"Failed to forward data: {forward_message}")
            return jsonify({
                'status': 'partial_success',
                'message': 'Data processed but forwarding failed',
                'error': forward_message,
                'data': thingsboard_data
            }), 202

    except Exception as e:
        logger.error(f"Error in data ingestion: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/data', methods=['GET'])
@api_key_required
def get_telemetry_data():
    """Query historical telemetry data from ThingsBoard"""
    try:
        # Get or refresh JWT token
        token = jwt_token or get_jwt_token()
        if not token:
            return jsonify({'error': 'Failed to authenticate with ThingsBoard'}), 500

        # Prepare headers with JWT token
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        # Query parameters for last 20 records
        params = {
            'keys': 'voltage,current,irradiance,temperature,battery_voltage,power_output,efficiency',
            'startTs': int((datetime.now().timestamp() - 3600) * 1000),  # Last hour
            'endTs': int(datetime.now().timestamp() * 1000),
            'limit': 20,
            'agg': 'NONE'
        }

        # Make request to ThingsBoard
        response = requests.get(HISTORICAL_DATA_URL, headers=headers, params=params, timeout=10)

        if response.status_code == 401:
            # Token expired, try to refresh
            logger.info("JWT token expired, refreshing...")
            token = get_jwt_token()
            if not token:
                return jsonify({'error': 'Failed to refresh ThingsBoard authentication'}), 500

            headers['Authorization'] = f'Bearer {token}'
            response = requests.get(HISTORICAL_DATA_URL, headers=headers, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()

            # Process and structure the response
            structured_data = {
                'timestamps': [],
                'voltages': [],
                'currents': [],
                'irradiances': [],
                'temperatures': [],
                'battery_voltages': [],
                'power_outputs': [],
                'efficiencies': []
            }

            # Extract data from ThingsBoard response format
            for key, values in data.items():
                if key == 'voltage':
                    for item in values:
                        structured_data['voltages'].append(float(item['value']))
                        structured_data['timestamps'].append(item['ts'])
                elif key == 'current':
                    for item in values:
                        structured_data['currents'].append(float(item['value']))
                elif key == 'irradiance':
                    for item in values:
                        structured_data['irradiances'].append(float(item['value']))
                elif key == 'temperature':
                    for item in values:
                        structured_data['temperatures'].append(float(item['value']))
                elif key == 'battery_voltage':
                    for item in values:
                        structured_data['battery_voltages'].append(float(item['value']))
                elif key == 'power_output':
                    for item in values:
                        structured_data['power_outputs'].append(float(item['value']))
                elif key == 'efficiency':
                    for item in values:
                        structured_data['efficiencies'].append(float(item['value']))

            # Convert timestamps to readable format
            structured_data['timestamps'] = [
                datetime.fromtimestamp(ts/1000).strftime('%Y-%m-%d %H:%M:%S') 
                for ts in structured_data['timestamps']
            ]

            logger.info(f"Retrieved {len(structured_data['timestamps'])} telemetry records")
            return jsonify(structured_data), 200

        else:
            logger.error(f"ThingsBoard telemetry query failed: {response.status_code}")
            return jsonify({
                'error': f'Failed to retrieve data from ThingsBoard: {response.status_code}'
            }), 500

    except requests.exceptions.RequestException as e:
        logger.error(f"Error querying ThingsBoard: {e}")
        return jsonify({'error': 'Failed to connect to ThingsBoard'}), 500
    except Exception as e:
        logger.error(f"Error in data query: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/ws-token', methods=['GET'])
@api_key_required
def get_ws_token():
    """Provides a short-lived JWT token for the frontend WebSocket connection."""
    token = jwt_token or get_jwt_token()
    if token:
        return jsonify({'token': token})
    else:
        return jsonify({'error': 'Failed to get ThingsBoard token'}), 500
    
@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Check required environment variables
    required_vars = ['DEVICE_ID', 'DEVICE_TOKEN', 'API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        exit(1)

    logger.info("Starting JyotiYantra Backend Server...")
    logger.info(f"ThingsBoard Host: {THINGSBOARD_HOST}:{THINGSBOARD_PORT}")
    logger.info(f"Device ID: {DEVICE_ID}")
    logger.info(f"Panel Area: {PANEL_AREA} m²")

    # Initialize JWT token
    get_jwt_token()

    app.run(host='0.0.0.0', port=5000, debug=False)

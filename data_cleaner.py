"""
JyotiYantra Data Cleaner - Scheduled task to clean old telemetry data
"""

import os
import logging
import requests
import schedule
import time
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_cleaner.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
THINGSBOARD_HOST = os.getenv('THINGSBOARD_HOST', 'localhost')
THINGSBOARD_PORT = os.getenv('THINGSBOARD_PORT', '8080')
THINGSBOARD_USERNAME = os.getenv('THINGSBOARD_USERNAME', 'tenant@thingsboard.org')
THINGSBOARD_PASSWORD = os.getenv('THINGSBOARD_PASSWORD', 'tenant')
DEVICE_ID = os.getenv('DEVICE_ID')
DATA_RETENTION_DAYS = int(os.getenv('DATA_RETENTION_DAYS', '30'))

# ThingsBoard URLs
THINGSBOARD_BASE = f"http://{THINGSBOARD_HOST}:{THINGSBOARD_PORT}"
LOGIN_URL = f"{THINGSBOARD_BASE}/api/auth/login"
DELETE_TELEMETRY_URL = f"{THINGSBOARD_BASE}/api/plugins/telemetry/DEVICE/{DEVICE_ID}/timeseries/delete"

def get_jwt_token():
    """Authenticate with ThingsBoard and get JWT token"""
    try:
        auth_data = {
            'username': THINGSBOARD_USERNAME,
            'password': THINGSBOARD_PASSWORD
        }
        response = requests.post(LOGIN_URL, json=auth_data, timeout=10)

        if response.status_code == 200:
            token = response.json().get('token')
            logger.info("Successfully authenticated with ThingsBoard")
            return token
        else:
            logger.error(f"ThingsBoard authentication failed: {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to ThingsBoard for authentication: {e}")
        return None

def clean_old_data():
    """Clean telemetry data older than retention period"""
    try:
        logger.info("Starting data cleanup task...")

        # Get JWT token
        token = get_jwt_token()
        if not token:
            logger.error("Failed to authenticate with ThingsBoard")
            return

        # Calculate cutoff timestamp
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=DATA_RETENTION_DAYS)
        cutoff_timestamp = int(cutoff_date.timestamp() * 1000)

        # Prepare headers
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        # Prepare delete request
        delete_data = {
            'keys': 'voltage,current,irradiance,temperature,battery_voltage,power_output,efficiency',
            'deleteAllDataForKeys': False,
            'startTs': 0,
            'endTs': cutoff_timestamp
        }

        # Make delete request
        response = requests.delete(DELETE_TELEMETRY_URL, headers=headers, json=delete_data, timeout=30)

        if response.status_code == 200:
            logger.info(f"Successfully cleaned data older than {DATA_RETENTION_DAYS} days")
        else:
            logger.error(f"Failed to clean old data: {response.status_code}")

    except Exception as e:
        logger.error(f"Error during data cleanup: {str(e)}")

def main():
    """Main function to run the data cleaner"""
    logger.info("JyotiYantra Data Cleaner started")
    logger.info(f"Data retention period: {DATA_RETENTION_DAYS} days")

    # Schedule daily cleanup at 2 AM
    schedule.every().day.at("02:00").do(clean_old_data)

    # Run once immediately for testing
    # clean_old_data()

    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == '__main__':
    main()

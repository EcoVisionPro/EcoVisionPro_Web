# Create additional utility files

# Create a data cleaning script (bonus feature)
data_cleaner_content = '''"""
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
'''

# Save data cleaner script
with open('data_cleaner.py', 'w') as f:
    f.write(data_cleaner_content)

print("✅ Created data_cleaner.py")

# Create API documentation
api_docs_content = '''# JyotiYantra Backend API Documentation

## Overview
JyotiYantra is a professional renewable energy monitoring system backend built with Flask. It interfaces with ThingsBoard for IoT data management and provides RESTful APIs for data ingestion and querying.

## Base URL
```
http://localhost:5000
```

## Authentication
All API endpoints (except `/health`) require an API key in the request headers:
```
X-API-Key: your-api-key-here
```

## Endpoints

### 1. Health Check
**GET** `/health`

Check if the service is running.

**Response:**
```json
{
    "status": "healthy",
    "service": "JyotiYantra Backend",
    "timestamp": "2025-09-21T10:30:00Z",
    "version": "1.0.0"
}
```

### 2. Data Ingestion
**POST** `/ingest`

Ingest sensor data from IoT devices.

**Headers:**
```
Content-Type: application/json
X-API-Key: your-api-key-here
```

**Request Body:**
```json
{
    "timestamp": "2025-09-21T10:30:00Z",
    "voltage": 12.3,
    "current": 1.4,
    "irradiance": 850,
    "temperature": 30,
    "battery_voltage": 12.6
}
```

**Response (Success):**
```json
{
    "status": "success",
    "message": "Data ingested and forwarded successfully",
    "data": {
        "timestamp": "2025-09-21T10:30:00Z",
        "voltage": 12.3,
        "current": 1.4,
        "irradiance": 850,
        "temperature": 30,
        "battery_voltage": 12.6,
        "power_output": 17.22,
        "efficiency": 13.48
    }
}
```

### 3. Query Historical Data
**GET** `/api/data`

Retrieve the last 20 telemetry records.

**Headers:**
```
X-API-Key: your-api-key-here
```

**Response:**
```json
{
    "timestamps": ["2025-09-21 10:30:00", "2025-09-21 10:29:00", ...],
    "voltages": [12.3, 12.2, ...],
    "currents": [1.4, 1.3, ...],
    "irradiances": [850, 840, ...],
    "temperatures": [30, 29.5, ...],
    "battery_voltages": [12.6, 12.5, ...],
    "power_outputs": [17.22, 15.86, ...],
    "efficiencies": [13.48, 12.85, ...]
}
```

## Error Responses

### 400 Bad Request
```json
{
    "error": "Missing required field: voltage"
}
```

### 401 Unauthorized
```json
{
    "error": "Invalid or missing API key"
}
```

### 500 Internal Server Error
```json
{
    "error": "Internal server error"
}
```

## Data Validation

### Required Fields
- `voltage` (float): System voltage in volts
- `current` (float): Current flow in amperes
- `irradiance` (float): Solar irradiance in W/m²
- `temperature` (float): Ambient temperature in Celsius
- `battery_voltage` (float): Battery voltage in volts

### Calculated Fields
- `power_output`: Voltage × Current
- `efficiency`: (Power Output / (Irradiance × Panel Area)) × 100

## ESP32 Integration Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* serverURL = "http://your-server:5000/ingest";
const char* apiKey = "your-api-key-here";

void sendSensorData(float voltage, float current, float irradiance, float temperature, float batteryVoltage) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", apiKey);
    
    String jsonData = "{";
    jsonData += "\\"voltage\\":" + String(voltage) + ",";
    jsonData += "\\"current\\":" + String(current) + ",";
    jsonData += "\\"irradiance\\":" + String(irradiance) + ",";
    jsonData += "\\"temperature\\":" + String(temperature) + ",";
    jsonData += "\\"battery_voltage\\":" + String(batteryVoltage);
    jsonData += "}";
    
    int httpResponseCode = http.POST(jsonData);
    http.end();
}
```

## ThingsBoard Integration

The system automatically forwards data to ThingsBoard using:
- **Device Token**: For telemetry ingestion
- **REST API**: For historical data queries
- **JWT Authentication**: For secure API access

## Logging

All requests and errors are logged to:
- Console output
- `jyotiyantra.log` file

## Configuration

Environment variables in `.env`:
```env
THINGSBOARD_HOST=localhost
THINGSBOARD_PORT=8080
THINGSBOARD_USERNAME=tenant@thingsboard.org
THINGSBOARD_PASSWORD=tenant
DEVICE_ID=your-device-id
DEVICE_TOKEN=your-device-token
API_KEY=your-api-key
PANEL_AREA=1.5
```
'''

# Save API documentation
with open('API_DOCS.md', 'w') as f:
    f.write(api_docs_content)

print("✅ Created API_DOCS.md")

# Create README file
readme_content = '''# JyotiYantra - Renewable Energy Monitoring System Backend

![JyotiYantra Logo](https://via.placeholder.com/150x50/00d2ff/ffffff?text=JyotiYantra)

A professional Flask-based backend system for monitoring renewable energy installations with ThingsBoard integration.

## 🌟 Features

- **Real-time Data Ingestion**: Receive sensor data from ESP32/IoT devices
- **ThingsBoard Integration**: Automatic data forwarding and querying
- **Professional API**: RESTful endpoints with authentication
- **Data Processing**: Calculate power output and efficiency metrics
- **Historical Data**: Query last 20 telemetry records
- **Error Handling**: Comprehensive validation and error responses
- **Logging**: Detailed request and error logging
- **Security**: API key authentication for all endpoints

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- ThingsBoard instance (local or cloud)
- ESP32 or compatible IoT device

### Installation

#### Linux/MacOS
```bash
git clone <repository-url>
cd jyotiyantra-backend
chmod +x setup.sh
./setup.sh
```

#### Windows
```cmd
git clone <repository-url>
cd jyotiyantra-backend
setup.bat
```

### Configuration

1. Copy `.env.example` to `.env`
2. Edit `.env` with your ThingsBoard configuration:

```env
THINGSBOARD_HOST=your-thingsboard-host
THINGSBOARD_PORT=8080
THINGSBOARD_USERNAME=tenant@thingsboard.org
THINGSBOARD_PASSWORD=your-password
DEVICE_ID=your-device-id
DEVICE_TOKEN=your-device-token
API_KEY=your-secure-api-key
PANEL_AREA=1.5
```

### Running the Server

```bash
# Activate virtual environment
source venv/bin/activate  # Linux/MacOS
# or
venv\\Scripts\\activate.bat  # Windows

# Start the server
python app.py
```

Server will start on `http://localhost:5000`

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Data Ingestion
```http
POST /ingest
X-API-Key: your-api-key
Content-Type: application/json

{
    "voltage": 12.3,
    "current": 1.4,
    "irradiance": 850,
    "temperature": 30,
    "battery_voltage": 12.6
}
```

### Query Historical Data
```http
GET /api/data
X-API-Key: your-api-key
```

See [API_DOCS.md](API_DOCS.md) for complete documentation.

## 🔧 ESP32 Integration

### Hardware Connections
- Voltage sensor → A0
- Current sensor → A1
- Temperature sensor → A2
- Irradiance sensor → A3

### Sample ESP32 Code
```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "your-wifi";
const char* password = "your-password";
const char* serverURL = "http://your-server:5000/ingest";
const char* apiKey = "your-api-key";

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
}

void loop() {
    // Read sensors
    float voltage = readVoltage();
    float current = readCurrent();
    float irradiance = readIrradiance();
    float temperature = readTemperature();
    float batteryVoltage = readBatteryVoltage();
    
    // Send to backend
    sendSensorData(voltage, current, irradiance, temperature, batteryVoltage);
    
    delay(30000); // Send every 30 seconds
}
```

## 🔄 Data Processing

The system automatically calculates:

- **Power Output**: `P = V × I`
- **Efficiency**: `η = (P / (Irradiance × Panel Area)) × 100`

## 📊 ThingsBoard Integration

### Setup Steps
1. Create device in ThingsBoard
2. Copy device ID and access token
3. Configure credentials in `.env`
4. Data flows automatically to ThingsBoard dashboards

### Data Flow
```
ESP32 → Flask Backend → ThingsBoard → Dashboard
                ↓
            Historical API ← Web Frontend
```

## 🧹 Data Maintenance

Optional data cleaner for old records:
```bash
python data_cleaner.py
```

Automatically removes data older than configured retention period.

## 📝 Logging

Logs are written to:
- Console (real-time)
- `jyotiyantra.log` (persistent)

Log levels: INFO, WARNING, ERROR

## 🔒 Security Features

- API key authentication
- Input validation
- SQL injection protection
- Rate limiting ready
- CORS enabled for frontend integration

## 🐳 Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

## 📈 Monitoring Metrics

The system tracks:
- Request count and response times
- ThingsBoard connection status
- Data validation errors
- API authentication failures

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
- Check [API_DOCS.md](API_DOCS.md)
- Review logs in `jyotiyantra.log`
- Open GitHub issue

## 🔮 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Database caching layer
- [ ] Advanced analytics endpoints
- [ ] Mobile app integration
- [ ] Machine learning predictions
- [ ] Multi-device support
- [ ] Cloud deployment guides

---

**JyotiYantra** - Illuminating renewable energy monitoring 🌞⚡
'''

# Save README
with open('README.md', 'w') as f:
    f.write(readme_content)

print("✅ Created README.md")

print("\n🎉 Complete JyotiYantra backend package created!")
print("\n📦 Generated Files:")
print("├── app.py                 # Main Flask application")
print("├── requirements.txt       # Python dependencies")
print("├── .env.example          # Environment configuration template")
print("├── setup.sh              # Linux/MacOS setup script")
print("├── setup.bat             # Windows setup script")
print("├── data_cleaner.py       # Data maintenance script")
print("├── API_DOCS.md           # Complete API documentation")
print("└── README.md             # Project documentation")
# JyotiYantra - Renewable Energy Monitoring System Backend

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
venv\Scripts\activate.bat  # Windows

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

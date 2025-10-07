# JyotiYantra Backend API Documentation

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
    jsonData += "\"voltage\":" + String(voltage) + ",";
    jsonData += "\"current\":" + String(current) + ",";
    jsonData += "\"irradiance\":" + String(irradiance) + ",";
    jsonData += "\"temperature\":" + String(temperature) + ",";
    jsonData += "\"battery_voltage\":" + String(batteryVoltage);
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

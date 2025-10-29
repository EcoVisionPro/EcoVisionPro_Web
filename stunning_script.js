// ================================================================
// EcoVision Pro - Fixed Real-Time Solar Monitoring Dashboard
// Direct ThingsBoard WebSocket Connection (No Backend Auth Needed)
// ================================================================

// Configuration
const dashboardConfig = {
    // Your ThingsBoard device credentials
    deviceToken: "YycWv6Ad7iznPEk9HdT3",
    deviceId: "5c019fc0-a2c6-11f0-91df-7ffa16af2ee9",

    // Backend API (optional - for historical data)
    backendApiUrl: 'http://127.0.0.1:5000',
    apiKey: 'Str0ngS3cr3tKey_For_My_API_123!',

    // ThingsBoard WebSocket URL
    thingsboardWsHost: 'wss://thingsboard.cloud/api/ws/plugins/telemetry',

    // Display settings
    dataPointsToShow: 20,
    updateInterval: 5000, // Update every 5 seconds

    // Chart colors
    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)'],
        temperature: ['rgba(255, 99, 132, 0.8)', 'rgba(255, 159, 64, 0.8)'],
        battery: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 0.8)']
    }
};

// Global variables for charts and data storage
let voltageChart, currentChart, powerChart, temperatureChart, batteryGauge;
let websocket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

const sensorData = {
    timestamps: [],
    voltage: [],
    current: [],
    power: [],
    temperature: [],
    battery: [],
    irradiance: []
};

// ================================================================
// WEBSOCKET CONNECTION TO THINGSBOARD
// ================================================================

function connectToThingsBoard() {
    try {
        console.log("🔌 Connecting to ThingsBoard WebSocket...");

        // Build WebSocket URL with device token
        const wsUrl = `${dashboardConfig.thingsboardWsHost}?token=${dashboardConfig.deviceToken}`;

        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log("✅ Successfully connected to ThingsBoard!");
            reconnectAttempts = 0;

            // Update connection status on UI
            updateConnectionStatus(true, "Connected to ThingsBoard");

            // Subscribe to device telemetry
            subscribeToTelemetry();
        };

        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log("📊 Received data from ThingsBoard:", message);

                // Handle subscription response
                if (message.subscriptionId) {
                    console.log("✅ Subscription confirmed, waiting for telemetry data...");
                }

                // Handle telemetry data
                if (message.data) {
                    processThingsBoardData(message.data);
                }
            } catch (error) {
                console.error("❌ Error processing message:", error);
            }
        };

        websocket.onerror = (error) => {
            console.error("❌ WebSocket Error:", error);
            updateConnectionStatus(false, "Connection error");
        };

        websocket.onclose = () => {
            console.log("🔌 WebSocket connection closed");
            updateConnectionStatus(false, "Disconnected");

            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`🔄 Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                setTimeout(connectToThingsBoard, delay);
            } else {
                console.error("❌ Max reconnection attempts reached");
                showError("Failed to connect to ThingsBoard. Please refresh the page.");
            }
        };

    } catch (error) {
        console.error("❌ Connection Error:", error);
        updateConnectionStatus(false, "Failed to connect");
    }
}

function subscribeToTelemetry() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        const subscriptionCommand = {
            tsSubCmds: [{
                entityType: "DEVICE",
                entityId: dashboardConfig.deviceId,
                scope: "LATEST_TELEMETRY",
                cmdId: 1
            }],
            historyCmds: [],
            attrSubCmds: []
        };

        websocket.send(JSON.stringify(subscriptionCommand));
        console.log("📡 Subscribed to device telemetry");
    }
}

// ================================================================
// DATA PROCESSING
// ================================================================

function processThingsBoardData(data) {
    try {
        console.log("Processing telemetry data:", data);

        // Extract latest values from ThingsBoard format
        const latestData = {};

        // ThingsBoard sends data in format: { "key": [{"ts": timestamp, "value": value}] }
        for (const key in data) {
            if (data[key] && data[key].length > 0) {
                const latest = data[key][0];
                latestData[key] = parseFloat(latest.value);
                latestData.timestamp = new Date(latest.ts);
            }
        }

        // Map ThingsBoard keys to our dashboard keys
        const mappedData = {
            voltage: latestData.panel_voltage || latestData.voltage || 0,
            current: latestData.current || 0,
            temperature: latestData.temperature || 0,
            battery: latestData.battery_voltage || 0,
            irradiance: latestData.brightness || latestData.irradiance || 0,
            power: (latestData.panel_voltage || 0) * (latestData.current || 0), // Calculate power
            timestamp: latestData.timestamp || new Date()
        };

        console.log("✅ Mapped data:", mappedData);

        // Update dashboard with new data
        updateDashboardWithData(mappedData);

    } catch (error) {
        console.error("❌ Error processing data:", error);
    }
}

function updateDashboardWithData(data) {
    // Add to historical data
    const timestamp = data.timestamp.toLocaleTimeString();

    sensorData.timestamps.push(timestamp);
    sensorData.voltage.push(data.voltage);
    sensorData.current.push(data.current);
    sensorData.power.push(data.power);
    sensorData.temperature.push(data.temperature);
    sensorData.battery.push(data.battery);
    sensorData.irradiance.push(data.irradiance);

    // Keep only last N data points
    const maxPoints = dashboardConfig.dataPointsToShow;
    if (sensorData.timestamps.length > maxPoints) {
        sensorData.timestamps.shift();
        sensorData.voltage.shift();
        sensorData.current.shift();
        sensorData.power.shift();
        sensorData.temperature.shift();
        sensorData.battery.shift();
        sensorData.irradiance.shift();
    }

    // Update UI elements
    updateMetricCards(data);
    updateCharts();
    updateBatteryGauge(data.battery);
}

function updateMetricCards(data) {
    // Update voltage
    const voltageEl = document.getElementById('voltage-value');
    if (voltageEl) voltageEl.textContent = data.voltage.toFixed(2) + ' V';

    // Update current
    const currentEl = document.getElementById('current-value');
    if (currentEl) currentEl.textContent = data.current.toFixed(2) + ' A';

    // Update power
    const powerEl = document.getElementById('power-value');
    if (powerEl) powerEl.textContent = data.power.toFixed(2) + ' W';

    // Update temperature
    const tempEl = document.getElementById('temperature-value');
    if (tempEl) tempEl.textContent = data.temperature.toFixed(1) + ' °C';

    // Update battery
    const batteryEl = document.getElementById('battery-value');
    if (batteryEl) batteryEl.textContent = data.battery.toFixed(2) + ' V';

    // Update irradiance/brightness
    const irradianceEl = document.getElementById('irradiance-value');
    if (irradianceEl) irradianceEl.textContent = data.irradiance.toFixed(0) + ' %';

    // Update last update time
    const lastUpdateEl = document.getElementById('last-update');
    if (lastUpdateEl) lastUpdateEl.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
}

// ================================================================
// CHART INITIALIZATION AND UPDATES
// ================================================================

function initCharts() {
    console.log("📊 Initializing charts...");

    // Common chart options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#4ECDC4',
                borderWidth: 1
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#fff', maxTicksLimit: 8 }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#fff' }
            }
        }
    };

    // Voltage Chart
    const voltageCtx = document.getElementById('voltageChart');
    if (voltageCtx) {
        voltageChart = new Chart(voltageCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Voltage (V)',
                    data: [],
                    borderColor: dashboardConfig.chartColors.voltage[0],
                    backgroundColor: dashboardConfig.chartColors.voltage[1],
                    fill: true,
                    tension: 0.4
                }]
            },
            options: commonOptions
        });
    }

    // Current Chart
    const currentCtx = document.getElementById('currentChart');
    if (currentCtx) {
        currentChart = new Chart(currentCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Current (A)',
                    data: [],
                    borderColor: dashboardConfig.chartColors.current[0],
                    backgroundColor: dashboardConfig.chartColors.current[1],
                    fill: true,
                    tension: 0.4
                }]
            },
            options: commonOptions
        });
    }

    // Power Chart
    const powerCtx = document.getElementById('powerChart');
    if (powerCtx) {
        powerChart = new Chart(powerCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Power (W)',
                    data: [],
                    borderColor: dashboardConfig.chartColors.power[0],
                    backgroundColor: dashboardConfig.chartColors.power[1],
                    fill: true,
                    tension: 0.4
                }]
            },
            options: commonOptions
        });
    }

    // Battery Gauge (Doughnut Chart)
    const batteryCtx = document.getElementById('batteryGauge');
    if (batteryCtx) {
        batteryGauge = new Chart(batteryCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: [
                        dashboardConfig.chartColors.battery[0],
                        'rgba(200, 200, 200, 0.2)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    console.log("✅ Charts initialized successfully");
}

function updateCharts() {
    // Update Voltage Chart
    if (voltageChart) {
        voltageChart.data.labels = sensorData.timestamps;
        voltageChart.data.datasets[0].data = sensorData.voltage;
        voltageChart.update('none');
    }

    // Update Current Chart
    if (currentChart) {
        currentChart.data.labels = sensorData.timestamps;
        currentChart.data.datasets[0].data = sensorData.current;
        currentChart.update('none');
    }

    // Update Power Chart
    if (powerChart) {
        powerChart.data.labels = sensorData.timestamps;
        powerChart.data.datasets[0].data = sensorData.power;
        powerChart.update('none');
    }
}

function updateBatteryGauge(voltage) {
    if (batteryGauge) {
        // Convert voltage to percentage (assuming 12V battery: 11V=0%, 14.4V=100%)
        const minVoltage = 11.0;
        const maxVoltage = 14.4;
        const percentage = Math.min(100, Math.max(0, 
            ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100
        ));

        batteryGauge.data.datasets[0].data = [percentage, 100 - percentage];
        batteryGauge.update('none');

        // Update percentage text
        const batteryPercentEl = document.getElementById('battery-percent');
        if (batteryPercentEl) batteryPercentEl.textContent = percentage.toFixed(0) + '%';
    }
}

// ================================================================
// UI HELPER FUNCTIONS
// ================================================================

function updateConnectionStatus(connected, message) {
    const statusIndicator = document.getElementById('connection-status');
    const statusMessage = document.getElementById('connection-message');

    if (statusIndicator) {
        statusIndicator.className = connected ? 'status-online' : 'status-offline';
    }

    if (statusMessage) {
        statusMessage.textContent = message;
    }

    // Update error message if disconnected
    if (!connected) {
        showError(message);
    } else {
        hideError();
    }
}

function showError(message) {
    const errorContainer = document.getElementById('error-message');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
}

function hideError() {
    const errorContainer = document.getElementById('error-message');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

// ================================================================
// INITIALIZATION
// ================================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 EcoVision Pro Dashboard Starting...");
    console.log("📍 Device ID:", dashboardConfig.deviceId);
    console.log("🔑 Token:", dashboardConfig.deviceToken.substring(0, 10) + "...");

    // Initialize charts
    initCharts();

    // Connect to ThingsBoard
    connectToThingsBoard();

    console.log("✅ Dashboard initialized successfully!");
});

// Handle page visibility changes (pause/resume connection)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log("📴 Page hidden, maintaining connection...");
    } else {
        console.log("👁️ Page visible, checking connection...");
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            connectToThingsBoard();
        }
    }
});

// Export for debugging (development only)
if (typeof window !== 'undefined') {
    window.ecoVisionDebug = {
        sensorData,
        config: dashboardConfig,
        reconnect: connectToThingsBoard,
        websocket: () => websocket
    };
    console.log("🔧 Debug tools available: window.ecoVisionDebug");
}

// ================================================================
// EcoVision Pro - Real-Time Solar Monitoring Dashboard
// FIXED: Starts in LIVE mode + Better ThingsBoard Connection
// ================================================================

const dashboardConfig = {
    // ThingsBoard Device Credentials
    deviceToken: "YycWv6Ad7iznPEk9HdT3",
    deviceId: "5c019fc0-a2c6-11f0-91df-7ffa16af2ee9",
    backendApiUrl: 'http://127.0.0.1:5000',
    apiKey: 'Str0ngS3cr3tKey_For_My_API_123!',
    thingsboardWsHost: 'wss://thingsboard.cloud/api/ws/plugins/telemetry',

    // Display Settings
    dataPointsToShow: 20,
    updateInterval: 5000,

    // Chart Colors (Your Beautiful Gradients)
    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)'],
        temperature: ['rgba(255, 99, 132, 0.8)', 'rgba(255, 159, 64, 0.8)'],
        battery: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 0.8)']
    }
};

// Global Variables
let voltageChart, currentChart, powerChart, temperatureChart, batteryGauge;
let websocket = null;
let reconnectAttempts = 0;
let isDemoMode = false; // START IN LIVE MODE!

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
// DEMO MODE TOGGLE
// ================================================================
function toggleDemoMode() {
    isDemoMode = !isDemoMode;
    const btn = document.getElementById('demo-toggle');
    const dot = btn?.querySelector('.status-dot');

    if (isDemoMode) {
        btn?.classList.add('active');
        if (dot) {
            dot.className = 'status-dot demo-active';
            dot.textContent = 'Demo';
        }
        if (websocket) websocket.close();
        startDemoMode();
        console.log('🎬 Demo Mode ON');
    } else {
        btn?.classList.remove('active');
        if (dot) {
            dot.className = 'status-dot live-active';
            dot.textContent = 'Live';
        }
        stopDemoMode();
        connectToThingsBoard();
        console.log('🔌 Live Mode ON');
    }
}

// ================================================================
// THINGSBOARD CONNECTION - IMPROVED!
// ================================================================
function connectToThingsBoard() {
    try {
        console.log("🔌 Connecting to ThingsBoard WebSocket...");
        const wsUrl = `${dashboardConfig.thingsboardWsHost}?token=${dashboardConfig.deviceToken}`;

        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log("✅ Connected to ThingsBoard!");
            reconnectAttempts = 0;
            subscribeToTelemetry();
        };

        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log("📊 Received from ThingsBoard:", message);

                if (message.data) {
                    processThingsBoardData(message.data);
                }
            } catch (error) {
                console.error("❌ Error parsing message:", error);
            }
        };

        websocket.onerror = (error) => {
            console.error("❌ WebSocket Error:", error);
        };

        websocket.onclose = () => {
            console.log("🔌 Disconnected from ThingsBoard");

            if (!isDemoMode && reconnectAttempts < 10) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttempts}/10)`);
                setTimeout(connectToThingsBoard, delay);
            }
        };
    } catch (error) {
        console.error("❌ Connection Error:", error);
    }
}

function subscribeToTelemetry() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        const cmd = {
            tsSubCmds: [{
                entityType: "DEVICE",
                entityId: dashboardConfig.deviceId,
                scope: "LATEST_TELEMETRY",
                cmdId: 1
            }],
            historyCmds: [],
            attrSubCmds: []
        };

        websocket.send(JSON.stringify(cmd));
        console.log("📡 Subscribed to telemetry");
    }
}

function processThingsBoardData(data) {
    try {
        console.log("Processing data:", data);

        const latestData = {};

        // Extract values from ThingsBoard format
        for (const key in data) {
            if (data[key] && data[key].length > 0) {
                latestData[key] = parseFloat(data[key][0].value);
                latestData.timestamp = new Date(data[key][0].ts);
            }
        }

        const mappedData = {
            voltage: latestData.panel_voltage || latestData.voltage || 0,
            current: latestData.current || 0,
            temperature: latestData.temperature || 0,
            battery: latestData.battery_voltage || 0,
            irradiance: latestData.brightness || latestData.irradiance || 0,
            power: 0,
            timestamp: latestData.timestamp || new Date()
        };

        mappedData.power = mappedData.voltage * mappedData.current;

        console.log("✅ Mapped data:", mappedData);
        updateDashboardWithData(mappedData);

    } catch (error) {
        console.error("❌ Error processing data:", error);
    }
}

// ================================================================
// DEMO MODE
// ================================================================
let demoInterval = null;

function startDemoMode() {
    resetData();

    // Generate initial data
    for (let i = 0; i < dashboardConfig.dataPointsToShow; i++) {
        generateDemoData();
    }

    // Update every 2 seconds
    demoInterval = setInterval(generateDemoData, 2000);
}

function stopDemoMode() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
    }
}

function generateDemoData() {
    const solar = Math.sin(Date.now() / 60000) * 0.5 + 0.5;
    const cloud = 0.85 + Math.random() * 0.15;

    const data = {
        voltage: 12 + Math.random() * 2,
        current: 5 * solar * cloud + Math.random() * 2,
        temperature: 30 + solar * 10 + Math.random() * 5,
        battery: 12 + Math.random() * 2,
        irradiance: 500 * solar * cloud + Math.random() * 100,
        power: 0,
        timestamp: new Date()
    };

    data.power = data.voltage * data.current;
    updateDashboardWithData(data);
}

function resetData() {
    Object.keys(sensorData).forEach(key => sensorData[key] = []);
}

// ================================================================
// UPDATE DASHBOARD
// ================================================================
function updateDashboardWithData(data) {
    const time = data.timestamp.toLocaleTimeString();

    sensorData.timestamps.push(time);
    sensorData.voltage.push(data.voltage);
    sensorData.current.push(data.current);
    sensorData.power.push(data.power);
    sensorData.temperature.push(data.temperature);
    sensorData.battery.push(data.battery);
    sensorData.irradiance.push(data.irradiance);

    // Keep only last N points
    if (sensorData.timestamps.length > dashboardConfig.dataPointsToShow) {
        Object.keys(sensorData).forEach(key => sensorData[key].shift());
    }

    updateMetricCards(data);
    updateCharts();
    updateBatteryGauge(data.battery);
}

function updateMetricCards(data) {
    const updates = {
        'voltage-value': data.voltage.toFixed(2) + ' V',
        'current-value': data.current.toFixed(2) + ' A',
        'power-value': data.power.toFixed(2) + ' W',
        'temperature-value': data.temperature.toFixed(1) + ' °C',
        'battery-value': data.battery.toFixed(2) + ' V',
        'irradiance-value': data.irradiance.toFixed(0) + ' W/m²'
    };

    Object.entries(updates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// ================================================================
// CHARTS
// ================================================================
function initCharts() {
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

    // Battery Gauge
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

    console.log("✅ Charts initialized");
}

function updateCharts() {
    if (voltageChart) {
        voltageChart.data.labels = sensorData.timestamps;
        voltageChart.data.datasets[0].data = sensorData.voltage;
        voltageChart.update('none');
    }
    if (currentChart) {
        currentChart.data.labels = sensorData.timestamps;
        currentChart.data.datasets[0].data = sensorData.current;
        currentChart.update('none');
    }
    if (powerChart) {
        powerChart.data.labels = sensorData.timestamps;
        powerChart.data.datasets[0].data = sensorData.power;
        powerChart.update('none');
    }
}

function updateBatteryGauge(voltage) {
    if (batteryGauge) {
        const percent = Math.min(100, Math.max(0, ((voltage - 11.0) / (14.4 - 11.0)) * 100));
        batteryGauge.data.datasets[0].data = [percent, 100 - percent];
        batteryGauge.update('none');

        const el = document.getElementById('battery-percent');
        if (el) el.textContent = percent.toFixed(0) + '%';
    }
}

// ================================================================
// INITIALIZATION
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 EcoVision Pro Dashboard Starting...");
    console.log("Device ID:", dashboardConfig.deviceId);

    initCharts();

    // START IN LIVE MODE!
    console.log("📡 Starting in LIVE mode");
    connectToThingsBoard();

    console.log("✅ Dashboard ready!");
});

// Export for debugging
if (typeof window !== 'undefined') {
    window.ecoVisionDebug = {
        sensorData,
        config: dashboardConfig,
        reconnect: connectToThingsBoard,
        toggleDemo: toggleDemoMode,
        websocket: () => websocket,
        isDemoMode: () => isDemoMode
    };
}

console.log("📊 EcoVision Pro v2.0 Loaded");

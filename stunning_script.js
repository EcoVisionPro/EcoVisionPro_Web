// ================================================================
// EcoVision Pro - PERFECT JAVASCRIPT
// FIXED: Demo→Live properly switches data + All features
// ================================================================

const dashboardConfig = {
    deviceToken: "YycWv6Ad7iznPEk9HdT3",
    deviceId: "5c019fc0-a2c6-11f0-91df-7ffa16af2ee9",
    backendApiUrl: 'http://127.0.0.1:5000',
    apiKey: 'Str0ngS3cr3tKey_For_My_API_123!',
    thingsboardWsHost: 'wss://thingsboard.cloud/api/ws/plugins/telemetry',

    dataPointsToShow: 20,
    updateInterval: 5000,

    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)'],
        battery: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 0.8)']
    }
};

// Global Variables
let voltageChart, currentChart, powerChart, batteryGauge;
let websocket = null;
let reconnectAttempts = 0;
let isDemoMode = false;
let demoInterval = null;

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
// FIXED DEMO/LIVE TOGGLE - PROPERLY SWITCHES DATA!
// ================================================================
function toggleDemoMode() {
    isDemoMode = !isDemoMode;
    const btn = document.getElementById('demo-toggle');
    const indicator = document.getElementById('mode-indicator');

    if (isDemoMode) {
        // SWITCH TO DEMO
        btn?.classList.add('active');
        if (indicator) {
            indicator.className = 'status-dot demo-active';
        }

        // Close WebSocket
        if (websocket) {
            websocket.close();
            websocket = null;
        }

        // Stop any existing demo
        if (demoInterval) clearInterval(demoInterval);

        // CLEAR ALL DATA - Important!
        resetData();

        // Start fresh demo
        startDemoMode();
        console.log('🎬 DEMO MODE ON - Data cleared, demo started');

    } else {
        // SWITCH TO LIVE
        btn?.classList.remove('active');
        if (indicator) {
            indicator.className = 'status-dot live-active';
        }

        // Stop demo
        if (demoInterval) {
            clearInterval(demoInterval);
            demoInterval = null;
        }

        // CLEAR ALL DATA - Important!
        resetData();

        // Reset reconnect counter
        reconnectAttempts = 0;

        // Connect to ThingsBoard
        connectToThingsBoard();
        console.log('🔌 LIVE MODE ON - Data cleared, connecting to ThingsBoard');
    }
}

// ================================================================
// THINGSBOARD CONNECTION
// ================================================================
function connectToThingsBoard() {
    if (isDemoMode) return;

    try {
        console.log("🔌 Connecting to ThingsBoard...");
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
                if (message.data) {
                    processThingsBoardData(message.data);
                }
            } catch (error) {
                console.error("❌ Error parsing:", error);
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
                console.log(`🔄 Reconnecting in ${delay/1000}s...`);
                setTimeout(() => {
                    if (!isDemoMode) connectToThingsBoard();
                }, delay);
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
        const latestData = {};
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
        console.log("✅ Live Data:", mappedData);
        updateDashboardWithData(mappedData);
    } catch (error) {
        console.error("❌ Error processing:", error);
    }
}

// ================================================================
// DEMO MODE - Beautiful simulation
// ================================================================
let demoHour = 12;
let demoTimeOffset = 0;

function startDemoMode() {
    // Generate initial demo data
    for (let i = 0; i < dashboardConfig.dataPointsToShow; i++) {
        generateDemoData();
    }

    // Update every 2 seconds
    demoInterval = setInterval(generateDemoData, 2000);
    console.log('▶️ Demo mode started');
}

function generateDemoData() {
    const hour = demoHour + (demoTimeOffset / 60);
    let solar = 0;

    if (hour < 6) solar = 0.01;
    else if (hour < 8) solar = (hour - 6) / 2 * 0.4;
    else if (hour < 11) solar = 0.4 + (hour - 8) / 3 * 0.5;
    else if (hour < 13) solar = 0.9 + Math.sin((hour - 11) / 2 * Math.PI) * 0.1;
    else if (hour < 17) solar = 0.95 - (hour - 13) / 4 * 0.5;
    else if (hour < 20) solar = 0.45 - (hour - 17) / 3 * 0.3;
    else solar = 0.01;

    const cloud = 0.85 + Math.random() * 0.15;
    const effectiveSolar = solar * cloud;

    const data = {
        voltage: 11.5 + Math.random() * 3.3,
        current: effectiveSolar * 15 + (Math.random() - 0.5) * 2,
        temperature: 25 + effectiveSolar * 15 + (Math.random() - 0.5) * 5,
        battery: 11.8 + Math.random() * 2.6,
        irradiance: effectiveSolar * 900 + (Math.random() - 0.5) * 100,
        power: 0,
        timestamp: new Date()
    };

    data.voltage = Math.max(11.5, Math.min(15, data.voltage));
    data.current = Math.max(0, Math.min(20, data.current));
    data.temperature = Math.max(20, Math.min(50, data.temperature));
    data.battery = Math.max(11.8, Math.min(14.4, data.battery));
    data.irradiance = Math.max(0, data.irradiance);
    data.power = data.voltage * data.current;

    updateDashboardWithData(data);

    demoTimeOffset += 0.1;
    if (demoTimeOffset >= 60) {
        demoHour = (demoHour + 1) % 24;
        demoTimeOffset = 0;
    }
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

    if (sensorData.timestamps.length > dashboardConfig.dataPointsToShow) {
        Object.keys(sensorData).forEach(key => sensorData[key].shift());
    }

    updateMetricCards(data);
    updateCharts();
    updateBatteryGauge(data.battery);
}

function updateMetricCards(data) {
    document.getElementById('voltage-value').textContent = data.voltage.toFixed(2) + ' V';
    document.getElementById('current-value').textContent = data.current.toFixed(2) + ' A';
    document.getElementById('power-value').textContent = data.power.toFixed(2) + ' W';
    document.getElementById('temperature-value').textContent = data.temperature.toFixed(1) + ' °C';
    document.getElementById('battery-value').textContent = data.battery.toFixed(2) + ' V';
    document.getElementById('irradiance-value').textContent = data.irradiance.toFixed(0) + ' W/m²';
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

        document.getElementById('battery-percent').textContent = percent.toFixed(0);
    }
}

// ================================================================
// INITIALIZATION - STARTS IN LIVE MODE
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 EcoVision Pro Dashboard Initializing...");
    console.log("Device ID:", dashboardConfig.deviceId);

    initCharts();
    console.log("📡 Starting in LIVE mode...");
    connectToThingsBoard();

    console.log("✅ Dashboard ready!");
});

// Debug tools
if (typeof window !== 'undefined') {
    window.ecoVisionDebug = {
        sensorData,
        toggleDemo: toggleDemoMode,
        connectLive: connectToThingsBoard,
        isDemoMode: () => isDemoMode,
        getWebSocket: () => websocket
    };
}

console.log("📊 EcoVision Pro - PERFECT VERSION LOADED");

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
        btn?.classList.add('active');
        if (indicator) indicator.className = 'status-dot demo-active';
        if (websocket) { websocket.close(); websocket = null; }
        if (demoInterval) clearInterval(demoInterval);
        resetData();
        startDemoMode();
        console.log('🎬 DEMO MODE ON');
    } else {
        btn?.classList.remove('active');
        if (indicator) indicator.className = 'status-dot live-active';
        if (demoInterval) { clearInterval(demoInterval); demoInterval = null; }
        resetData();
        reconnectAttempts = 0;
        connectToThingsBoard();
        console.log('🔌 LIVE MODE ON');
    }
}

function connectToThingsBoard() {
    if (isDemoMode) return;
    try {
        const wsUrl = `${dashboardConfig.thingsboardWsHost}?token=${dashboardConfig.deviceToken}`;
        websocket = new WebSocket(wsUrl);
        websocket.onopen = () => { reconnectAttempts = 0; subscribeToTelemetry(); };
        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.data) processThingsBoardData(message.data);
            } catch (error) { console.error("❌ Error:", error); }
        };
        websocket.onclose = () => {
            if (!isDemoMode && reconnectAttempts < 10) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                setTimeout(() => { if (!isDemoMode) connectToThingsBoard(); }, delay);
            }
        };
    } catch (error) { console.error("❌ Connection Error:", error); }
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
    }
}

function processThingsBoardData(data) {
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
    updateDashboardWithData(mappedData);
}

let demoHour = 12, demoTimeOffset = 0;

function startDemoMode() {
    for (let i = 0; i < dashboardConfig.dataPointsToShow; i++) generateDemoData();
    demoInterval = setInterval(generateDemoData, 2000);
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
        voltage: Math.max(11.5, Math.min(15, 11.5 + Math.random() * 3.3)),
        current: Math.max(0, Math.min(20, effectiveSolar * 15 + (Math.random() - 0.5) * 2)),
        temperature: Math.max(20, Math.min(50, 25 + effectiveSolar * 15 + (Math.random() - 0.5) * 5)),
        battery: Math.max(11.8, Math.min(14.4, 11.8 + Math.random() * 2.6)),
        irradiance: Math.max(0, effectiveSolar * 900 + (Math.random() - 0.5) * 100),
        power: 0,
        timestamp: new Date()
    };
    data.power = data.voltage * data.current;
    updateDashboardWithData(data);
    demoTimeOffset += 0.1;
    if (demoTimeOffset >= 60) { demoHour = (demoHour + 1) % 24; demoTimeOffset = 0; }
}

function resetData() {
    Object.keys(sensorData).forEach(key => sensorData[key] = []);
}

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

function initCharts() {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff', bodyColor: '#fff', borderColor: '#4ECDC4', borderWidth: 1
            }
        },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#fff', maxTicksLimit: 8 } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#fff' } }
        }
    };

    const voltageCtx = document.getElementById('voltageChart');
    if (voltageCtx) {
        voltageChart = new Chart(voltageCtx, {
            type: 'line',
            data: { labels: [], datasets: [{
                label: 'Voltage (V)', data: [],
                borderColor: dashboardConfig.chartColors.voltage[0],
                backgroundColor: dashboardConfig.chartColors.voltage[1],
                fill: true, tension: 0.4
            }]},
            options: commonOptions
        });
    }

    const currentCtx = document.getElementById('currentChart');
    if (currentCtx) {
        currentChart = new Chart(currentCtx, {
            type: 'line',
            data: { labels: [], datasets: [{
                label: 'Current (A)', data: [],
                borderColor: dashboardConfig.chartColors.current[0],
                backgroundColor: dashboardConfig.chartColors.current[1],
                fill: true, tension: 0.4
            }]},
            options: commonOptions
        });
    }

    const powerCtx = document.getElementById('powerChart');
    if (powerCtx) {
        powerChart = new Chart(powerCtx, {
            type: 'line',
            data: { labels: [], datasets: [{
                label: 'Power (W)', data: [],
                borderColor: dashboardConfig.chartColors.power[0],
                backgroundColor: dashboardConfig.chartColors.power[1],
                fill: true, tension: 0.4
            }]},
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
                    backgroundColor: [dashboardConfig.chartColors.battery[0], 'rgba(200, 200, 200, 0.2)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '75%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }
}

function updateCharts() {
    if (voltageChart) { voltageChart.data.labels = sensorData.timestamps; voltageChart.data.datasets[0].data = sensorData.voltage; voltageChart.update('none'); }
    if (currentChart) { currentChart.data.labels = sensorData.timestamps; currentChart.data.datasets[0].data = sensorData.current; currentChart.update('none'); }
    if (powerChart) { powerChart.data.labels = sensorData.timestamps; powerChart.data.datasets[0].data = sensorData.power; powerChart.update('none'); }
}

function updateBatteryGauge(voltage) {
    if (batteryGauge) {
        const percent = Math.min(100, Math.max(0, ((voltage - 11.0) / (14.4 - 11.0)) * 100));
        batteryGauge.data.datasets[0].data = [percent, 100 - percent];
        batteryGauge.update('none');
        document.getElementById('battery-percent').textContent = percent.toFixed(0);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    connectToThingsBoard();
    console.log("✅ Dashboard ready!");
});

window.ecoVisionDebug = {
    sensorData, toggleDemo: toggleDemoMode,
    connectLive: connectToThingsBoard,
    isDemoMode: () => isDemoMode,
    getWebSocket: () => websocket
};

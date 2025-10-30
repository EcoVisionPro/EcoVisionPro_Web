// ================================================================
// EcoVision Pro - ENHANCED with Demo Mode, Login & Effects
// Original Beautiful Design Preserved + New Features
// ================================================================

// Configuration
const dashboardConfig = {
    // Mode settings
    isDemoMode: true, // Start in demo mode by default
    isLoggedIn: false,

    // ThingsBoard credentials
    deviceToken: "YycWv6Ad7iznPEk9HdT3",
    deviceId: "5c019fc0-a2c6-11f0-91df-7ffa16af2ee9",
    thingsboardWsHost: 'wss://thingsboard.cloud/api/ws/plugins/telemetry',
    backendApiUrl: 'http://127.0.0.1:5000',
    apiKey: 'Str0ngS3cr3tKey_For_My_API_123!',

    // Demo configuration
    demo: {
        updateInterval: 2000,
        dataPoints: 20,
        ranges: {
            voltage: { min: 11.5, max: 14.8, baseline: 13.2 },
            current: { min: 0.5, max: 18.5, baseline: 8.5 },
            temperature: { min: 22, max: 48, baseline: 35 },
            irradiance: { min: 200, max: 1000, baseline: 650 },
            battery: { min: 11.8, max: 14.2, baseline: 12.8 }
        },
        currentHour: 12
    },

    // Display settings
    dataPointsToShow: 20,
    updateInterval: 5000,

    // Chart colors (KEEP YOUR BEAUTIFUL COLORS!)
    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)'],
        temperature: ['rgba(255, 99, 132, 0.8)', 'rgba(255, 159, 64, 0.8)'],
        battery: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 0.8)']
    }
};

// Global variables
let voltageChart, currentChart, powerChart, batteryGauge;
let websocket = null;
let demoInterval = null;
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

const demoStats = {
    totalEnergy: 2.4,
    co2Saved: 1.8,
    efficiency: 94.2
};

// ================================================================
// DEMO DATA GENERATOR
// ================================================================
class DemoDataGenerator {
    constructor() {
        this.timeOffset = 0;
    }

    getSolarFactor() {
        const hour = dashboardConfig.demo.currentHour;
        if (hour < 6 || hour > 20) return 0.05;
        if (hour >= 6 && hour < 8) return (hour - 6) * 0.25;
        if (hour >= 8 && hour < 11) return 0.5 + (hour - 8) * 0.15;
        if (hour >= 11 && hour <= 13) return 0.95 + Math.random() * 0.05;
        if (hour > 13 && hour <= 17) return 0.95 - (hour - 13) * 0.12;
        if (hour > 17 && hour <= 20) return 0.4 - (hour - 17) * 0.12;
        return 0.5;
    }

    addNoise(value, range, factor = 0.05) {
        const noise = (Math.random() - 0.5) * (range.max - range.min) * factor;
        return Math.max(range.min, Math.min(range.max, value + noise));
    }

    generate() {
        const solarFactor = this.getSolarFactor();
        const cloudFactor = 0.85 + Math.random() * 0.15;

        const voltage = this.addNoise(
            dashboardConfig.demo.ranges.voltage.baseline,
            dashboardConfig.demo.ranges.voltage, 0.03
        );

        const baseCurrent = dashboardConfig.demo.ranges.current.baseline * solarFactor * cloudFactor;
        const current = this.addNoise(baseCurrent, dashboardConfig.demo.ranges.current, 0.08);

        const baseTemp = dashboardConfig.demo.ranges.temperature.baseline + (solarFactor * 8);
        const temperature = this.addNoise(baseTemp, dashboardConfig.demo.ranges.temperature, 0.04);

        const baseIrradiance = dashboardConfig.demo.ranges.irradiance.baseline * solarFactor * cloudFactor;
        const irradiance = this.addNoise(baseIrradiance, dashboardConfig.demo.ranges.irradiance, 0.1);

        const batteryTrend = solarFactor > 0.3 ? 0.002 : -0.001;
        const battery = this.addNoise(
            dashboardConfig.demo.ranges.battery.baseline + batteryTrend,
            dashboardConfig.demo.ranges.battery, 0.01
        );

        const power = voltage * current;

        this.timeOffset += 0.25;
        if (this.timeOffset >= 1) {
            dashboardConfig.demo.currentHour = (dashboardConfig.demo.currentHour + 1) % 24;
            this.timeOffset = 0;
        }

        return {
            voltage: parseFloat(voltage.toFixed(2)),
            current: parseFloat(current.toFixed(2)),
            power: parseFloat(power.toFixed(2)),
            temperature: parseFloat(temperature.toFixed(1)),
            irradiance: parseFloat(irradiance.toFixed(0)),
            battery: parseFloat(battery.toFixed(2)),
            timestamp: new Date()
        };
    }

    calculateTrend(values) {
        if (values.length < 5) return 0;
        const recent = values.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const older = values.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
        if (older === 0) return 0;
        return parseFloat((((recent - older) / older) * 100).toFixed(1));
    }
}

const demoGenerator = new DemoDataGenerator();

// ================================================================
// MODE TOGGLING
// ================================================================
function toggleDemoMode() {
    dashboardConfig.isDemoMode = !dashboardConfig.isDemoMode;

    const demoToggle = document.querySelector('.demo-toggle');
    const indicator = document.getElementById('demo-mode-indicator');
    const text = document.getElementById('demo-mode-text');

    if (dashboardConfig.isDemoMode) {
        demoToggle?.classList.add('active');
        indicator?.classList.remove('live');
        indicator?.classList.add('demo');
        if (text) text.textContent = 'Demo';

        if (websocket) {
            websocket.close();
            websocket = null;
        }
        startDemoMode();
    } else {
        demoToggle?.classList.remove('active');
        indicator?.classList.remove('demo');
        indicator?.classList.add('live');
        if (text) text.textContent = 'Live';

        stopDemoMode();
        connectToThingsBoard();
    }
}

function startDemoMode() {
    console.log('🎬 Demo Mode Started');
    resetSensorData();

    for (let i = 0; i < dashboardConfig.demo.dataPoints; i++) {
        const reading = demoGenerator.generate();
        updateDashboardWithData(reading);
    }

    demoInterval = setInterval(() => {
        const reading = demoGenerator.generate();
        updateDashboardWithData(reading);
        updateDynamicTrends();
    }, dashboardConfig.demo.updateInterval);
}

function stopDemoMode() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
    }
}

function resetSensorData() {
    Object.keys(sensorData).forEach(key => sensorData[key] = []);
}

function updateDynamicTrends() {
    const voltageTrend = demoGenerator.calculateTrend(sensorData.voltage);
    const currentTrend = demoGenerator.calculateTrend(sensorData.current);
    const powerTrend = demoGenerator.calculateTrend(sensorData.power);
    const tempTrend = demoGenerator.calculateTrend(sensorData.temperature);

    updateTrendBadge('voltage-trend', voltageTrend);
    updateTrendBadge('current-trend', currentTrend);
    updateTrendBadge('power-trend', powerTrend);
    updateTrendBadge('temperature-trend', tempTrend);
}

function updateTrendBadge(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const isPositive = value >= 0;
    el.textContent = `${isPositive ? '+' : ''}${value.toFixed(1)}%`;
    el.className = `metric-change ${isPositive ? 'trend-up' : 'trend-down'}`;
}

// ================================================================
// LOGIN TOGGLE
// ================================================================
function toggleLogin() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.toggle('show');
        document.body.style.overflow = modal.classList.contains('show') ? 'hidden' : 'auto';
    }
}

function handleLogin(e) {
    e?.preventDefault();
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;

    if (email && password.length >= 6) {
        dashboardConfig.isLoggedIn = true;
        const loginBtn = document.querySelector('.login-toggle .toggle-content span');
        if (loginBtn) loginBtn.textContent = 'Account';
        toggleLogin();
    }
}

// ================================================================
// THINGSBOARD CONNECTION
// ================================================================
function connectToThingsBoard() {
    try {
        console.log("🔌 Connecting to ThingsBoard...");
        const wsUrl = `${dashboardConfig.thingsboardWsHost}?token=${dashboardConfig.deviceToken}`;
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log("✅ Connected!");
            reconnectAttempts = 0;
            subscribeToTelemetry();
        };

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.data) processThingsBoardData(message.data);
        };

        websocket.onerror = () => console.error("❌ Connection error");

        websocket.onclose = () => {
            console.log("🔌 Disconnected");
            if (!dashboardConfig.isDemoMode && reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(connectToThingsBoard, 5000);
            }
        };
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

function subscribeToTelemetry() {
    if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            tsSubCmds: [{
                entityType: "DEVICE",
                entityId: dashboardConfig.deviceId,
                scope: "LATEST_TELEMETRY",
                cmdId: 1
            }]
        }));
    }
}

function processThingsBoardData(data) {
    const mapped = {
        voltage: data.panel_voltage?.[0]?.value || 0,
        current: data.current?.[0]?.value || 0,
        temperature: data.temperature?.[0]?.value || 0,
        battery: data.battery_voltage?.[0]?.value || 0,
        irradiance: data.brightness?.[0]?.value || 0,
        power: 0,
        timestamp: new Date()
    };
    mapped.power = mapped.voltage * mapped.current;
    updateDashboardWithData(mapped);
}

// ================================================================
// DATA UPDATE
// ================================================================
function updateDashboardWithData(data) {
    const timestamp = data.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    sensorData.timestamps.push(timestamp);
    sensorData.voltage.push(data.voltage);
    sensorData.current.push(data.current);
    sensorData.power.push(data.power);
    sensorData.temperature.push(data.temperature);
    sensorData.battery.push(data.battery);
    sensorData.irradiance.push(data.irradiance);

    const maxPoints = dashboardConfig.isDemoMode ? dashboardConfig.demo.dataPoints : dashboardConfig.dataPointsToShow;

    if (sensorData.timestamps.length > maxPoints) {
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
    console.log("📊 Initializing charts...");

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

    const createChart = (id, label, colors) => {
        const ctx = document.getElementById(id);
        if (!ctx) return null;
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label,
                    data: [],
                    borderColor: colors[0],
                    backgroundColor: colors[1],
                    fill: true,
                    tension: 0.4
                }]
            },
            options: commonOptions
        });
    };

    voltageChart = createChart('voltageChart', 'Voltage (V)', dashboardConfig.chartColors.voltage);
    currentChart = createChart('currentChart', 'Current (A)', dashboardConfig.chartColors.current);
    powerChart = createChart('powerChart', 'Power (W)', dashboardConfig.chartColors.power);

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
    if (!batteryGauge) return;
    const minV = 11.0, maxV = 14.4;
    const percent = Math.min(100, Math.max(0, ((voltage - minV) / (maxV - minV)) * 100));
    batteryGauge.data.datasets[0].data = [percent, 100 - percent];
    batteryGauge.update('none');
    const el = document.getElementById('battery-percent');
    if (el) el.textContent = percent.toFixed(0) + '%';
}

// ================================================================
// SPLASH CURSOR EFFECT
// ================================================================
let splashTimeout;
document.addEventListener('mousemove', (e) => {
    clearTimeout(splashTimeout);
    splashTimeout = setTimeout(() => createSplash(e.clientX, e.clientY), 100);
});

function createSplash(x, y) {
    const splash = document.createElement('div');
    splash.className = 'splash-ring';
    splash.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:40px;height:40px;border:2px solid rgba(78,205,196,0.6);border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);animation:splash-expand 0.6s ease-out forwards;`;
    document.body.appendChild(splash);
    setTimeout(() => splash.remove(), 600);
}

// ================================================================
// INITIALIZATION
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 EcoVision Pro Dashboard Starting...");
    initCharts();

    if (dashboardConfig.isDemoMode) {
        startDemoMode();
    } else {
        connectToThingsBoard();
    }

    console.log("✅ Dashboard initialized!");
});

// Debug tools
if (typeof window !== 'undefined') {
    window.ecoVisionDebug = {
        config: dashboardConfig,
        data: sensorData,
        toggleDemo: toggleDemoMode,
        toggleLogin: toggleLogin
    };
}

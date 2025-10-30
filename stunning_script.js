// ================================================================
// EcoVision Pro - Enhanced Dashboard with Demo Mode
// Clean, Organized, and Working Perfectly
// ================================================================

// Configuration
const config = {
    isDemoMode: true,
    deviceToken: "YycWv6Ad7iznPEk9HdT3",
    deviceId: "5c019fc0-a2c6-11f0-91df-7ffa16af2ee9",
    thingsboardWsHost: 'wss://thingsboard.cloud/api/ws/plugins/telemetry',

    demo: {
        updateInterval: 2000,
        dataPoints: 20,
        currentHour: 12,
        ranges: {
            voltage: { min: 11.5, max: 14.8, baseline: 13.2 },
            current: { min: 0.5, max: 18.5, baseline: 8.5 },
            temperature: { min: 22, max: 48, baseline: 35 },
            irradiance: { min: 200, max: 1000, baseline: 650 },
            battery: { min: 11.8, max: 14.2, baseline: 12.8 }
        }
    },

    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)'],
        battery: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 0.8)']
    }
};

// Global variables
let charts = { voltage: null, current: null, power: null, battery: null };
let websocket = null;
let demoInterval = null;

const data = {
    timestamps: [],
    voltage: [],
    current: [],
    power: [],
    temperature: [],
    battery: [],
    irradiance: []
};

// ================================================================
// DEMO DATA GENERATOR
// ================================================================
class DemoGenerator {
    constructor() {
        this.timeOffset = 0;
    }

    getSolarFactor() {
        const h = config.demo.currentHour;
        if (h < 6 || h > 20) return 0.05;
        if (h >= 6 && h < 8) return (h - 6) * 0.25;
        if (h >= 8 && h < 11) return 0.5 + (h - 8) * 0.15;
        if (h >= 11 && h <= 13) return 0.95 + Math.random() * 0.05;
        if (h > 13 && h <= 17) return 0.95 - (h - 13) * 0.12;
        if (h > 17 && h <= 20) return 0.4 - (h - 17) * 0.12;
        return 0.5;
    }

    addNoise(value, range, factor = 0.05) {
        const noise = (Math.random() - 0.5) * (range.max - range.min) * factor;
        return Math.max(range.min, Math.min(range.max, value + noise));
    }

    generate() {
        const solar = this.getSolarFactor();
        const cloud = 0.85 + Math.random() * 0.15;

        const voltage = this.addNoise(config.demo.ranges.voltage.baseline, config.demo.ranges.voltage, 0.03);
        const baseCurrent = config.demo.ranges.current.baseline * solar * cloud;
        const current = this.addNoise(baseCurrent, config.demo.ranges.current, 0.08);
        const baseTemp = config.demo.ranges.temperature.baseline + (solar * 8);
        const temperature = this.addNoise(baseTemp, config.demo.ranges.temperature, 0.04);
        const baseIrr = config.demo.ranges.irradiance.baseline * solar * cloud;
        const irradiance = this.addNoise(baseIrr, config.demo.ranges.irradiance, 0.1);
        const battery = this.addNoise(config.demo.ranges.battery.baseline, config.demo.ranges.battery, 0.01);
        const power = voltage * current;

        this.timeOffset += 0.25;
        if (this.timeOffset >= 1) {
            config.demo.currentHour = (config.demo.currentHour + 1) % 24;
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
        return older === 0 ? 0 : parseFloat((((recent - older) / older) * 100).toFixed(1));
    }
}

const generator = new DemoGenerator();

// ================================================================
// DEMO MODE CONTROL
// ================================================================
function toggleDemoMode() {
    config.isDemoMode = !config.isDemoMode;

    const btn = document.getElementById('demo-toggle');
    const dot = btn?.querySelector('.status-dot');
    const text = btn?.querySelector('.btn-text');

    if (config.isDemoMode) {
        btn?.classList.add('active');
        if (dot) dot.className = 'status-dot demo-active';
        if (text) text.textContent = 'Demo';

        if (websocket) websocket.close();
        startDemo();
    } else {
        btn?.classList.remove('active');
        if (dot) dot.className = 'status-dot live-active';
        if (text) text.textContent = 'Live';

        stopDemo();
        connectThingsBoard();
    }
}

function startDemo() {
    console.log('🎬 Demo Mode Started');
    resetData();

    for (let i = 0; i < config.demo.dataPoints; i++) {
        const reading = generator.generate();
        updateDashboard(reading);
    }

    demoInterval = setInterval(() => {
        const reading = generator.generate();
        updateDashboard(reading);
        updateTrends();
    }, config.demo.updateInterval);
}

function stopDemo() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
    }
}

function resetData() {
    Object.keys(data).forEach(key => data[key] = []);
}

// ================================================================
// THINGSBOARD CONNECTION
// ================================================================
function connectThingsBoard() {
    try {
        console.log("🔌 Connecting to ThingsBoard...");
        const wsUrl = `${config.thingsboardWsHost}?token=${config.deviceToken}`;
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log("✅ Connected");
            websocket.send(JSON.stringify({
                tsSubCmds: [{
                    entityType: "DEVICE",
                    entityId: config.deviceId,
                    scope: "LATEST_TELEMETRY",
                    cmdId: 1
                }]
            }));
        };

        websocket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.data) processLiveData(msg.data);
        };

        websocket.onerror = () => console.error("❌ Error");
        websocket.onclose = () => console.log("🔌 Disconnected");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

function processLiveData(d) {
    const reading = {
        voltage: d.panel_voltage?.[0]?.value || 0,
        current: d.current?.[0]?.value || 0,
        temperature: d.temperature?.[0]?.value || 0,
        battery: d.battery_voltage?.[0]?.value || 0,
        irradiance: d.brightness?.[0]?.value || 0,
        power: 0,
        timestamp: new Date()
    };
    reading.power = reading.voltage * reading.current;
    updateDashboard(reading);
}

// ================================================================
// DATA UPDATE
// ================================================================
function updateDashboard(reading) {
    const time = reading.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    data.timestamps.push(time);
    data.voltage.push(reading.voltage);
    data.current.push(reading.current);
    data.power.push(reading.power);
    data.temperature.push(reading.temperature);
    data.battery.push(reading.battery);
    data.irradiance.push(reading.irradiance);

    const maxPoints = config.demo.dataPoints;
    if (data.timestamps.length > maxPoints) {
        Object.keys(data).forEach(key => data[key].shift());
    }

    updateUI(reading);
    updateCharts();
    updateBatteryGauge(reading.battery);
}

function updateUI(r) {
    const updates = {
        'voltage-value': r.voltage.toFixed(2) + ' V',
        'current-value': r.current.toFixed(2) + ' A',
        'power-value': r.power.toFixed(2) + ' W',
        'temperature-value': r.temperature.toFixed(1) + ' °C',
        'battery-value': r.battery.toFixed(2) + ' V',
        'irradiance-value': r.irradiance.toFixed(0) + ' W/m²'
    };

    Object.entries(updates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function updateTrends() {
    const trends = {
        'voltage-trend': generator.calculateTrend(data.voltage),
        'current-trend': generator.calculateTrend(data.current),
        'power-trend': generator.calculateTrend(data.power),
        'temperature-trend': generator.calculateTrend(data.temperature)
    };

    Object.entries(trends).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const isPositive = value >= 0;
        el.textContent = `${isPositive ? '+' : ''}${value.toFixed(1)}%`;
        el.style.color = isPositive ? '#4ECDC4' : '#FF6B6B';
    });
}

// ================================================================
// CHARTS
// ================================================================
function initCharts() {
    const common = {
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

    const create = (id, label, colors) => {
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
            options: common
        });
    };

    charts.voltage = create('voltageChart', 'Voltage (V)', config.chartColors.voltage);
    charts.current = create('currentChart', 'Current (A)', config.chartColors.current);
    charts.power = create('powerChart', 'Power (W)', config.chartColors.power);

    const batteryCtx = document.getElementById('batteryGauge');
    if (batteryCtx) {
        charts.battery = new Chart(batteryCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [83, 17],
                    backgroundColor: [config.chartColors.battery[0], 'rgba(200, 200, 200, 0.2)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }
}

function updateCharts() {
    if (charts.voltage) {
        charts.voltage.data.labels = data.timestamps;
        charts.voltage.data.datasets[0].data = data.voltage;
        charts.voltage.update('none');
    }
    if (charts.current) {
        charts.current.data.labels = data.timestamps;
        charts.current.data.datasets[0].data = data.current;
        charts.current.update('none');
    }
    if (charts.power) {
        charts.power.data.labels = data.timestamps;
        charts.power.data.datasets[0].data = data.power;
        charts.power.update('none');
    }
}

function updateBatteryGauge(voltage) {
    if (!charts.battery) return;
    const percent = Math.min(100, Math.max(0, ((voltage - 11.0) / (14.4 - 11.0)) * 100));
    charts.battery.data.datasets[0].data = [percent, 100 - percent];
    charts.battery.update('none');

    const el = document.getElementById('battery-percent');
    if (el) el.textContent = percent.toFixed(0) + '%';
}

// ================================================================
// INITIALIZATION
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 EcoVision Pro Starting...");
    initCharts();

    if (config.isDemoMode) {
        startDemo();
    } else {
        connectThingsBoard();
    }

    console.log("✅ Dashboard Ready!");
});

console.log("EcoVision Pro - Enhanced Dashboard Loaded");

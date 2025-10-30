// ================================================================
// EcoVision Pro - Professional Dashboard with Demo/Live Mode
// Realistic Demo Data with Fluctuating Graphs & Dynamic Trends
// ================================================================

// Configuration
const dashboardConfig = {
    // Mode selection
    isDemoMode: true, // Start in demo mode by default

    // ThingsBoard credentials (for live mode)
    deviceToken: "YycWv6Ad7iznPEk9HdT3",
    deviceId: "5c019fc0-a2c6-11f0-91df-7ffa16af2ee9",
    thingsboardWsHost: 'wss://thingsboard.cloud/api/ws/plugins/telemetry',

    // Demo data configuration
    demoConfig: {
        updateInterval: 2000, // Update every 2 seconds for smooth animation
        dataPointsToShow: 20,

        // Realistic ranges for demo data
        voltageRange: { min: 11.5, max: 14.8, baseline: 13.2 },
        currentRange: { min: 0.5, max: 18.5, baseline: 8.5 },
        temperatureRange: { min: 22, max: 48, baseline: 35 },
        irradianceRange: { min: 200, max: 1000, baseline: 650 },
        batteryRange: { min: 11.8, max: 14.2, baseline: 12.8 },

        // Daily pattern simulation (0-24 hours)
        solarCurvePattern: true, // Simulate day/night cycle
        currentHour: 12 // Start at noon for demo
    },

    // Live mode configuration
    liveConfig: {
        updateInterval: 5000,
        dataPointsToShow: 20
    },

    // Chart colors
    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)'],
        temperature: ['rgba(255, 99, 132, 0.8)', 'rgba(255, 159, 64, 0.8)'],
        battery: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 0.8)']
    }
};

// Global state
let websocket = null;
let demoInterval = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

// Charts
let voltageChart, currentChart, powerChart, batteryGauge;

// Data storage
const sensorData = {
    timestamps: [],
    voltage: [],
    current: [],
    power: [],
    temperature: [],
    battery: [],
    irradiance: []
};

// Demo statistics tracking
const demoStats = {
    totalEnergy: 2.4, // MWh
    co2Saved: 1.8, // Tons
    efficiency: 94.2, // %
    startTime: Date.now(),
    peakPower: 0
};

// ================================================================
// DEMO MODE - REALISTIC DATA GENERATOR
// ================================================================

class DemoDataGenerator {
    constructor() {
        this.timeOffset = 0;
        this.noiseFactors = {
            voltage: 0,
            current: 0,
            temperature: 0
        };
    }

    // Simulate solar irradiance curve (day/night cycle)
    getSolarFactor() {
        const hour = dashboardConfig.demoConfig.currentHour;

        // Bell curve for sunlight: peaks at noon (12), zero at night
        if (hour < 6 || hour > 20) return 0.05; // Night
        if (hour >= 6 && hour < 8) return (hour - 6) * 0.25; // Sunrise
        if (hour >= 8 && hour < 11) return 0.5 + (hour - 8) * 0.15; // Morning
        if (hour >= 11 && hour <= 13) return 0.95 + Math.random() * 0.05; // Peak
        if (hour > 13 && hour <= 17) return 0.95 - (hour - 13) * 0.12; // Afternoon
        if (hour > 17 && hour <= 20) return 0.4 - (hour - 17) * 0.12; // Sunset

        return 0.5;
    }

    // Add realistic noise and trends
    addNoise(value, range, factor = 0.05) {
        const noise = (Math.random() - 0.5) * (range.max - range.min) * factor;
        return Math.max(range.min, Math.min(range.max, value + noise));
    }

    // Generate realistic sensor readings
    generateReading() {
        const solarFactor = this.getSolarFactor();
        const cloudFactor = 0.85 + Math.random() * 0.15; // Random cloud cover

        // Voltage: relatively stable with small fluctuations
        const voltage = this.addNoise(
            dashboardConfig.demoConfig.voltageRange.baseline,
            dashboardConfig.demoConfig.voltageRange,
            0.03
        );

        // Current: varies with solar irradiance
        const baseCurrent = dashboardConfig.demoConfig.currentRange.baseline * solarFactor * cloudFactor;
        const current = this.addNoise(
            baseCurrent,
            dashboardConfig.demoConfig.currentRange,
            0.08
        );

        // Temperature: increases with solar exposure
        const baseTemp = dashboardConfig.demoConfig.temperatureRange.baseline + (solarFactor * 8);
        const temperature = this.addNoise(
            baseTemp,
            dashboardConfig.demoConfig.temperatureRange,
            0.04
        );

        // Irradiance: direct solar measurement
        const baseIrradiance = dashboardConfig.demoConfig.irradianceRange.baseline * solarFactor * cloudFactor;
        const irradiance = this.addNoise(
            baseIrradiance,
            dashboardConfig.demoConfig.irradianceRange,
            0.1
        );

        // Battery: slowly charges during day, discharges at night
        const batteryTrend = solarFactor > 0.3 ? 0.002 : -0.001;
        const battery = this.addNoise(
            dashboardConfig.demoConfig.batteryRange.baseline + batteryTrend,
            dashboardConfig.demoConfig.batteryRange,
            0.01
        );

        // Calculate power
        const power = voltage * current;

        // Update peak power
        if (power > demoStats.peakPower) demoStats.peakPower = power;

        // Increment time (advance 15 minutes per update for day cycle)
        this.timeOffset += 0.25;
        if (this.timeOffset >= 1) {
            dashboardConfig.demoConfig.currentHour = (dashboardConfig.demoConfig.currentHour + 1) % 24;
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

    // Calculate dynamic trend percentage
    calculateTrend(currentValue, historicalValues) {
        if (historicalValues.length < 5) return 0;

        const recentAvg = historicalValues.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const olderAvg = historicalValues.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

        if (olderAvg === 0) return 0;

        const trend = ((recentAvg - olderAvg) / olderAvg) * 100;
        return parseFloat(trend.toFixed(1));
    }

    // Calculate cumulative energy
    calculateEnergy() {
        if (sensorData.power.length === 0) return demoStats.totalEnergy;

        // Simulate energy accumulation (kWh per update)
        const avgPower = sensorData.power.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const energyIncrement = (avgPower / 1000) * (dashboardConfig.demoConfig.updateInterval / 3600000);

        demoStats.totalEnergy += energyIncrement;
        return demoStats.totalEnergy;
    }

    // Calculate CO2 savings (0.5 kg per kWh)
    calculateCO2() {
        demoStats.co2Saved = demoStats.totalEnergy * 0.5;
        return demoStats.co2Saved;
    }

    // Calculate system efficiency
    calculateEfficiency() {
        if (sensorData.power.length === 0) return demoStats.efficiency;

        const latestPower = sensorData.power[sensorData.power.length - 1];
        const latestIrradiance = sensorData.irradiance[sensorData.irradiance.length - 1];

        if (latestIrradiance < 100) return demoStats.efficiency;

        // Efficiency = (Power / (Irradiance * Panel Area)) * 100
        const panelArea = 1.5; // m²
        const efficiency = (latestPower / (latestIrradiance * panelArea)) * 100;

        // Apply realistic limits and smoothing
        demoStats.efficiency = Math.max(85, Math.min(98, efficiency * 0.3 + demoStats.efficiency * 0.7));
        return parseFloat(demoStats.efficiency.toFixed(1));
    }
}

const demoGenerator = new DemoDataGenerator();

// ================================================================
// MODE SWITCHING
// ================================================================

function toggleMode() {
    dashboardConfig.isDemoMode = !dashboardConfig.isDemoMode;

    const modeToggle = document.getElementById('mode-toggle');
    const modeLabel = document.getElementById('mode-label');
    const modeIndicator = document.getElementById('mode-indicator');

    if (dashboardConfig.isDemoMode) {
        modeLabel.textContent = 'Demo Mode';
        modeIndicator.className = 'mode-indicator demo';
        modeToggle.checked = false;

        // Stop live connection
        if (websocket) {
            websocket.close();
            websocket = null;
        }

        // Start demo
        startDemoMode();

        showNotification('Demo Mode Activated', 'Showing simulated solar panel data', 'info');
    } else {
        modeLabel.textContent = 'Live Mode';
        modeIndicator.className = 'mode-indicator live';
        modeToggle.checked = true;

        // Stop demo
        stopDemoMode();

        // Start live connection
        connectToThingsBoard();

        showNotification('Live Mode Activated', 'Connecting to real device...', 'success');
    }
}

function startDemoMode() {
    console.log('🎬 Starting Demo Mode with realistic fluctuating data...');

    // Clear existing data
    resetSensorData();

    // Generate initial data points
    for (let i = 0; i < dashboardConfig.demoConfig.dataPointsToShow; i++) {
        const reading = demoGenerator.generateReading();
        updateDashboardWithData(reading);
    }

    // Start continuous updates
    demoInterval = setInterval(() => {
        const reading = demoGenerator.generateReading();
        updateDashboardWithData(reading);
        updateStatistics();
    }, dashboardConfig.demoConfig.updateInterval);

    console.log('✅ Demo Mode active - data updating every 2 seconds');
}

function stopDemoMode() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
        console.log('⏸️ Demo Mode stopped');
    }
}

function resetSensorData() {
    sensorData.timestamps = [];
    sensorData.voltage = [];
    sensorData.current = [];
    sensorData.power = [];
    sensorData.temperature = [];
    sensorData.battery = [];
    sensorData.irradiance = [];
}

// ================================================================
// THINGSBOARD LIVE CONNECTION
// ================================================================

function connectToThingsBoard() {
    try {
        console.log("🔌 Connecting to ThingsBoard WebSocket...");

        const wsUrl = `${dashboardConfig.thingsboardWsHost}?token=${dashboardConfig.deviceToken}`;
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log("✅ Successfully connected to ThingsBoard!");
            reconnectAttempts = 0;
            updateConnectionStatus(true, "Connected to Live Device");
            subscribeToTelemetry();
        };

        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
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
            if (!dashboardConfig.isDemoMode && reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(connectToThingsBoard, 5000);
            }
        };

    } catch (error) {
        console.error("❌ Connection Error:", error);
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
            }]
        };
        websocket.send(JSON.stringify(subscriptionCommand));
    }
}

function processThingsBoardData(data) {
    const mappedData = {
        voltage: data.panel_voltage?.[0]?.value || 0,
        current: data.current?.[0]?.value || 0,
        temperature: data.temperature?.[0]?.value || 0,
        battery: data.battery_voltage?.[0]?.value || 0,
        irradiance: data.brightness?.[0]?.value || 0,
        power: 0,
        timestamp: new Date()
    };

    mappedData.power = mappedData.voltage * mappedData.current;
    updateDashboardWithData(mappedData);
    updateStatistics();
}

// [CONTINUED IN NEXT PART...]
// ================================================================
// UI UPDATES & STATISTICS
// ================================================================

function updateDashboardWithData(data) {
    // Add to historical data
    const timestamp = data.timestamp.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    sensorData.timestamps.push(timestamp);
    sensorData.voltage.push(data.voltage);
    sensorData.current.push(data.current);
    sensorData.power.push(data.power);
    sensorData.temperature.push(data.temperature);
    sensorData.battery.push(data.battery);
    sensorData.irradiance.push(data.irradiance);

    // Keep only last N data points
    const maxPoints = dashboardConfig.isDemoMode ? 
        dashboardConfig.demoConfig.dataPointsToShow : 
        dashboardConfig.liveConfig.dataPointsToShow;

    if (sensorData.timestamps.length > maxPoints) {
        sensorData.timestamps.shift();
        sensorData.voltage.shift();
        sensorData.current.shift();
        sensorData.power.shift();
        sensorData.temperature.shift();
        sensorData.battery.shift();
        sensorData.irradiance.shift();
    }

    // Update UI
    updateMetricCards(data);
    updateCharts();
    updateBatteryGauge(data.battery);
}

function updateMetricCards(data) {
    // Update values
    updateElement('voltage-value', data.voltage.toFixed(2) + ' V');
    updateElement('current-value', data.current.toFixed(2) + ' A');
    updateElement('power-value', data.power.toFixed(2) + ' W');
    updateElement('temperature-value', data.temperature.toFixed(1) + ' °C');
    updateElement('irradiance-value', data.irradiance.toFixed(0) + ' W/m²');
    updateElement('battery-value', data.battery.toFixed(2) + ' V');

    // Calculate and update trends (dynamic +2.3%, etc.)
    if (sensorData.voltage.length >= 10) {
        const voltageTrend = demoGenerator.calculateTrend(data.voltage, sensorData.voltage);
        const currentTrend = demoGenerator.calculateTrend(data.current, sensorData.current);
        const powerTrend = demoGenerator.calculateTrend(data.power, sensorData.power);
        const tempTrend = demoGenerator.calculateTrend(data.temperature, sensorData.temperature);

        updateTrendBadge('voltage-trend', voltageTrend);
        updateTrendBadge('current-trend', currentTrend);
        updateTrendBadge('power-trend', powerTrend);
        updateTrendBadge('temperature-trend', tempTrend);
    }

    // Update last update time
    updateElement('last-update', `Updated: ${new Date().toLocaleTimeString()}`);
}

function updateTrendBadge(elementId, trendValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const isPositive = trendValue >= 0;
    const icon = isPositive ? '↑' : '↓';
    const className = isPositive ? 'trend-positive' : 'trend-negative';

    element.textContent = `${icon} ${Math.abs(trendValue)}%`;
    element.className = `trend-badge ${className}`;
}

function updateStatistics() {
    if (dashboardConfig.isDemoMode) {
        const energy = demoGenerator.calculateEnergy();
        const co2 = demoGenerator.calculateCO2();
        const efficiency = demoGenerator.calculateEfficiency();

        updateElement('total-energy', energy.toFixed(1) + ' MWh');
        updateElement('co2-saved', co2.toFixed(1) + ' Tons');
        updateElement('system-efficiency', efficiency.toFixed(1) + '%');
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateConnectionStatus(connected, message) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = connected ? 'status-connected' : 'status-disconnected';
    }
}

// ================================================================
// CHARTS
// ================================================================

function initCharts() {
    console.log("📊 Initializing charts...");

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 750,
            easing: 'easeInOutQuart'
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#4ECDC4',
                borderWidth: 1,
                padding: 10,
                displayColors: false
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { 
                    color: '#fff', 
                    maxTicksLimit: 8,
                    font: { size: 10 }
                }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { 
                    color: '#fff',
                    font: { size: 10 }
                }
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
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
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
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
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
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
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
                animation: {
                    animateRotate: true,
                    animateScale: true
                },
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
    // Update Voltage Chart with animation
    if (voltageChart) {
        voltageChart.data.labels = sensorData.timestamps;
        voltageChart.data.datasets[0].data = sensorData.voltage;
        voltageChart.update('active');
    }

    // Update Current Chart
    if (currentChart) {
        currentChart.data.labels = sensorData.timestamps;
        currentChart.data.datasets[0].data = sensorData.current;
        currentChart.update('active');
    }

    // Update Power Chart
    if (powerChart) {
        powerChart.data.labels = sensorData.timestamps;
        powerChart.data.datasets[0].data = sensorData.power;
        powerChart.update('active');
    }
}

function updateBatteryGauge(voltage) {
    if (!batteryGauge) return;

    // Convert voltage to percentage (12V system: 11V=0%, 14.4V=100%)
    const minVoltage = 11.0;
    const maxVoltage = 14.4;
    const percentage = Math.min(100, Math.max(0, 
        ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100
    ));

    batteryGauge.data.datasets[0].data = [percentage, 100 - percentage];

    // Dynamic color based on level
    if (percentage > 60) {
        batteryGauge.data.datasets[0].backgroundColor[0] = '#4ECDC4';
    } else if (percentage > 30) {
        batteryGauge.data.datasets[0].backgroundColor[0] = '#FFE66D';
    } else {
        batteryGauge.data.datasets[0].backgroundColor[0] = '#FF6B6B';
    }

    batteryGauge.update('active');

    // Update percentage text
    updateElement('battery-percent', percentage.toFixed(0) + '%');
}

// ================================================================
// NOTIFICATIONS
// ================================================================

function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ================================================================
// INITIALIZATION
// ================================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 EcoVision Pro Dashboard Starting...");

    // Initialize charts
    initCharts();

    // Set up mode toggle
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
        modeToggle.addEventListener('change', toggleMode);
    }

    // Start in demo mode by default
    if (dashboardConfig.isDemoMode) {
        startDemoMode();
        updateConnectionStatus(true, "Demo Mode Active");
    } else {
        connectToThingsBoard();
    }

    console.log("✅ Dashboard initialized successfully!");
    showNotification('Welcome!', 'EcoVision Pro Dashboard Loaded', 'success');
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log("📴 Page hidden");
    } else {
        console.log("👁️ Page visible");
        if (!dashboardConfig.isDemoMode && !websocket) {
            connectToThingsBoard();
        }
    }
});

// Debug tools
if (typeof window !== 'undefined') {
    window.ecoVisionDebug = {
        config: dashboardConfig,
        data: sensorData,
        stats: demoStats,
        toggleMode: toggleMode,
        demoGenerator: demoGenerator
    };
}

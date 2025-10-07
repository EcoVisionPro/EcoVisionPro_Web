// Configuration for the dashboard
const dashboardConfig = {
    // ---- IMPORTANT: Replace with your backend's URL and API Key ----
    backendApiUrl: 'http://192.168.39.224:5000', // The URL of your Python Flask server
    apiKey: 'Str0ngS3cr3tKey_For_My_API_123!',     // The API key from your .env file

    // ---- IMPORTANT: Replace with your ThingsBoard WebSocket host ----
    thingsboardWsHost: 'ws://192.168.39.224:8080/api/ws/plugins/telemetry', // Use 'ws://' not 'http://'. Change if your ThingsBoard is elsewhere.

    dataPointsToShow: 20,
    chartColors: {
        voltage: ['rgba(0, 210, 255, 0.9)', 'rgba(58, 123, 213, 0.75)', 'rgba(251, 194, 235, 0.73)'],
        current: ['rgba(253, 194, 194, 1)', 'rgba(247, 151, 30, 0.8)', 'rgba(255, 210, 0, 0.8)'],
        power: ['rgba(255, 210, 0, 0.8)', 'rgba(43, 195, 168, 0.75)', 'rgba(121, 196, 241, 0.63)']
    }
};

// Global variables for charts and data
let voltageChart, currentChart, powerChart, batteryGauge;
const sensorData = { labels: [], voltage: [], current: [], power: [] };

//
// --- Step 1: Fetch the secure token from our backend ---
//
async function getThingsboardToken() {
    try {
        const response = await fetch(`${dashboardConfig.backendApiUrl}/api/ws-token`, {
            headers: { 'X-API-Key': dashboardConfig.apiKey }
        });
        if (!response.ok) {
            throw new Error('Failed to get WebSocket token from backend.');
        }
        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error("Authentication Error:", error);
        showAlert("Error: Could not authenticate with the backend.");
        return null;
    }
}

//
// --- Step 2: Connect to ThingsBoard using MQTT over WebSockets ---
//
async function connectToMqtt() {
    const token = await getThingsboardToken();
    if (!token) return;

    const wsUrl = `${dashboardConfig.thingsboardWsHost}/api/ws/plugins/telemetry?token=${token}`;
    const client = mqtt.connect(wsUrl);

    client.on('connect', () => {
        console.log('Successfully connected to ThingsBoard via WebSocket!');
        showAlert("Live connection established!", "success");

        // ThingsBoard WebSocket subscription is done by sending a JSON command
        const subscriptionCommand = {
            tsSubCmds: [
                {
                    entityType: "DEVICE",
                    entityId: "1bf49380-9d60-11f0-9924-03351eea895f", // IMPORTANT: Get this from your .env file or ThingsBoard UI
                    scope: "LATEST_TELEMETRY",
                    cmdId: 1
                }
            ]
        };
        // The topic for sending commands is 'v1/devices/me/telemetry' but here we just stringify the command
        client.publish('v1/devices/me/telemetry', JSON.stringify(subscriptionCommand));
    });

    //
    // --- Step 3: Handle incoming messages ---
    //
    client.on('message', (topic, message) => {
        const data = JSON.parse(message.toString());
        // Check if it's a telemetry update
        if (data && data.data) {
            console.log('Received telemetry:', data.data);
            const latestData = processIncomingData(data.data);
            updateDashboard(latestData);
        }
    });

    client.on('error', (err) => {
        console.error('Connection error:', err);
        showAlert("Connection error. Please check the console.");
        client.end();
    });
}

// This function converts the ThingsBoard data format to what our dashboard expects
function processIncomingData(tbData) {
    const processed = {};
    for (const key in tbData) {
        // The value is in an array, e.g., [timestamp, "value"]
        processed[key] = tbData[key][0][1];
    }
    return processed;
}


//
// --- Dashboard Update Functions (Mostly the same as before) ---
//

function updateDashboard(data) {
    if (!data.voltage) return; // Don't update if data is incomplete
    updateMetricCards(data);
    updateCharts(data);
    updateBatteryStatus(data); // Assuming battery data comes from battery_voltage
    manageAlerts(data);
}

function updateMetricCards(data) {
    document.getElementById('current-voltage').textContent = `${data.voltage} V`;
    document.getElementById('current-current').textContent = `${data.current} A`;
    document.getElementById('current-power').textContent = `${data.power_output} W`;
    document.getElementById('current-temperature').textContent = `${data.temperature}°C`;
    document.getElementById('current-irradiance').textContent = `${data.irradiance} W/m²`;
    document.getElementById('env-temperature').textContent = `${data.temperature}°C`;
}

function updateCharts(data) {
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    
    sensorData.labels.push(timeLabel);
    sensorData.voltage.push(parseFloat(data.voltage));
    sensorData.current.push(parseFloat(data.current));
    sensorData.power.push(parseFloat(data.power_output));

    if (sensorData.labels.length > dashboardConfig.dataPointsToShow) {
        sensorData.labels.shift();
        sensorData.voltage.shift();
        sensorData.current.shift();
        sensorData.power.shift();
    }

    voltageChart.data.labels = [...sensorData.labels];
    voltageChart.data.datasets[0].data = [...sensorData.voltage];
    voltageChart.update('none');

    currentChart.data.labels = [...sensorData.labels];
    currentChart.data.datasets[0].data = [...sensorData.current];
    currentChart.update('none');

    powerChart.data.labels = [...sensorData.labels];
    powerChart.data.datasets[0].data = [...sensorData.power];
    powerChart.update('none');
}

function updateBatteryStatus(data) {
    const batteryVoltage = parseFloat(data.battery_voltage);
    // Simple mapping: 12.0V = 0%, 12.6V = 100%
    const percentage = Math.round(Math.max(0, Math.min(100, (batteryVoltage - 12.0) / 0.6 * 100)));

    batteryGauge.data.datasets[0].data[0] = percentage;
    batteryGauge.data.datasets[0].data[1] = 100 - percentage;
    batteryGauge.update('none');

    document.getElementById('battery-percentage').textContent = `${percentage}%`;
    document.getElementById('battery-voltage-display').textContent = `${batteryVoltage} V`;
    document.getElementById('battery-progress').style.width = `${percentage}%`;
}


function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-custom';
    alertContainer.innerHTML = `<div class='alert ${alertClass} animate__animated animate__fadeIn'>${message}</div>`;
}

function manageAlerts(data) {
    const alertContainer = document.getElementById('alert-container');
    const voltage = parseFloat(data.voltage);
    const batteryVoltage = parseFloat(data.battery_voltage);
    
    // Clear old alerts if they are not critical anymore
    alertContainer.innerHTML = '';
    
    if (voltage < 12.0) {
        showAlert(`Low System Voltage: ${voltage}V`);
    }
    if (batteryVoltage < 12.1) {
        showAlert(`Low Battery Voltage: ${batteryVoltage}V`);
    }
}

// Initialize all the charts (same as before)
function initializeCharts() {
    // ... (This function remains exactly the same as in your original file)
    // Voltage Chart
    voltageChart = new Chart(document.getElementById('voltageChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'Voltage', data: [], borderColor: dashboardConfig.chartColors.voltage[0], backgroundColor: dashboardConfig.chartColors.voltage[2], pointBackgroundColor: dashboardConfig.chartColors.voltage[1], pointBorderColor: '#fff', borderWidth: 3, pointRadius: 4, fill: true, }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: { x: { grid: {color:'#ffd2007c'}, ticks: {color:'#007bff',font:{size:12}}, }, y: { min:11,max:15,grid:{color:'#00d2ff7c'},ticks:{color:'#00d2ff',font:{size:12},callback:v=>`${v}V`} }, } }
    });
    // Current Chart
    currentChart = new Chart(document.getElementById('currentChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'Current', data: [], borderColor: dashboardConfig.chartColors.current[0], backgroundColor: dashboardConfig.chartColors.current[2], pointBackgroundColor: dashboardConfig.chartColors.current[1], pointBorderColor: '#fff', borderWidth: 3, pointRadius: 4, fill: true, }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: { x: {grid: {color:'#ffd2007c'}, ticks: {color:'#f7971e',font:{size:12}}}, y: {min:0,max:25,grid:{color:'#fdc2c27c'},ticks:{color:'#f7971e',font:{size:12},callback:v=>`${v}A`}} } }
    });
    // Power Chart
    powerChart = new Chart(document.getElementById('powerChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'Power', data: [], borderColor: dashboardConfig.chartColors.power[0], backgroundColor: dashboardConfig.chartColors.power[2], pointBackgroundColor: dashboardConfig.chartColors.power[1], pointBorderColor: '#fff', borderWidth: 3, pointRadius: 4, fill: true, }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: { x: {grid: {color:'#ffd2007c'},ticks:{color:'#00d2ff',font:{size:12}}}, y: {min:0,max:400,grid:{color:'#00d2ff33'},ticks:{color:'#ffd200',font:{size:12},callback:v=>`${v}W`}} } }
    });
    // Battery Gauge
    batteryGauge = new Chart(document.getElementById('batteryGauge').getContext('2d'), {
        type: 'doughnut', data: { datasets: [{ data: [0, 100], backgroundColor: ['#00d2ff', '#fbc2eb'], borderWidth: 0, cutout: '73%' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: {legend: {display: !1}, tooltip: {enabled: !1}} }
    });
}


//
// --- Main entry point when the page loads ---
//
window.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    connectToMqtt();
});
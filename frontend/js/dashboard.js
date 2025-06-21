// Dashboard JavaScript file for handling dashboard functionality

let allMachines = [];
let currentPredictionMachineId = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication before loading dashboard
    checkDashboardAuth();
    
    // Initialize dashboard functionality
    initDashboard();
});

function checkDashboardAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        // User is not authenticated, redirect to sign in
        window.location.href = '/signin';
        return;
    }
    
    // Set user name from localStorage as fallback
    setUserName(user);
    
    // Verify token with server
    verifyToken(token);
}

async function verifyToken(token) {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            // Token is invalid, clear storage and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/signin';
            return;
        }
        
        // Token is valid, update user info
        localStorage.setItem('user', JSON.stringify(data.user));
        displayUserInfo(data.user);
        
    } catch (error) {
        console.error('Token verification error:', error);
        // Network error, but we'll still show the dashboard
        // The user can continue using the app
    }
}

function displayUserInfo(user) {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement && user) {
        userInfoElement.innerHTML = `
            <div class="user-detail"><strong>Name:</strong> ${user.firstName} ${user.lastName}</div>
            <div class="user-detail"><strong>Email:</strong> ${user.email}</div>
        `;
    }
    
    // Set user name in greeting
    setUserName(user);
}

function setUserName(user) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = `${user.firstName}`;
    }
}

function initDashboard() {
    // Initialize logout functionality
    initLogout();
    
    // Add event listener for the refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showMessage('Refreshing dashboard data...', 'info');
            loadDashboardData();
        });
    }
    
    // Initialize dashboard navigation
    initDashboardNav();
    
    // Initialize hamburger menu
    initHamburgerMenu();
    
    // Initialize machine management
    initMachineManagement();
    
    // Load dashboard data (placeholder for future implementation)
    loadDashboardData();
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        });
    }
}

function initDashboardNav() {
    // Add active class to current nav item
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
    
    // Handle navigation clicks
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
        });
    });
}

function initHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
}

function initMachineManagement() {
    // Initialize add machine modal
    initAddMachineModal();

    // Initialize details modal
    const detailsModal = document.getElementById('machineDetailsModal');
    const closeDetailsBtn = document.getElementById('closeDetailsModal');
    if (detailsModal && closeDetailsBtn) {
        const closeModalFunc = () => detailsModal.classList.remove('show');
        closeDetailsBtn.addEventListener('click', closeModalFunc);
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                closeModalFunc();
            }
        });
    }

    // Initialize prediction modal
    const predictionModal = document.getElementById('predictionModal');
    const closePredictionBtn = document.getElementById('closePredictionModal');
    const cancelPredictionBtn = document.getElementById('cancelPrediction');
    const predictionForm = document.getElementById('predictionForm');

    if (predictionModal) {
        const closeModalFunc = () => predictionModal.classList.remove('show');
        closePredictionBtn.addEventListener('click', closeModalFunc);
        cancelPredictionBtn.addEventListener('click', closeModalFunc);
        predictionModal.addEventListener('click', (e) => {
            if (e.target === predictionModal) {
                closeModalFunc();
            }
        });
        predictionForm.addEventListener('submit', handlePrediction);
    }
}

function initAddMachineModal() {
    const modal = document.getElementById('addMachineModal');
    const addMachineBtn = document.getElementById('addMachineBtn');
    const addFirstMachineBtn = document.getElementById('addFirstMachineBtn');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelAddMachine');
    const form = document.getElementById('addMachineForm');

    const openModal = () => {
        if (modal) modal.classList.add('show');
    };

    const closeModalFunc = () => {
        if (modal) modal.classList.remove('show');
    };

    if (addMachineBtn) addMachineBtn.addEventListener('click', openModal);
    if (addFirstMachineBtn) addFirstMachineBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModalFunc);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalFunc);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalFunc();
            }
        });
    }

    if (form) {
        form.addEventListener('submit', handleAddMachine);
    }

    // Handle dynamic sensor inputs
    const addSensorBtn = document.getElementById('addSensorBtn');
    if (addSensorBtn) {
        addSensorBtn.addEventListener('click', addSensorInput);
    }

    // Add one sensor input by default
    addSensorInput();
}

let sensorCount = 0;
function addSensorInput() {
    sensorCount++;
    const container = document.getElementById('sensorConfigContainer');
    const newSensorRow = document.createElement('div');
    newSensorRow.classList.add('sensor-row');
    newSensorRow.setAttribute('data-id', sensorCount);

    newSensorRow.innerHTML = `
        <div class="form-group">
            <label for="sensorName${sensorCount}">Sensor Name (e.g., Temperature, Pressure)</label>
            <input type="text" id="sensorName${sensorCount}" name="sensorName" placeholder="Main Pump Temperature" required>
        </div>
        <div class="form-group">
            <label for="sensorUnit${sensorCount}">Sensor Units (e.g., C, PSI)</label>
            <input type="text" id="sensorUnit${sensorCount}" name="sensorUnit" placeholder="Celsius" required>
        </div>
        <button type="button" class="remove-sensor-btn" onclick="this.parentElement.remove()">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    container.appendChild(newSensorRow);
}

function showFormError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const formGroup = field.closest('.form-group');
    if (!formGroup) return;
    
    formGroup.classList.add('error');
    
    let errorElement = formGroup.querySelector('.form-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        formGroup.appendChild(errorElement);
    }
    errorElement.textContent = message;
}

function clearFormErrors() {
    document.querySelectorAll('#addMachineForm .form-group.error').forEach(group => {
        group.classList.remove('error');
        const errorElement = group.querySelector('.form-error');
        if (errorElement) errorElement.textContent = '';
    });
}

function validateForm() {
    clearFormErrors();
    let isValid = true;
    const requiredFields = ['machineName', 'machineType', 'model', 'serialNumber', 'scadaSystem', 'trainingData'];

    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const isFile = field.type === 'file';
        const isEmpty = isFile ? field.files.length === 0 : field.value.trim() === '';

        if (isEmpty) {
            showFormError(fieldId, 'This field is required.');
            isValid = false;
        }
    });
    return isValid;
}

async function handleAddMachine(e) {
    e.preventDefault();
    if (!validateForm()) {
        showMessage('Please fill out all required fields.', 'error');
        return;
    }

    const form = document.getElementById('addMachineForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    progressContainer.style.display = 'block';

    try {
        const formData = new FormData(form);
        const machineData = {};
        // Regular fields
        for (const [key, value] of formData.entries()) {
            if (key !== 'trainingData' && key !== 'sensorName' && key !== 'sensorUnit') {
                machineData[key] = value;
            }
        }

        // Sensor fields
        machineData.sensors = [];
        const sensorRows = document.querySelectorAll('#sensorConfigContainer .sensor-row');
        sensorRows.forEach((row, index) => {
            const name = row.querySelector('input[name="sensorName"]').value;
            const unit = row.querySelector('input[name="sensorUnit"]').value;
            if (name && unit) {
                 machineData.sensors.push({
                    sensorId: `sensor_${index + 1}`, // Corresponds to CSV column headers
                    name: name,
                    type: name, // Using name as type for simplicity
                    unit: unit
                });
            }
        });
        
        const trainingFile = formData.get('trainingData');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/dashboard/add-machine', true);
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);

        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = percentComplete + '%';
            }
        };

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    showMessage('Machine added successfully! Model training has started.', 'success');
                    document.getElementById('addMachineModal').classList.remove('show');
                    form.reset();
                    setTimeout(loadDashboardData, 1000);
                } else {
                    showMessage(result.message || 'Failed to add machine.', 'error');
                }
            } else {
                 try {
                    const result = JSON.parse(xhr.responseText);
                    showMessage(result.message || `An error occurred: ${xhr.statusText}`, 'error');
                } catch (e) {
                    showMessage(`An error occurred: ${xhr.statusText}`, 'error');
                }
            }
            
            // Reset and hide progress bar
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressText.textContent = '0%';

            // Re-enable button
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        };

        xhr.onerror = function() {
            showMessage('A network error occurred. Please try again.', 'error');
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        };
        
        const payload = new FormData();
        payload.append('machineData', JSON.stringify(machineData));
        if (trainingFile) {
            payload.append('trainingData', trainingFile, trainingFile.name);
        }
        xhr.send(payload);

    } catch (error) {
        console.error('Error adding machine:', error);
        showMessage('An error occurred. Please try again.', 'error');
        progressContainer.style.display = 'none';
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

function showMessage(message, type = 'info') {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to dashboard
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.insertBefore(messageElement, dashboardContainer.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            messageElement.remove();
        }, 5000);
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/data', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const result = await response.json();
        
        if (result.success) {
            allMachines = result.data.machines;
            displayDashboardData(result.data);
        } else {
            console.error('Failed to load dashboard data:', result.message);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function displayDashboardData(data) {
    // Update user name in greeting
    const userNameElement = document.getElementById('userName');
    if (userNameElement && data.user) {
        userNameElement.textContent = data.user.name;
    }
    
    // Update overview cards
    const totalMachinesElement = document.getElementById('totalMachines');
    if (totalMachinesElement && data.stats) {
        totalMachinesElement.textContent = data.stats.totalMachines;
    }
    
    const alertsCountElement = document.getElementById('alertsCount');
    if (alertsCountElement && data.stats) {
        alertsCountElement.textContent = data.stats.warningMachines + data.stats.criticalMachines;
    }
    
    const healthyMachinesElement = document.getElementById('healthyMachines');
    if (healthyMachinesElement && data.stats) {
        healthyMachinesElement.textContent = data.stats.healthyMachines;
    }
    
    const avgRULElement = document.getElementById('avgRUL');
    if (avgRULElement && data.stats) {
        avgRULElement.textContent = data.stats.averageHealthScore > 0 ? 
            Math.round(data.stats.averageHealthScore) : 0;
    }
    
    // Display machines
    displayMachines(data.machines);
    
    // Display alerts in activity section
    displayAlerts(data.alerts);
}

function displayMachines(machines) {
    const machinesContainer = document.getElementById('machineList');
    if (!machinesContainer) return;
    
    if (machines.length === 0) {
        machinesContainer.innerHTML = `
            <div class="no-machines">
                <i class="fas fa-cogs"></i>
                <h3>No machines added yet</h3>
                <p>Add your first machine to start monitoring with anomaly detection</p>
                <button class="btn btn-primary" id="addFirstMachineBtn">
                    <i class="fas fa-plus"></i>
                    Add Machine
                </button>
            </div>
        `;
        
        // Re-initialize the add machine button
        const addFirstMachineBtn = document.getElementById('addFirstMachineBtn');
        if (addFirstMachineBtn) {
            addFirstMachineBtn.addEventListener('click', () => {
                document.getElementById('addMachineModal').classList.add('show');
            });
        }
        return;
    }
    
    machinesContainer.innerHTML = machines.map(machine => `
        <div class="machine-card ${machine.status || 'healthy'}">
            <div class="machine-header">
                <h3>${machine.name}</h3>
                <div class="machine-badges">
                    <span class="status-badge ${machine.status || 'N/A'}">${machine.status || 'N/A'}</span>
                    <span class="criticality-badge ${machine.criticality}">${machine.criticality}</span>
                </div>
            </div>
            <div class="machine-details">
                <div class="detail-row">
                    <div class="detail-item">
                        <span class="label">Type:</span>
                        <span class="value">${machine.type.replace('_', ' ')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">SCADA:</span>
                        <span class="value">${machine.scadaSystem || 'N/A'}</span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-item">
                        <span class="label">Location:</span>
                        <span class="value">${machine.location}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Health Score:</span>
                        <span class="value health-score">${machine.healthScore}%</span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-item">
                        <span class="label">RUL Estimate:</span>
                        <span class="value">${machine.rulEstimate} days</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Last Updated:</span>
                        <span class="value">${new Date(machine.lastUpdated).toLocaleString()}</span>
                    </div>
                </div>
            </div>
            <div class="machine-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewMachineDetails('${machine.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn btn-primary btn-sm" onclick="viewAnomalyData('${machine.id}')">
                    <i class="fas fa-chart-line"></i> Anomaly Data
                </button>
            </div>
        </div>
    `).join('');
}

function displayAlerts(alerts) {
    const alertsContainer = document.getElementById('activityList');
    if (!alertsContainer) return;
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="activity-content">
                    <p>No active alerts - All machines are operating normally</p>
                    <span class="activity-time">Just now</span>
                </div>
            </div>
        `;
        return;
    }
    
    alertsContainer.innerHTML = alerts.map(alert => `
        <div class="activity-item">
            <div class="activity-icon ${alert.type}">
                <i class="fas fa-${alert.type === 'critical' ? 'exclamation-triangle' : 'exclamation-circle'}"></i>
            </div>
            <div class="activity-content">
                <p><strong>${alert.machineName}</strong>: ${alert.message}</p>
                <span class="activity-time">${new Date(alert.timestamp).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

function viewMachineDetails(machineId) {
    const machine = allMachines.find(m => m.id === machineId);
    if (!machine) {
        showMessage('Could not find machine details.', 'error');
        return;
    }

    const modalTitle = document.getElementById('detailsModalTitle');
    const modalBody = document.getElementById('machineDetailsBody');
    const modal = document.getElementById('machineDetailsModal');

    modalTitle.textContent = `Details for ${machine.name}`;
    
    // Helper to create detail pairs
    const createDetail = (label, value) => {
        const val = value || 'N/A';
        return `<div class="detail-pair"><span class="label">${label}</span><span class="value">${val}</span></div>`;
    };

    modalBody.innerHTML = `
        <div class="details-grid">
            <div class="details-section">
                <h3><i class="fas fa-cogs"></i> Identification</h3>
                ${createDetail('Machine Type', machine.type)}
                ${createDetail('Manufacturer', machine.manufacturer)}
                ${createDetail('Model', machine.model)}
                ${createDetail('Serial Number', machine.serialNumber)}
                ${createDetail('Asset Tag', machine.assetTag)}
            </div>
            <div class="details-section">
                <h3><i class="fas fa-network-wired"></i> SCADA & PLC</h3>
                ${createDetail('SCADA System', machine.scadaSystem)}
                ${createDetail('SCADA Version', machine.scadaVersion)}
                ${createDetail('PLC Type', machine.plcType)}
                ${createDetail('Protocol', machine.communicationProtocol)}
                ${createDetail('IP Address', machine.ipAddress)}
                ${createDetail('Port', machine.port)}
            </div>
            <div class="details-section">
                <h3><i class="fas fa-info-circle"></i> Status & Health</h3>
                ${createDetail('Status', machine.status)}
                ${createDetail('Health Score', machine.healthScore + '%')}
                ${createDetail('RUL Estimate', machine.rulEstimate + ' days')}
                ${createDetail('Last Updated', new Date(machine.lastUpdated).toLocaleString())}
            </div>
            <div class="details-section">
                <h3><i class="fas fa-tools"></i> Maintenance</h3>
                ${createDetail('Location', machine.location)}
                ${createDetail('Department', machine.department)}
                ${createDetail('Installation Date', machine.installationDate ? new Date(machine.installationDate).toLocaleDateString() : 'N/A')}
                ${createDetail('Last Maintenance', machine.lastMaintenance ? new Date(machine.lastMaintenance).toLocaleDateString() : 'N/A')}
            </div>
             <div class="details-section">
                <h3><i class="fas fa-brain"></i> AI Model</h3>
                ${createDetail('Model Status', machine.modelStatus)}
                ${createDetail('Last Trained', machine.lastTrained ? new Date(machine.lastTrained).toLocaleString() : 'N/A')}
                ${createDetail('Status Details', machine.statusDetails)}
            </div>
        </div>
    `;

    modal.classList.add('show');
}

function viewAnomalyData(machineId) {
    // Placeholder for anomaly data view
    console.log('Viewing anomaly data for:', machineId);
    // In a real application, this would show anomaly detection results
    // and training metrics
    showMessage('Anomaly detection data view coming soon!', 'info');
}

function openPredictionModal(machineId) {
    currentPredictionMachineId = machineId;
    const machine = allMachines.find(m => m.id === machineId);
    if (!machine) {
        showMessage('Could not find machine details.', 'error');
        return;
    }

    const modalTitle = document.getElementById('predictionModalTitle');
    const formBody = document.getElementById('predictionFormBody');
    const modal = document.getElementById('predictionModal');
    const resultContainer = document.getElementById('predictionResult');

    modalTitle.textContent = `Calculate Risk for ${machine.name}`;
    resultContainer.style.display = 'none';

    if (!machine.sensors || machine.sensors.length === 0) {
        formBody.innerHTML = `<p class="text-center">This machine has no configured sensors for prediction.</p>`;
    } else {
        formBody.innerHTML = machine.sensors.map(sensor => `
            <div class="form-group">
                <label for="sensor-${sensor.sensorId}">${sensor.name} (${sensor.unit})</label>
                <input type="number" step="any" id="sensor-${sensor.sensorId}" name="${sensor.sensorId}" required>
            </div>
        `).join('');
    }

    modal.classList.add('show');
}

async function handlePrediction(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const resultContainer = document.getElementById('predictionResult');
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const formData = new FormData(form);
        const sensorData = {};
        for (const [key, value] of formData.entries()) {
            sensorData[key] = parseFloat(value);
        }

        const response = await fetch(`/api/dashboard/machine/${currentPredictionMachineId}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ sensorData })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('riskScore').textContent = result.data.reconstruction_error.toFixed(4);
            document.getElementById('isAnomaly').textContent = result.data.is_anomaly ? 'Yes' : 'No';
            document.getElementById('anomalyThreshold').textContent = `(Threshold: ${result.data.threshold.toFixed(4)})`;
            resultContainer.style.display = 'block';
        } else {
            showMessage(result.message || 'Prediction failed.', 'error');
            resultContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Prediction error:', error);
        showMessage('An error occurred during prediction.', 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

// Utility function to format numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Utility function to format percentages
function formatPercentage(value, total) {
    if (total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
}

// Utility function to get status color
function getStatusColor(status) {
    const colors = {
        'healthy': '#10b981',
        'warning': '#f59e0b',
        'critical': '#ef4444',
        'maintenance': '#3b82f6',
        'offline': '#6b7280'
    };
    return colors[status] || '#6b7280';
}

// Export functions for use in other modules
window.viewMachineDetails = viewMachineDetails;
window.openPredictionModal = openPredictionModal;
window.dashboardUtils = {
    formatNumber,
    formatPercentage,
    getStatusColor,
    loadDashboardData
}; 
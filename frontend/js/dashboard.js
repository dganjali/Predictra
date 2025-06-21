// Dashboard JavaScript file for handling dashboard functionality

let allMachines = [];
let currentPredictionMachineId = null;

let machineConfig = {
    file: null,
    headers: [],
    selectedSensors: []
};

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
    
    // Initialize confirmation modal
    initConfirmationModal();
    
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

    // Event delegation for machine actions
    const machineList = document.getElementById('machineList');
    if (machineList) {
        machineList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === 'view-details') {
                viewMachineDetails(id);
            } else if (action === 'calculate-risk') {
                openPredictionModal(id);
            } else if (action === 'remove-machine') {
                handleRemoveMachine(id);
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
    if (!modal) return;

    const form = document.getElementById('addMachineForm');
    const cancelBtn = document.getElementById('cancelAddMachine');
    const closeModalBtn = document.getElementById('closeModal');
    
    const goToStep2Btn = document.getElementById('goToStep2');
    const backToStep1Btn = document.getElementById('backToStep1');
    const goToStep3Btn = document.getElementById('goToStep3');
    const backToStep2Btn = document.getElementById('backToStep2');
    
    const openModal = () => modal.classList.add('show');
    const closeModal = () => {
        modal.classList.remove('show');
        resetAddMachineModal();
    };

    document.getElementById('addMachineBtn').addEventListener('click', openModal);
    document.getElementById('addFirstMachineBtn')?.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    // Step navigation
    goToStep2Btn.addEventListener('click', handleGoToStep2);
    backToStep1Btn.addEventListener('click', () => navigateSteps(1));
    goToStep3Btn.addEventListener('click', handleGoToStep3);
    backToStep2Btn.addEventListener('click', () => navigateSteps(2));

    form.addEventListener('submit', handleAddMachine);
}

function navigateSteps(stepNumber) {
    document.querySelectorAll('.form-step').forEach(step => {
        step.style.display = 'none';
    });
    document.querySelector(`.form-step[data-step="${stepNumber}"]`).style.display = 'block';

    document.querySelectorAll('.modal-stepper .step').forEach(step => {
        step.classList.remove('active');
    });
    document.querySelector(`.modal-stepper .step[data-step="${stepNumber}"]`).classList.add('active');
}

async function handleGoToStep2() {
    const fileInput = document.getElementById('trainingData');
    machineConfig.file = fileInput.files[0];
    
    if (!document.getElementById('machineName').value || !document.getElementById('machineType').value) {
        showMessage('Please fill out the machine name and type.', 'error');
        return;
    }

    if (!machineConfig.file) {
        showMessage('Please select a training data file.', 'error');
        return;
    }

    navigateSteps(2);
    const headersContainer = document.getElementById('csvHeadersContainer');
    const spinner = headersContainer.querySelector('.spinner-container');
    const progressContainer = document.getElementById('csvLoadProgressContainer');
    const progressBar = document.getElementById('csvLoadProgressBar');
    const progressText = document.getElementById('csvLoadProgressText');
    
    if(spinner) spinner.style.display = 'none'; // Hide spinner if it exists
    progressContainer.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('trainingData', machineConfig.file);

        const response = await fetchWithProgress('/api/dashboard/get-csv-headers', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        }, progressBar, progressText);

        const result = await response.json();
        progressContainer.style.display = 'none';

        if (!response.ok || !result.success) {
            // Use the specific error message from the backend if available
            const errorMessage = result.message || `An error occurred: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        const headers = result.headers;
        machineConfig.headers = headers;
        displayCsvHeaders(headers);
    } catch (error) {
        console.error('Error in step 1:', error);
        alert(`Failed to process CSV file: ${error.message}`);
        resetAddMachineModal(); // Revert to step 1 on failure
    }
}

function displayCsvHeaders(headers) {
    const container = document.getElementById('csvHeadersContainer');
    // Clear everything, including a potential spinner
    container.innerHTML = headers.map(header => `
        <div class="sensor-checkbox-item">
            <input type="checkbox" id="sensor-header-${header}" name="selectedSensors" value="${header}">
            <label for="sensor-header-${header}">${header}</label>
        </div>
    `).join('');
}

function handleGoToStep3() {
    const selected = Array.from(document.querySelectorAll('#csvHeadersContainer input[type="checkbox"]:checked'))
                          .map(cb => cb.value);

    if (selected.length === 0) {
        showMessage('Please select at least one sensor column.', 'error');
        return;
    }
    
    machineConfig.selectedSensors = selected;
    displaySensorConfiguration(selected);
    navigateSteps(3);
}

function displaySensorConfiguration(sensors) {
    const container = document.getElementById('sensorConfigContainer');
    container.innerHTML = sensors.map((sensor, index) => `
        <div class="sensor-row">
            <div class="form-group">
                <label>CSV Column</label>
                <input type="text" value="${sensor}" disabled>
                <input type="hidden" name="sensorName" value="${sensor}">
            </div>
            <div class="form-group">
                <label for="sensorDisplayName${index}">Display Name</label>
                <input type="text" id="sensorDisplayName${index}" name="sensorDisplayName" value="${sensor}" placeholder="e.g., Main Pump Temperature" required>
            </div>
            <div class="form-group">
                <label for="sensorUnit${index}">Unit</label>
                <input type="text" id="sensorUnit${index}" name="sensorUnit" placeholder="e.g., Celsius, PSI" required>
            </div>
        </div>
    `).join('');
}

function resetAddMachineModal() {
    document.getElementById('addMachineForm').reset();
    machineConfig = { file: null, headers: [], selectedSensors: [] };
    document.getElementById('csvHeadersContainer').innerHTML = '<div class="spinner-container" style="display: none;"><div class="spinner"></div><p>Loading CSV columns...</p></div>';
    document.getElementById('sensorConfigContainer').innerHTML = '';
    navigateSteps(1);
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
    // Basic validation is now handled per step.
    return true;
}

async function handleAddMachine(e) {
    e.preventDefault();
    
    const form = document.getElementById('addMachineForm');
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const formData = new FormData(form);

        // Append the stored file object to the form data
        if (machineConfig.file) {
            formData.append('trainingData', machineConfig.file, machineConfig.file.name);
        }

        // The 'selectedSensors' are not needed here because their values
        // ('sensorName', 'sensorUnit') are already in the form from step 3.

        const response = await fetch('/api/dashboard/add-machine', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage('Machine added successfully! Model training has started.', 'success');
            document.getElementById('addMachineModal').classList.remove('show');
            resetAddMachineModal(); // Use the new, more comprehensive reset function
            setTimeout(loadDashboardData, 500); // Refresh list to show 'training' status
        } else {
            showMessage(result.message || 'Failed to add machine.', 'error');
        }
    } catch (error) {
        console.error('Add machine error:', error);
        showMessage(error.message || 'An unexpected error occurred.', 'error');
    } finally {
        // No more progress bar here, just re-enable the button
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

/**
 * A wrapper for the fetch API that provides upload progress.
 * @param {string} url The URL to fetch.
 * @param {object} opts The options to pass to the fetch request.
 * @param {HTMLElement} progressBar The progress bar element.
 * @param {HTMLElement} progressText The progress text element.
 * @returns {Promise<Response>} A promise that resolves with the fetch Response.
 */
function fetchWithProgress(url, opts = {}, progressBar, progressText) {
    return new Promise((res, rej) => {
        const xhr = new XMLHttpRequest();
        xhr.open(opts.method || 'get', url);

        for (const k in opts.headers || {}) {
            xhr.setRequestHeader(k, opts.headers[k]);
        }
        
        xhr.onload = e => res(new Response(e.target.response, {
            status: e.target.status,
            statusText: e.target.statusText,
            headers: { 'Content-Type': e.target.getResponseHeader('Content-Type') }
        }));
        
        xhr.onerror = rej;
        
        if (xhr.upload && progressBar) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    if(progressText) progressText.textContent = percentComplete + '%';
                }
            };
        }
        
        xhr.send(opts.body);
    });
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
    const machineList = document.getElementById('machineList');

    if (!machines || machines.length === 0) {
        machineList.innerHTML = `
            <div class="no-machines">
                <i class="fas fa-server"></i>
                <h3>No Machines Found</h3>
                <p>Get started by adding your first piece of equipment to monitor.</p>
                <button class="btn btn-primary" id="addFirstMachineBtn">
                    <i class="fas fa-plus"></i> Add Machine
                </button>
            </div>
        `;
        document.getElementById('addFirstMachineBtn').addEventListener('click', () => {
            const modal = document.getElementById('addMachineModal');
            if (modal) modal.classList.add('show');
        });
        return;
    }
    
    machineList.innerHTML = machines.map(machine => {
        const statusColor = getStatusColor(machine.status);
        const healthScore = machine.healthScore !== null && machine.healthScore !== undefined ? machine.healthScore.toFixed(1) : 'N/A';
        const rulEstimate = machine.rulEstimate !== null && machine.rulEstimate !== undefined ? machine.rulEstimate : 'N/A';
        const lastUpdated = machine.lastUpdated ? new Date(machine.lastUpdated).toLocaleString() : 'Never';
        const modelStatus = machine.modelStatus || 'untrained';

        let statusBadge;
        if (modelStatus === 'training') {
            statusBadge = `<span class="status-badge status-training"><i class="fas fa-sync-alt fa-spin"></i> Training...</span>`;
        } else if (modelStatus === 'failed') {
            statusBadge = `<span class="status-badge status-failed" title="${machine.statusDetails || 'Training failed'}"><i class="fas fa-exclamation-triangle"></i> Failed</span>`;
        } else {
            statusBadge = `<span class="status-badge" style="background-color: ${statusColor};">${machine.status}</span>`;
        }
        
        return `
            <div class="machine-card" id="machine-${machine.id}">
                <div class="card-header">
                    <div class="machine-title">
                        <i class="fas fa-cogs machine-icon"></i>
                        <h3>${machine.name}</h3>
                    </div>
                    <div class="machine-actions">
                        ${statusBadge}
                        <div class="dropdown">
                            <button class="dropdown-toggle" ${modelStatus === 'training' ? 'disabled' : ''}><i class="fas fa-ellipsis-v"></i></button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" data-action="view-details" data-id="${machine.id}"><i class="fas fa-eye"></i> View Details</button>
                                <button class="dropdown-item" data-action="calculate-risk" data-id="${machine.id}" ${modelStatus !== 'trained' ? 'disabled' : ''}>
                                    <i class="fas fa-calculator"></i> Calculate Risk
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" data-action="remove-machine" data-id="${machine.id}"><i class="fas fa-trash-alt"></i> Remove Machine</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="metric">
                        <i class="fas fa-shield-alt"></i>
                        <div class="metric-info">
                            <span class="metric-value">${healthScore}</span>
                            <span class="metric-label">Health Score</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-calendar-alt"></i>
                        <div class="metric-info">
                            <span class="metric-value">${rulEstimate}</span>
                            <span class="metric-label">RUL (days)</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <p><strong>Type:</strong> ${machine.type}</p>
                    <p><strong>Last Updated:</strong> ${lastUpdated}</p>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for new dropdowns
    document.querySelectorAll('.machine-card .dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = toggle.parentElement;
            // Close other dropdowns
            document.querySelectorAll('.dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            dropdown.classList.toggle('show');
        });
    });
}

// Close dropdowns when clicking outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.show').forEach(d => {
            d.classList.remove('show');
        });
    }
});

function displayAlerts(alerts) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    if (alerts.length === 0) {
        activityList.innerHTML = `
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
    
    activityList.innerHTML = alerts.map(alert => `
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
    const machine = allMachines.find(m => m._id === machineId);
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
    // This function is now replaced by openPredictionModal
    console.log('viewAnomalyData is deprecated. Use openPredictionModal instead.');
    showMessage('This feature has been updated to "Calculate Risk".', 'info');
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
        'offline': '#6b7280',
        'training': '#3b82f6', // blue
        'failed': '#9ca3af'   // gray
    };
    return colors[status] || '#6b7280';
}

function initConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    const closeBtn = document.getElementById('closeConfirmationModal');
    const cancelBtn = document.getElementById('cancelConfirmation');

    if (modal) {
        const closeModal = () => modal.classList.remove('show');
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

function handleRemoveMachine(machineId) {
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationModalTitle');
    const text = document.getElementById('confirmationModalText');
    const confirmBtn = document.getElementById('confirmAction');

    const machine = allMachines.find(m => m.id === machineId);
    if (!machine) {
        showMessage('Could not find machine details to remove.', 'error');
        return;
    }

    title.textContent = `Remove ${machine.name}?`;
    text.innerHTML = `
        <p>Are you sure you want to permanently remove this machine and its associated model?</p>
        <p><strong>This action cannot be undone.</strong></p>
    `;

    modal.classList.add('show');

    // Clone and replace the button to remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
        try {
            newConfirmBtn.classList.add('loading');
            newConfirmBtn.disabled = true;

            const response = await fetch(`/api/dashboard/machine/${machineId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showMessage(`Machine '${machine.name}' has been removed.`, 'success');
                // Remove machine from the list visually
                const machineCard = document.getElementById(`machine-${machineId}`);
                if (machineCard) {
                    machineCard.remove();
                }
                // Update the global list
                allMachines = allMachines.filter(m => m.id !== machineId);
                // Refresh data to update stats
                loadDashboardData();
            } else {
                showMessage(result.message || 'Failed to remove machine.', 'error');
            }
        } catch (error) {
            showMessage('An error occurred while removing the machine.', 'error');
        } finally {
            newConfirmBtn.classList.remove('loading');
            newConfirmBtn.disabled = false;
            modal.classList.remove('show');
        }
    });
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
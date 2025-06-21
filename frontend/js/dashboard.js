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
    const closeModalBtn = document.getElementById('closeModal');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const submitBtn = document.getElementById('submitBtn');
    const finishBtn = document.getElementById('finishBtn');
    const steps = [...document.querySelectorAll('.form-step')];
    const indicators = [...document.querySelectorAll('.step-indicator')];
    let currentStep = 0;
    let pollerId = null; // To hold the interval ID for the modal poller

    const openModal = () => {
        currentStep = 0;
        updateFormSteps();
        modal.classList.add('show');
    };
    
    const closeModal = () => {
        modal.classList.remove('show');
        form.reset();
        currentStep = 0;
        updateFormSteps();
        if (pollerId) {
            clearInterval(pollerId);
            pollerId = null;
        }
        document.getElementById('columnCheckboxes').innerHTML = '';
        document.getElementById('sensorConfigContainer').innerHTML = '';
        document.getElementById('finishBtn').style.display = 'none';
        document.getElementById('modalProgressLabel').textContent = 'Initializing...';
        document.getElementById('modalProgressBar').style.width = '0%';
    };

    document.getElementById('addMachineBtn').addEventListener('click', openModal);
    
    const addFirstMachineBtn = document.getElementById('addFirstMachineBtn');
    if (addFirstMachineBtn) {
        addFirstMachineBtn.addEventListener('click', openModal);
    }
    closeModalBtn.addEventListener('click', closeModal);
    finishBtn.addEventListener('click', closeModal);

    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            currentStep++;
            if (currentStep === 2) {
                generateSensorConfigUI();
            }
            updateFormSteps();
        }
    });

    prevBtn.addEventListener('click', () => {
        currentStep--;
        updateFormSteps();
    });

    function updateFormSteps() {
        steps.forEach((step, index) => {
            step.style.display = index === currentStep ? 'block' : 'none';
        });
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentStep);
        });

        const isTrainingStep = currentStep === 3;
        prevBtn.style.display = (currentStep > 0 && !isTrainingStep) ? 'inline-block' : 'none';
        nextBtn.style.display = (currentStep < steps.length - 2) ? 'inline-block' : 'none';
        submitBtn.style.display = (currentStep === steps.length - 2) ? 'inline-block' : 'none';
    }

    function validateStep(stepIndex) {
        const step = steps[stepIndex];
        const inputs = [...step.querySelectorAll('input[required], select[required]')];
        let isValid = true;
        for (const input of inputs) {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        }
        if (!isValid) {
            showMessage('Please fill out all required fields.', 'error');
        }
        return isValid;
    }
    
    function generateSensorConfigUI() {
        const selectedColumns = [...document.querySelectorAll('input[name="columns"]:checked')].map(cb => cb.value);
        const sensorConfigContainer = document.getElementById('sensorConfigContainer');
        sensorConfigContainer.innerHTML = '';
        const idTsSynonyms = ['id', 'timestamp', 'timestamps', 'time_stamp'];
        const sensorsToConfigure = selectedColumns.filter(c => !idTsSynonyms.includes(c.toLowerCase()));
        sensorsToConfigure.forEach(column => {
            const item = document.createElement('div');
            item.classList.add('sensor-config-item');
            item.innerHTML = `
                <label>${column}</label>
                <div class="form-group"><input type="text" name="sensor_display_${column}" placeholder="Display Name" required class="form-control" value="${column}"></div>
                <div class="form-group"><input type="text" name="sensor_unit_${column}" placeholder="Unit (e.g., °C, kPa)" required class="form-control"></div>
            `;
            sensorConfigContainer.appendChild(item);
        });
    }

    const csvFileInput = document.getElementById('csvFile');
    const columnCheckboxesContainer = document.getElementById('columnCheckboxes');
    let originalCsvHeaders = [];
    const idTsSynonyms = ['id', 'timestamp', 'timestamps', 'time_stamp'];

    csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) { return; }
        Papa.parse(file, {
            header: true, skipEmptyLines: true, preview: 1,
            complete: (results) => {
                originalCsvHeaders = results.meta.fields;
                columnCheckboxesContainer.innerHTML = ''; 
                
                const displayHeaders = originalCsvHeaders.filter(h => !idTsSynonyms.includes(h.toLowerCase()));

                displayHeaders.forEach(header => {
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.classList.add('checkbox-item');
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `col-${header}`;
                    checkbox.name = 'columns';
                    checkbox.value = header;
                    checkbox.checked = false; // Unchecked by default
                    
                    checkbox.addEventListener('change', () => checkboxDiv.classList.toggle('selected', checkbox.checked));
                    
                    const label = document.createElement('label');
                    label.htmlFor = `col-${header}`;
                    label.textContent = header;
                    
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(label);
                    columnCheckboxesContainer.appendChild(checkboxDiv);
                });
            },
            error: (err) => { console.error('Error parsing CSV:', err); alert('Error parsing CSV file.'); }
        });
    });

    async function handleAddMachine(e) {
        e.preventDefault();
        if (!validateStep(2)) return;

        const form = e.target;
        const formData = new FormData(form);
        const token = localStorage.getItem('token');
        
        // 1. Get user-selected feature columns
        const featureColumns = [...document.querySelectorAll('input[name="columns"]:checked')].map(cb => cb.value);

        // 2. Find required ID and Timestamp columns from original headers
        const requiredColumns = originalCsvHeaders.filter(h => idTsSynonyms.includes(h.toLowerCase()));

        // 3. Combine for the 'columns' field and clean up form data
        const allColumns = [...new Set([...featureColumns, ...requiredColumns])];
        formData.delete('columns');
        formData.append('columns', JSON.stringify(allColumns));
        
        // 4. Collect sensor configuration and clean up form data
        const sensors = [];
        featureColumns.forEach(column => {
            sensors.push({
                sensorId: column,
                name: formData.get(`sensor_display_${column}`),
                unit: formData.get(`sensor_unit_${column}`)
            });
            // Clean up the individual fields
            formData.delete(`sensor_display_${column}`);
            formData.delete(`sensor_unit_${column}`);
        });
        formData.append('sensors', JSON.stringify(sensors));
        
        // --- UI transition to progress view ---
        currentStep = 3;
        updateFormSteps();
        showMessage('Uploading data and starting training...', 'info');

        try {
            const response = await fetch('/api/dashboard/machines', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            const data = await response.json();
            
            if (!data.success) {
                showMessage(`Error: ${data.message}`, 'error');
                // Allow user to go back
                currentStep = 2; 
                updateFormSteps();
                return;
            }
            
            // Start polling for progress inside the modal
            startModalPolling(data.machine._id);

        } catch (error) {
            console.error('Error adding machine:', error);
            showMessage('Network error when adding machine. Please try again.', 'error');
            // Allow user to go back
            currentStep = 2;
            updateFormSteps();
        }
    }

    function startModalPolling(machineId) {
        const progressBar = document.getElementById('modalProgressBar');
        const progressLabel = document.getElementById('modalProgressLabel');
        const finishBtn = document.getElementById('finishBtn');

        pollerId = setInterval(async () => {
            try {
                const response = await fetch(`/api/dashboard/machine/${machineId}/status`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await response.json();
                if (data.success) {
                    progressBar.style.width = `${data.progress || 0}%`;
                    progressLabel.textContent = data.message || 'Processing...';

                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(pollerId);
                        pollerId = null;
                        finishBtn.style.display = 'inline-block';
                        progressLabel.textContent = data.status === 'completed' ? 'Training successful!' : `Training failed: ${data.message}`;
                        loadDashboardData(); // Refresh dashboard in the background
                    }
                } else {
                    clearInterval(pollerId);
                    pollerId = null;
                    progressLabel.textContent = `Error: ${data.message}`;
                    finishBtn.style.display = 'inline-block';
                }
            } catch (err) {
                clearInterval(pollerId);
                pollerId = null;
                progressLabel.textContent = 'Error: Could not retrieve training status.';
                finishBtn.style.display = 'inline-block';
            }
        }, 2000);
    }

    form.addEventListener('submit', handleAddMachine);
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
        const token = localStorage.getItem('token');
        const response = await fetch('/api/dashboard/data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            allMachines = data.data.machines || [];
            displayDashboardData(data.data);
            // After displaying, check for any machines that are in training
            allMachines.forEach(machine => {
                if (machine.training_status === 'pending' || machine.training_status === 'in_progress') {
                    startTrainingStatusPolling(machine._id);
                }
            });
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showMessage('Failed to load dashboard data. Please try again.', 'error');
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
            <div class="no-machines" style="display: flex; flex-direction: column; align-items: center; padding: 2rem;">
                <i class="fas fa-server" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>No Machines Found</h3>
                <p>Get started by adding your first piece of equipment to monitor.</p>
                <button class="btn btn-primary" id="addFirstMachineBtn" style="margin-top: 1rem;">
                    <i class="fas fa-plus"></i> Add Machine
                </button>
            </div>
        `;
        // Re-attach event listener since we overwrote the HTML
        document.getElementById('addFirstMachineBtn').addEventListener('click', () => {
            const modal = document.getElementById('addMachineModal');
            if (modal) modal.classList.add('show');
        });
        return;
    }

    const machineCardsHTML = machines.map(machine => {
        const {
            _id, machineName, machineType, status, healthScore,
            rulEstimate, lastUpdated, training_status, modelStatus
        } = machine;

        const statusColor = getStatusColor(status);
        const lastUpdatedFormatted = lastUpdated ? new Date(lastUpdated).toLocaleString() : 'N/A';
        const isTrained = modelStatus === 'trained';
        
        let statusContent;
        if (training_status === 'in_progress' || training_status === 'pending') {
             const progress = machine.training_progress || 0;
             const message = machine.training_message || (training_status === 'pending' ? 'Pending in queue' : 'Initializing...');
             statusContent = `
                 <div class="status-training-container">
                     <div class="status-line">
                         <span class="status-badge status-training"><i class="fas fa-sync-alt fa-spin"></i> Training...</span>
                         <span class="progress-percentage">${progress}%</span>
                     </div>
                     <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress}%;"></div>
                     </div>
                     <div class="status-details-text">${message}</div>
                 </div>
             `;
        } else if (training_status === 'failed') {
            statusContent = `<span class="status-badge status-failed" title="Training failed"><i class="fas fa-exclamation-triangle"></i> Failed</span>`;
        } else {
            statusContent = `<span class="status-badge" style="background-color: ${statusColor};">${status}</span>`;
        }


        return `
            <div class="machine-card" id="machine-${_id}" data-model-status="${modelStatus}">
                <div class="card-header">
                    <div class="machine-title">
                        <i class="fas fa-cogs machine-icon"></i>
                        <h3>${machineName}</h3>
                    </div>
                    <div class="machine-actions">
                        ${statusContent}
                        <div class="dropdown">
                            <button class="dropdown-toggle" ${training_status === 'in_progress' ? 'disabled' : ''}><i class="fas fa-ellipsis-v"></i></button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" data-action="view-details" data-id="${_id}"><i class="fas fa-eye"></i> View Details</button>
                                <button class="dropdown-item" data-action="calculate-risk" data-id="${_id}" ${!isTrained ? 'disabled' : ''}>
                                    <i class="fas fa-calculator"></i> Calculate Risk
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" data-action="remove-machine" data-id="${_id}"><i class="fas fa-trash-alt"></i> Remove Machine</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="metric">
                        <i class="fas fa-shield-alt"></i>
                        <div class="metric-info">
                            <span class="metric-value">${healthScore || 'N/A'}</span>
                            <span class="metric-label">Health Score</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-calendar-alt"></i>
                        <div class="metric-info">
                            <span class="metric-value">${rulEstimate || 'N/A'}</span>
                            <span class="metric-label">RUL (days)</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <p><strong>Type:</strong> ${machineType}</p>
                    <p><strong>Last Updated:</strong> ${lastUpdatedFormatted}</p>
                </div>
            </div>
        `;
    }).join('');

    machineList.innerHTML = machineCardsHTML;
    
    // Add event listeners for new dropdowns
    document.querySelectorAll('.machine-card .dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = toggle.closest('.dropdown');
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

function getTrainingStatusHTML(status) {
    if (!status || status === 'none') return '';

    const statusMap = {
        'pending': { text: 'Pending Training', icon: 'fa-clock', color: '#17a2b8' },
        'in_progress': { text: 'Model Training...', icon: 'fa-sync fa-spin', color: '#ffc107' },
        'completed': { text: 'Model Trained', icon: 'fa-check-circle', color: '#28a745' },
        'failed': { text: 'Training Failed', icon: 'fa-times-circle', color: '#dc3545' }
    };

    const info = statusMap[status];
    if (!info) return '';
    
    return `<div class="training-status" style="color: ${info.color}; margin-top: 10px; font-weight: bold;">
                <i class="fas ${info.icon}"></i> ${info.text}
            </div>`;
}

let activePollers = {};

function startTrainingStatusPolling(machineId) {
    // Stop any pollers that are running for machines that are no longer training
    Object.keys(activePollers).forEach(machineId => {
        const machineCard = document.getElementById(`machine-${machineId}`);
        if (!machineCard || machineCard.dataset.modelStatus !== 'training') {
            clearInterval(activePollers[machineId]);
            delete activePollers[machineId];
        }
    });

    // Find all machines with 'training' status and start a poller if not already running
    document.querySelectorAll('.machine-card[data-model-status="training"]').forEach(card => {
        const machineId = card.id.replace('machine-', '');
        if (!activePollers[machineId]) {
            console.log(`Starting poller for machine ${machineId}`);
            activePollers[machineId] = setInterval(() => {
                pollMachineStatus(machineId);
            }, 3000); // Poll every 3 seconds
        }
    });
}

async function pollMachineStatus(machineId) {
    if (!activePollers[machineId]) {
        return; 
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/dashboard/machine/${machineId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const machineCard = document.getElementById(`machine-${machineId}`);
            if (machineCard) {
                // Update progress bar and message
                const progressBar = machineCard.querySelector('.progress-bar');
                const progressPercentage = machineCard.querySelector('.progress-percentage');
                const statusDetails = machineCard.querySelector('.status-details-text');

                if (progressBar) progressBar.style.width = `${data.progress || 0}%`;
                if (progressPercentage) progressPercentage.textContent = `${data.progress || 0}%`;
                if (statusDetails) statusDetails.textContent = data.message || 'Processing...';
            }

            // If training is complete or failed, stop polling
            if (data.status === 'completed' || data.status === 'failed') {
                console.log(`Stopping polling for machine ${machineId}, status: ${data.status}`);
                clearInterval(activePollers[machineId].intervalId);
                delete activePollers[machineId];
                // Refresh the entire card to show final state
                loadDashboardData();
            }
        } else {
            // Stop polling on error
            console.error(`Error fetching status for machine ${machineId}:`, data.message);
            clearInterval(activePollers[machineId].intervalId);
            delete activePollers[machineId];
        }
    } catch (error) {
        console.error(`Network error while polling for machine ${machineId}:`, error);
        clearInterval(activePollers[machineId].intervalId);
        delete activePollers[machineId];
    }
}

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
                <h3><i class="fas fa-tachometer-alt"></i> Status & Metrics</h3>
                ${createDetail('Status', `<span class="status-badge" style="background-color: ${getStatusColor(machine.status)};">${machine.status}</span>`)}
                ${createDetail('Health Score', machine.healthScore)}
                ${createDetail('Est. RUL (days)', machine.rulEstimate)}
                ${createDetail('Last Updated', new Date(machine.lastUpdated).toLocaleString())}
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

    const machine = allMachines.find(m => m._id === machineId);
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
                allMachines = allMachines.filter(m => m._id !== machineId);
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
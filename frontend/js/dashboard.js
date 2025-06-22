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
    console.log('🚀 Starting dashboard initialization...');
    
    // Initialize logout functionality
    initLogout();
    console.log('✅ Logout initialized');
    
    // Add event listener for the refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showMessage('Refreshing dashboard data...', 'info');
            loadDashboardData();
        });
        console.log('✅ Refresh button initialized');
    } else {
        console.warn('⚠️ Refresh button not found');
    }
    
    // Initialize dashboard navigation
    initDashboardNav();
    console.log('✅ Dashboard navigation initialized');
    
    // Initialize hamburger menu
    initHamburgerMenu();
    console.log('✅ Hamburger menu initialized');
    
    // Initialize machine management
    initMachineManagement();
    console.log('✅ Machine management initialized');
    
    // Initialize confirmation modal
    initConfirmationModal();
    console.log('✅ Confirmation modal initialized');
    
    // Load dashboard data (placeholder for future implementation)
    console.log('🔄 Loading dashboard data...');
    loadDashboardData();
    console.log('✅ Dashboard initialization complete');
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

            console.log('Button clicked:', { action, id, button: button.textContent.trim() });

            if (action === 'view-details') {
                viewMachineDetails(id);
            } else if (action === 'calculate-risk') {
                console.log('Calculate Risk button clicked for machine:', id);
                openPredictionModal(id);
            } else if (action === 'train-model') {
                openTrainModal(id);
            } else if (action === 'remove-machine') {
                handleRemoveMachine(id);
            }
        });
    }

    // Initialize prediction modal - only set up the modal structure, not the form handlers
    const predictionModal = document.getElementById('predictionModal');
    const closePredictionBtn = document.getElementById('closePredictionModal');
    const cancelPredictionBtn = document.getElementById('cancelPrediction');

    if (predictionModal) {
        const closeModalFunc = () => predictionModal.classList.remove('show');
        if (closePredictionBtn) {
            closePredictionBtn.addEventListener('click', closeModalFunc);
        }
        if (cancelPredictionBtn) {
            cancelPredictionBtn.addEventListener('click', closeModalFunc);
        }
        predictionModal.addEventListener('click', (e) => {
            if (e.target === predictionModal) {
                closeModalFunc();
            }
        });
    }

    // Initialize the new training modal
    initTrainMachineModal();
}

function initAddMachineModal() {
    const modal = document.getElementById('addMachineModal');
    if (!modal) return;

    const form = document.getElementById('addMachineForm');
    const closeModalBtn = document.getElementById('closeModal');
    const openModalBtn = document.getElementById('addMachineBtn');

    const openModal = () => modal.classList.add('show');
    const closeModal = () => {
        modal.classList.remove('show');
        form.reset();
    };

    openModalBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);

    const addFirstMachineBtn = document.getElementById('addFirstMachineBtn');
    if (addFirstMachineBtn) {
        addFirstMachineBtn.addEventListener('click', openModal);
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('#submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        const formData = new FormData(form);
        const machineData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/dashboard/machines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(machineData)
            });
            const result = await response.json();
            if (result.success) {
                showMessage('Machine added successfully!', 'success');
                closeModal();
                loadDashboardData();
            } else {
                showMessage(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            showMessage('Network error. Could not add machine.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Machine';
        }
    });
}

let currentTrainMachineId = null;
let trainEventSource = null;

function openTrainModal(machineId) {
    currentTrainMachineId = machineId;
    const machine = allMachines.find(m => m._id === machineId);
    if (!machine) {
        showMessage('Could not find machine to train.', 'error');
        return;
    }
    document.getElementById('trainModalTitle').textContent = `Train Model for ${machine.machineName}`;
    document.getElementById('trainMachineModal').classList.add('show');
}

function initTrainMachineModal() {
    const modal = document.getElementById('trainMachineModal');
    if (!modal) return;

    const form = document.getElementById('trainMachineForm');
    const closeModalBtn = document.getElementById('closeTrainModal');
    const nextBtn = document.getElementById('nextTrainBtn');
    const prevBtn = document.getElementById('prevTrainBtn');
    const submitBtn = document.getElementById('submitTrainBtn');
    const finishBtn = document.getElementById('finishTrainBtn');
    const steps = [...modal.querySelectorAll('.form-step')];
    const indicators = [...modal.querySelectorAll('.step-indicator')];
    let currentStep = 0;
    
    let originalCsvHeaders = [];
    const idTsSynonyms = ['id', 'timestamp', 'timestamps', 'time_stamp'];

    const closeModal = () => {
        modal.classList.remove('show');
        form.reset();
        currentStep = 0;
        updateFormSteps();
        if (trainEventSource) {
            trainEventSource.close();
            trainEventSource = null;
        }
        document.getElementById('columnCheckboxesTrain').innerHTML = '';
        document.getElementById('sensorConfigContainerTrain').innerHTML = '';
        document.getElementById('finishTrainBtn').style.display = 'none';
        document.getElementById('modalProgressLabelTrain').textContent = 'Initializing...';
        document.getElementById('modalProgressBarTrain').style.width = '0%';
        currentTrainMachineId = null;
    };

    closeModalBtn.addEventListener('click', closeModal);
    finishBtn.addEventListener('click', async () => {
        console.log('Finish button clicked!');
        // Directly handle the form submission for the Finish button
        if (!currentTrainMachineId) {
            console.log('No currentTrainMachineId found');
            showMessage('No machine selected for training.', 'error');
            return;
        }

        console.log('Current train machine ID:', currentTrainMachineId);

        // Ensure sensor configuration UI is generated if not already done
        const sensorConfigContainer = document.getElementById('sensorConfigContainerTrain');
        if (sensorConfigContainer.children.length === 0) {
            console.log('Generating sensor config UI...');
            generateSensorConfigUI();
        }

        const formData = new FormData(form);
        const featureColumns = [...modal.querySelectorAll('input[name="columns"]:checked')].map(cb => cb.value);
        
        console.log('Selected feature columns:', featureColumns);
        
        if (featureColumns.length === 0) {
            console.log('No feature columns selected');
            showMessage('Please select at least one sensor column.', 'error');
            return;
        }

        const requiredColumns = originalCsvHeaders.filter(h => idTsSynonyms.includes(h.toLowerCase()));
        const allColumns = [...new Set([...featureColumns, ...requiredColumns])];
        formData.delete('columns');
        formData.append('columns', JSON.stringify(allColumns));
        
        const sensors = featureColumns.map(column => ({
            sensorId: column,
            name: formData.get(`sensor_display_${column}`) || column,
            unit: formData.get(`sensor_unit_${column}`) || ''
        }));
        
        console.log('Sensors configuration:', sensors);
        
        featureColumns.forEach(column => {
            formData.delete(`sensor_display_${column}`);
            formData.delete(`sensor_unit_${column}`);
        });
        formData.append('sensors', JSON.stringify(sensors));

        try {
            console.log('Sending request to backend...');
            // Save sensor configuration and apply pre-trained parameters
            const response = await fetch(`/api/dashboard/machine/${currentTrainMachineId}/train`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            const data = await response.json();
            console.log('Backend response:', data);
            if (!data.success) {
                showMessage(`Error: ${data.message}`, 'error');
            } else {
                // Close modal and refresh dashboard
                closeModal();
                loadDashboardData();
                showMessage('Sensor configuration saved and pre-trained model applied!', 'success');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showMessage('Network error. Could not save configuration.', 'error');
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            currentStep++;
            if (currentStep === 2) generateSensorConfigUI();
            updateFormSteps();
        }
    });

    prevBtn.addEventListener('click', () => {
        currentStep--;
        updateFormSteps();
    });

    function updateFormSteps() {
        steps.forEach((step, index) => step.style.display = index === currentStep ? 'block' : 'none');
        indicators.forEach((indicator, index) => indicator.classList.toggle('active', index === currentStep));
        const isTrainingStep = currentStep === 3;
        prevBtn.style.display = (currentStep > 0 && !isTrainingStep) ? 'inline-block' : 'none';
        nextBtn.style.display = (currentStep < steps.length - 2) ? 'inline-block' : 'none';
        submitBtn.style.display = (currentStep === steps.length - 2) ? 'inline-block' : 'none';
    }

    function validateStep(stepIndex) {
        const step = steps[stepIndex];
        const inputs = [...step.querySelectorAll('input[required]')];
        for (const input of inputs) {
            if (!input.value.trim()) {
                showMessage('Please fill out all required fields.', 'error');
                return false;
            }
        }
        return true;
    }

    const csvFileInput = document.getElementById('csvFileTrain');
    csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check file size and inform about 1MB limit
        const fileSizeInMB = file.size / (1024 * 1024);
        console.log(`📁 File selected: ${file.name} (${fileSizeInMB.toFixed(2)} MB)`);
        
        if (fileSizeInMB > 1) {
            showMessage('Large file detected. Only the first 1MB of data will be used for fast training.', 'info');
        }
        
        // Use Papa Parse with streaming for large files
        const config = {
            header: true, 
            preview: 1, 
            skipEmptyLines: true,
            chunk: function(results, parser) {
                // Process only the first chunk to get headers
                if (results.meta.fields) {
                    originalCsvHeaders = results.meta.fields;
                    const container = document.getElementById('columnCheckboxesTrain');
                    container.innerHTML = '';
                    const displayHeaders = originalCsvHeaders.filter(h => !idTsSynonyms.includes(h.toLowerCase()));
                    displayHeaders.forEach(header => {
                        const cbDiv = document.createElement('div');
                        cbDiv.className = 'checkbox-item';
                        cbDiv.innerHTML = `<input type="checkbox" id="train-col-${header}" name="columns" value="${header}"><label for="train-col-${header}">${header}</label>`;
                        container.appendChild(cbDiv);
                    });
                    parser.abort(); // Stop parsing after getting headers
                }
            },
            complete: (results) => {
                // Fallback for smaller files
                if (!originalCsvHeaders.length && results.meta.fields) {
                    originalCsvHeaders = results.meta.fields;
                    const container = document.getElementById('columnCheckboxesTrain');
                    container.innerHTML = '';
                    const displayHeaders = originalCsvHeaders.filter(h => !idTsSynonyms.includes(h.toLowerCase()));
                    displayHeaders.forEach(header => {
                        const cbDiv = document.createElement('div');
                        cbDiv.className = 'checkbox-item';
                        cbDiv.innerHTML = `<input type="checkbox" id="train-col-${header}" name="columns" value="${header}"><label for="train-col-${header}">${header}</label>`;
                        container.appendChild(cbDiv);
                    });
                }
            },
            error: (error) => {
                console.error('CSV parsing error:', error);
                showMessage('Error reading CSV file. Please check the file format.', 'error');
            }
        };
        
        Papa.parse(file, config);
    });
    
    function generateSensorConfigUI() {
        const selected = [...modal.querySelectorAll('input[name="columns"]:checked')].map(cb => cb.value);
        const container = document.getElementById('sensorConfigContainerTrain');
        container.innerHTML = '';
        selected.forEach(column => {
            const item = document.createElement('div');
            item.className = 'sensor-config-item';
            item.innerHTML = `<label>${column}</label><div class="form-group"><input type="text" name="sensor_display_${column}" placeholder="Display Name" required class="form-control" value="${column}"></div><div class="form-group"><input type="text" name="sensor_unit_${column}" placeholder="Unit" required class="form-control"></div>`;
            container.appendChild(item);
        });
    }

    // Handle form submission for actual training
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!validateStep(2) || !currentTrainMachineId) return;

        console.log('📤 Starting training submission...');

        // Move to progress step
        currentStep = 3;
        updateFormSteps();

        // Collect form data
        const formData = new FormData(form);
        const featureColumns = [...modal.querySelectorAll('input[name="columns"]:checked')].map(cb => cb.value);
        
        console.log('📊 Selected feature columns:', featureColumns);
        
        if (featureColumns.length === 0) {
            showMessage('Please select at least one sensor column.', 'error');
            currentStep = 1; // Go back to column selection
            updateFormSteps();
            return;
        }

        // Build sensor configuration from form inputs
        const sensors = featureColumns.map(column => {
            const displayName = document.querySelector(`input[name="sensor_display_${column}"]`)?.value || column;
            const unit = document.querySelector(`input[name="sensor_unit_${column}"]`)?.value || '';
            
            return {
                sensorId: column,
                name: displayName,
                unit: unit,
                type: 'numeric',
                minValue: 0,
                maxValue: 100
            };
        });
        
        console.log('⚙️ Sensor configuration:', sensors);
        
        // Prepare form data for submission
        const requiredColumns = originalCsvHeaders.filter(h => idTsSynonyms.includes(h.toLowerCase()));
        const allColumns = [...new Set([...featureColumns, ...requiredColumns])];
        
        // Clear old form data and add new data
        const finalFormData = new FormData();
        finalFormData.append('csvFile', formData.get('csvFile'));
        finalFormData.append('columns', JSON.stringify(allColumns));
        finalFormData.append('sensors', JSON.stringify(sensors));

        try {
            console.log('🚀 Submitting training request...');
            const response = await fetch(`/api/dashboard/machine/${currentTrainMachineId}/train`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: finalFormData
            });
            const data = await response.json();
            
            console.log('📡 Training response:', data);
            
            if (!data.success) {
                showMessage(`Error: ${data.message}`, 'error');
                currentStep = 2; updateFormSteps();
            } else {
                // Start polling for progress updates
                startTrainPolling(currentTrainMachineId);
                showMessage('Training started successfully!', 'success');
            }
        } catch (error) {
            console.error('❌ Training submission error:', error);
            showMessage('Network error. Could not start training.', 'error');
            currentStep = 2; updateFormSteps();
        }
    });
}

function startTrainPolling(machineId) {
    const progressBar = document.getElementById('modalProgressBarTrain');
    const progressLabel = document.getElementById('modalProgressLabelTrain');
    const finishBtn = document.getElementById('finishTrainBtn');

    if (trainEventSource) trainEventSource.close();
    
    const token = localStorage.getItem('token');
    trainEventSource = new EventSource(`/api/dashboard/machine/${machineId}/status?token=${token}`);

    trainEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.success) {
            progressBar.style.width = `${data.progress || 0}%`;
            progressLabel.textContent = data.message || 'Processing...';

            if (data.status === 'completed' || data.status === 'failed') {
                trainEventSource.close();
                trainEventSource = null;
                finishBtn.style.display = 'inline-block';
                progressLabel.textContent = data.status === 'completed' ? 'Training successful!' : `Training failed: ${data.message}`;
                loadDashboardData();
            }
        } else {
            trainEventSource.close();
            progressLabel.textContent = `Error: ${data.message}`;
            finishBtn.style.display = 'inline-block';
        }
    };

    trainEventSource.onerror = () => {
        progressLabel.textContent = 'Error: Connection to server lost.';
        finishBtn.style.display = 'inline-block';
        if (trainEventSource) trainEventSource.close();
    };
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
        console.log('🔄 Fetching dashboard data...');
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('❌ No token found in localStorage');
            showMessage('Authentication token not found. Please log in again.', 'error');
            return;
        }
        
        console.log('📡 Making API request to /api/dashboard/data...');
        const response = await fetch('/api/dashboard/data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('📥 Response received:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Dashboard data received:', data);

        if (data.success) {
            allMachines = data.data.machines || [];
            console.log(`✅ Loaded ${allMachines.length} machines`);
            displayDashboardData(data.data);
            
            // After displaying, check for any machines that are in training
            allMachines.forEach(machine => {
                if (machine.training_status === 'pending' || machine.training_status === 'in_progress') {
                    console.log(`🔄 Starting training status polling for machine ${machine._id}`);
                    startTrainingStatusPolling(machine._id);
                }
            });
        } else {
            console.error('❌ API returned error:', data.message);
            showMessage(data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
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
        const isTrained = modelStatus === 'trained' || 
                         training_status === 'completed' ||
                         (machine.model_params && machine.model_params.source === 'pre_trained_model');
        
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
                                <button class="dropdown-item" data-action="train-model" data-id="${_id}" ${training_status === 'in_progress' ? 'disabled' : ''}>
                                    <i class="fas fa-brain"></i> Train Model
                                </button>
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
        'pending': { text: 'Preparing Training...', icon: 'fa-clock', color: '#17a2b8' },
        'in_progress': { text: 'Training Neural Network...', icon: 'fa-sync fa-spin', color: '#ffc107' },
        'completed': { text: 'Training Complete', icon: 'fa-check-circle', color: '#28a745' },
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
            }, 1000); // Poll every 1 second for instant response
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

function renderSensorTable(sensors) {
    if (!sensors || sensors.length === 0) {
        return '<p>No sensors configured.</p>';
    }
    let tableHTML = `
        <table class="details-table">
            <thead>
                <tr>
                    <th>Sensor ID</th>
                    <th>Display Name</th>
                    <th>Unit</th>
                </tr>
            </thead>
            <tbody>
    `;
    sensors.forEach(sensor => {
        tableHTML += `
            <tr>
                <td>${sensor.sensorId || 'N/A'}</td>
                <td>${sensor.name || 'N/A'}</td>
                <td>${sensor.unit || 'N/A'}</td>
            </tr>
        `;
    });
    tableHTML += '</tbody></table>';
    return tableHTML;
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

    modalTitle.textContent = `Details for ${machine.machineName}`;
    
    const createDetail = (label, value) => {
        const val = (value !== null && value !== undefined && value !== '') ? value : '<span class="not-available">N/A</span>';
        return `<div class="detail-pair"><span class="label">${label}</span><span class="value">${val}</span></div>`;
    };

    const isTrained = machine.training_status === 'completed';
    const trainingParams = machine.model_params || {};

    modalBody.innerHTML = `
        <div class="details-grid">
            <div class="details-section">
                <h3><i class="fas fa-info-circle"></i> Identification</h3>
                ${createDetail('Machine Type', machine.machineType)}
                ${createDetail('Manufacturer', machine.manufacturer)}
                ${createDetail('Model', machine.model)}
                ${createDetail('Serial Number', machine.serialNumber)}
            </div>

            <div class="details-section">
                <h3><i class="fas fa-tachometer-alt"></i> Operational Status</h3>
                ${createDetail('Health Score', machine.healthScore)}
                ${createDetail('Est. RUL (days)', machine.rulEstimate)}
                ${createDetail('Last Updated', new Date(machine.lastUpdated).toLocaleString())}
                 ${createDetail('Last Trained', isTrained && machine.updatedAt ? new Date(machine.updatedAt).toLocaleString() : 'Not Trained')}
            </div>
            
            <div class="details-section full-width">
                <h3><i class="fas fa-brain"></i> Model Details</h3>
                <div class="details-subsection">
                    ${createDetail('Training Status', `<span class="status-badge ${machine.training_status}">${machine.training_status || 'none'}</span>`)}
                    ${isTrained ? createDetail('Model Source', trainingParams.source === 'pre_trained_model' ? 'Pre-trained Model (0.csv)' : 'Custom Training') : ''}
                    ${isTrained ? createDetail('Anomaly Threshold', trainingParams.threshold ? trainingParams.threshold.toFixed(4) : 'N/A') : ''}
                    ${isTrained ? createDetail('Avg. Training Loss', trainingParams.mean_loss ? trainingParams.mean_loss.toFixed(4) : 'N/A') : ''}
                    ${isTrained && trainingParams.trained_columns ? createDetail('Trained Sensors', trainingParams.trained_columns.length + ' sensors') : ''}
                </div>
            </div>

            <div class="details-section full-width">
                <h3><i class="fas fa-tasks"></i> Configured Sensors</h3>
                ${renderSensorTable(machine.sensors)}
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
    const machine = allMachines.find(m => m._id === machineId);
    
    if (!machine) {
        showMessage('Machine not found', 'error');
        return;
    }
    
    // Check if model is trained
    const isTrained = machine.modelStatus === 'trained' || 
                     machine.training_status === 'completed' ||
                     (machine.model_params && machine.model_params.source === 'pre_trained_model');
    
    if (!isTrained) {
        showMessage('Model for this machine is not trained yet. Please train the model first.', 'error');
        return;
    }
    
    const modal = document.getElementById('predictionModal');
    const modalTitle = document.getElementById('predictionModalTitle');
    const predictionForm = document.getElementById('predictionForm');
    const csvPredictionForm = document.getElementById('csvPredictionForm');
    const predictionResult = document.getElementById('predictionResult');
    const csvPredictionResult = document.getElementById('csvPredictionResult');
    
    // Reset modal state
    modalTitle.textContent = `Calculate Risk Score - ${machine.machineName}`;
    predictionForm.style.display = 'none';
    csvPredictionForm.style.display = 'none';
    predictionResult.style.display = 'none';
    csvPredictionResult.style.display = 'none';
    
    // Show default form (single reading)
    predictionForm.style.display = 'block';
    
    // Generate sensor inputs for single reading
    const formBody = document.getElementById('predictionFormBody');
    formBody.innerHTML = '';
    
    if (machine.sensors && machine.sensors.length > 0) {
        machine.sensors.forEach(sensor => {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'form-group';
            inputGroup.innerHTML = `
                <label for="sensor_${sensor.sensorId}">${sensor.name} ${sensor.unit ? `(${sensor.unit})` : ''}</label>
                <input type="number" 
                       id="sensor_${sensor.sensorId}" 
                       name="${sensor.sensorId}" 
                       class="form-control" 
                       step="0.01" 
                       required 
                       placeholder="Enter ${sensor.name} value">
            `;
            formBody.appendChild(inputGroup);
        });
    } else {
        formBody.innerHTML = '<p class="text-muted">No sensors configured for this machine.</p>';
    }
    
    modal.classList.add('show');
    
    // Handle mode switching
    const modeRadios = document.querySelectorAll('input[name="predictionMode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'single') {
                predictionForm.style.display = 'block';
                csvPredictionForm.style.display = 'none';
            } else {
                predictionForm.style.display = 'none';
                csvPredictionForm.style.display = 'block';
            }
        });
    });
    
    // Handle form submissions
    predictionForm.addEventListener('submit', handleSinglePrediction);
    csvPredictionForm.addEventListener('submit', handleCsvPrediction);
    
    // Handle cancel buttons
    document.getElementById('cancelPrediction').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    document.getElementById('cancelCsvPrediction').addEventListener('click', () => {
        modal.classList.remove('show');
    });
}

async function handleSinglePrediction(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const resultContainer = document.getElementById('predictionResult');
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Calculating...';

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
            // Update the result display
            document.getElementById('riskScore').textContent = result.data.reconstruction_error.toFixed(4);
            document.getElementById('isAnomaly').textContent = result.data.is_anomaly ? 'Yes' : 'No';
            document.getElementById('anomalyThreshold').textContent = `(Threshold: ${result.data.threshold.toFixed(4)})`;
            
            // Add additional information if available
            if (result.data.healthScore !== undefined) {
                const healthScoreElement = document.getElementById('healthScore');
                if (healthScoreElement) {
                    healthScoreElement.textContent = result.data.healthScore;
                }
            }
            
            if (result.data.rulEstimate !== undefined) {
                const rulEstimateElement = document.getElementById('rulEstimate');
                if (rulEstimateElement) {
                    rulEstimateElement.textContent = `${result.data.rulEstimate} days`;
                }
            }
            
            if (result.data.status !== undefined) {
                const statusElement = document.getElementById('riskStatus');
                if (statusElement) {
                    statusElement.textContent = result.data.status;
                    statusElement.className = `risk-status ${result.data.status}`;
                }
            }
            
            resultContainer.style.display = 'block';
            
            // Update the machine in the allMachines array and refresh the display
            const machineIndex = allMachines.findIndex(m => m._id === currentPredictionMachineId);
            if (machineIndex !== -1) {
                allMachines[machineIndex].healthScore = result.data.healthScore || allMachines[machineIndex].healthScore;
                allMachines[machineIndex].rulEstimate = result.data.rulEstimate || allMachines[machineIndex].rulEstimate;
                allMachines[machineIndex].status = result.data.status || allMachines[machineIndex].status;
                allMachines[machineIndex].lastUpdated = new Date().toISOString();
                
                // Refresh the dashboard to show updated values
                setTimeout(() => {
                    loadDashboardData();
                }, 1000);
            }
            
            showMessage('Risk calculation completed successfully!', 'success');
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
        submitBtn.textContent = 'Calculate Risk';
    }
}

async function handleCsvPrediction(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const resultContainer = document.getElementById('csvPredictionResult');
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';

    try {
        const formData = new FormData(form);
        const csvFile = formData.get('csvFile');
        
        if (!csvFile) {
            showMessage('Please select a CSV file.', 'error');
            return;
        }
        
        const response = await fetch(`/api/dashboard/machine/${currentPredictionMachineId}/predict-csv`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            const summary = result.data.summary;
            const analysisResults = result.data.analysisResults;
            
            // Update the CSV result display
            document.getElementById('totalReadings').textContent = summary.totalReadings;
            document.getElementById('anomalyCount').textContent = summary.anomalyCount;
            document.getElementById('anomalyPercentage').textContent = `${summary.anomalyPercentage}%`;
            document.getElementById('avgRiskScore').textContent = summary.avgRiskScore.toFixed(4);
            document.getElementById('csvHealthScore').textContent = summary.healthScore;
            document.getElementById('csvRulEstimate').textContent = `${summary.rulEstimate} days`;
            document.getElementById('csvRiskStatus').textContent = summary.status;
            
            // Add status classes for styling
            document.getElementById('csvHealthScore').className = `health-score ${summary.healthScore >= 80 ? 'excellent' : summary.healthScore >= 60 ? 'good' : summary.healthScore >= 40 ? 'warning' : 'critical'}`;
            document.getElementById('csvRiskStatus').className = `risk-status ${summary.status}`;
            
            // Display anomaly details
            const anomalyDetails = document.getElementById('anomalyDetails');
            if (analysisResults && analysisResults.length > 0) {
                const anomalies = analysisResults.filter(r => r.is_anomaly);
                if (anomalies.length > 0) {
                    anomalyDetails.innerHTML = `
                        <h4>Anomaly Details (${anomalies.length} detected)</h4>
                        <div class="anomaly-list">
                            ${anomalies.slice(0, 10).map(anomaly => `
                                <div class="anomaly-item">
                                    <div>
                                        <span class="timestamp">${anomaly.timestamp || `Row ${anomaly.row_index}`}</span>
                                        <span class="row-index">(Row ${anomaly.row_index})</span>
                                    </div>
                                    <span class="error-score">Error: ${anomaly.reconstruction_error.toFixed(4)}</span>
                                </div>
                            `).join('')}
                            ${anomalies.length > 10 ? `<div class="anomaly-item"><em>... and ${anomalies.length - 10} more anomalies</em></div>` : ''}
                        </div>
                    `;
                } else {
                    anomalyDetails.innerHTML = `
                        <h4>Anomaly Details</h4>
                        <div class="anomaly-list">
                            <div class="anomaly-item">
                                <span>No anomalies detected in this data window</span>
                            </div>
                        </div>
                    `;
                }
            }
            
            resultContainer.style.display = 'block';
            
            // Update the machine in the allMachines array and refresh the display
            const machineIndex = allMachines.findIndex(m => m._id === currentPredictionMachineId);
            if (machineIndex !== -1) {
                allMachines[machineIndex].healthScore = summary.healthScore;
                allMachines[machineIndex].rulEstimate = summary.rulEstimate;
                allMachines[machineIndex].status = summary.status;
                allMachines[machineIndex].lastUpdated = new Date().toISOString();
                
                // Refresh the dashboard to show updated values
                setTimeout(() => {
                    loadDashboardData();
                }, 1000);
            }
            
            showMessage('CSV analysis completed successfully!', 'success');
        } else {
            showMessage(result.message || 'CSV analysis failed.', 'error');
            resultContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('CSV prediction error:', error);
        showMessage('An error occurred during CSV analysis.', 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Analyze CSV';
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

    // Use the correct property 'machineName' and provide a fallback.
    const machineDisplayName = machine.machineName || 'this machine';
    title.textContent = `Remove ${machineDisplayName}?`;
    text.innerHTML = `
        <p>Are you sure you want to permanently remove this machine and all its associated data?</p>
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
// Dashboard JavaScript file for handling dashboard functionality

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
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
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
            <div class="user-detail">
                <strong>Name:</strong> ${user.firstName} ${user.lastName}
            </div>
            <div class="user-detail">
                <strong>Email:</strong> ${user.email}
            </div>
            <div class="user-detail">
                <strong>Company:</strong> ${user.company || 'Not specified'}
            </div>
            <div class="user-detail">
                <strong>Role:</strong> ${user.role}
            </div>
            <div class="user-detail">
                <strong>Member since:</strong> ${window.authUtils ? window.authUtils.formatDate(user.createdAt) : new Date(user.createdAt).toLocaleDateString()}
            </div>
        `;
    }
    
    // Set user name in greeting
    setUserName(user);
}

function setUserName(user) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = `${user.firstName} ${user.lastName}`;
    }
}

function initDashboard() {
    // Initialize logout functionality
    initLogout();
    
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
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const token = localStorage.getItem('token');
            
            try {
                // Call logout API
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Logout API error:', error);
                // Continue with logout even if API call fails
            }
            
            // Clear local storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Redirect to home page
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
        hamburger.addEventListener('click', function() {
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
    
    // Initialize file upload functionality
    // initFileUpload(); // This seems to be causing issues, let's look at this later if needed
    
    // Initialize sensor selection - REMOVED
    // initSensorSelection(); 
    // Initialize sensor selection
    initSensorSelection();
}

function initAddMachineModal() {
    const modal = document.getElementById('addMachineModal');
    const addMachineBtn = document.getElementById('addMachineBtn');
    const addFirstMachineBtn = document.getElementById('addFirstMachineBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelAdd = document.getElementById('cancelAdd');
    const form = document.getElementById('addMachineForm');
    
    // Open modal
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => {
            modal.classList.add('show');
        });
    }
    
    if (addFirstMachineBtn) {
        addFirstMachineBtn.addEventListener('click', () => {
            modal.classList.add('show');
        });
    }
    
    // Close modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }
    
    if (cancelAdd) {
        cancelAdd.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Handle form submission
    if (form) {
        form.addEventListener('submit', handleAddMachine);
    }
}

function initFileUpload() {
    const fileInput = document.getElementById('trainingData');
    const uploadArea = document.getElementById('fileUploadArea');
    const uploadedFiles = document.getElementById('uploadedFiles');
    
    if (!fileInput || !uploadArea || !uploadedFiles) return;
    
    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        displayUploadedFiles(files);
        validateTrainingData(files[0]);
    });
    
    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-color)';
        uploadArea.style.background = 'var(--bg-primary)';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-color)';
        uploadArea.style.background = 'var(--bg-secondary)';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-color)';
        uploadArea.style.background = 'var(--bg-secondary)';
        
        const files = Array.from(e.dataTransfer.files);
        fileInput.files = e.dataTransfer.files;
        displayUploadedFiles(files);
        validateTrainingData(files[0]);
    });
}

function validateTrainingData(file) {
    if (!file) return;
    
    const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/json',
        'text/plain'
    ];
    
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json', '.txt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        showFormError('trainingData', 'Please upload a valid file type (CSV, Excel, JSON, or TXT)');
        return false;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
        showFormError('trainingData', 'File size must be less than 50MB');
        return false;
    }
    
    clearFormError('trainingData');
    return true;
}

function showFormError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    
    formGroup.classList.add('error');
    
    // Remove existing error message
    const existingError = formGroup.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    formGroup.appendChild(errorElement);
}

function clearFormError(fieldId) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    
    formGroup.classList.remove('error');
    
    const errorElement = formGroup.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

function validateForm(formData) {
    let isValid = true;
    
    // Required fields validation
    const requiredFields = [
        'machineName', 'machineType', 'model', 
        'serialNumber', 'scadaSystem'
    ];
    
    requiredFields.forEach(field => {
        const value = formData.get(field);
        if (!value || value.trim() === '') {
            showFormError(field, 'This field is required');
            isValid = false;
        } else {
            clearFormError(field);
        }
    });
    
    // Sensors validation
    const sensors = formData.getAll('sensors');
    if (sensors.length === 0) {
        showFormError('sensorGrid', 'At least one sensor must be selected');
        isValid = false;
    } else {
        clearFormError('sensorGrid');
    }
    
    // Training data validation
    const trainingData = document.getElementById('trainingData').files[0];
    if (!trainingData) {
        showFormError('trainingData', 'Training data file is required');
        isValid = false;
    } else if (!validateTrainingData(trainingData)) {
        isValid = false;
    }
    
    return isValid;
}

function displayUploadedFiles(files) {
    const uploadedFiles = document.getElementById('uploadedFiles');
    if (!uploadedFiles) return;
    
    uploadedFiles.innerHTML = '';
    
    files.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'uploaded-file';
        
        const fileSize = (file.size / 1024).toFixed(1);
        const fileSizeUnit = file.size > 1024 * 1024 ? 'MB' : 'KB';
        
        fileElement.innerHTML = `
            <div class="uploaded-file-info">
                <i class="fas fa-file-alt"></i>
                <div>
                    <div class="uploaded-file-name">${file.name}</div>
                    <div class="uploaded-file-size">${fileSize} ${fileSizeUnit}</div>
                </div>
            </div>
            <button type="button" class="remove-file" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        uploadedFiles.appendChild(fileElement);
    });
}

function removeFile(index) {
    const fileInput = document.getElementById('trainingData');
    const dt = new DataTransfer();
    const files = Array.from(fileInput.files);
    
    files.splice(index, 1);
    files.forEach(file => dt.items.add(file));
    
    fileInput.files = dt.files;
    displayUploadedFiles(Array.from(fileInput.files));
}

function initSensorSelection() {
    const sensorItems = document.querySelectorAll('.sensor-item');
    
    sensorItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const label = item.querySelector('label');
        
        // Toggle selection when clicking the entire item
        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                updateSensorItemStyle(item, checkbox.checked);
            }
        });
        
        // Update style when checkbox changes
        checkbox.addEventListener('change', () => {
            updateSensorItemStyle(item, checkbox.checked);
        });
        
        // Initial style
        updateSensorItemStyle(item, checkbox.checked);
    });
}

function updateSensorItemStyle(item, isChecked) {
    if (isChecked) {
        item.style.borderColor = 'var(--primary-color)';
        item.style.background = 'var(--bg-primary)';
    } else {
        item.style.borderColor = 'var(--border-color)';
        item.style.background = 'var(--bg-secondary)';
    }
}

async function handleAddMachine(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    try {
        // Collect form data
        const formData = new FormData(form);
        
        // Validate form
        if (!validateForm(formData)) {
            showMessage('Please fix the errors in the form', 'error');
            return;
        }
        
        const machineData = {
            // Machine Identification
            machineName: formData.get('machineName'),
            machineType: formData.get('machineType'),
            manufacturer: formData.get('manufacturer'),
            model: formData.get('model'),
            serialNumber: formData.get('serialNumber'),
            assetTag: formData.get('assetTag'),
            
            // SCADA Configuration
            scadaSystem: formData.get('scadaSystem'),
            scadaVersion: formData.get('scadaVersion'),
            plcType: formData.get('plcType'),
            communicationProtocol: formData.get('communicationProtocol'),
            ipAddress: formData.get('ipAddress'),
            port: formData.get('port') ? parseInt(formData.get('port')) : null,
            
            // Sensor Configuration
            sensors: formData.getAll('sensors'),
            
            // Training Data Information
            dataDescription: formData.get('dataDescription')
        };
        
        // Add training data file
        const trainingDataFile = document.getElementById('trainingData').files[0];
        if (trainingDataFile) {
            machineData.trainingData = trainingDataFile;
        }
        
        console.log('Machine data to be sent:', machineData);
        
        // Send to backend for processing
        const response = await fetch('/api/dashboard/add-machine', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: createFormDataWithFile(machineData, trainingDataFile)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success message
            showMessage('Machine added successfully! Training anomaly detection model...', 'success');
            
            // Close modal
            document.getElementById('addMachineModal').classList.remove('show');
            
            // Refresh dashboard data
            setTimeout(() => {
                loadDashboardData();
            }, 2000);
            
        } else {
            showMessage(result.message || 'Failed to add machine', 'error');
        }
        
    } catch (error) {
        console.error('Error adding machine:', error);
        showMessage('Network error. Please try again.', 'error');
    } finally {
        // Reset loading state
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

function createFormDataWithFile(machineData, file) {
    const formData = new FormData();
    
    // Add all machine data as JSON string
    formData.append('machineData', JSON.stringify(machineData));
    
    // Add file separately
    if (file) {
        formData.append('trainingData', file);
    }
    
    return formData;
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
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
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
        alertsCountElement.textContent = data.stats.criticalMachines + data.stats.warningMachines;
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
        <div class="machine-card ${machine.status}">
            <div class="machine-header">
                <h3>${machine.name}</h3>
                <div class="machine-badges">
                    <span class="status-badge ${machine.status}">${machine.status}</span>
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
    // Placeholder for machine details view
    console.log('Viewing machine details for:', machineId);
    // In a real application, this would navigate to a machine details page
    // or open a modal with detailed SCADA information
    showMessage('Machine details view coming soon!', 'info');
}

function viewAnomalyData(machineId) {
    // Placeholder for anomaly data view
    console.log('Viewing anomaly data for:', machineId);
    // In a real application, this would show anomaly detection results
    // and training metrics
    showMessage('Anomaly detection data view coming soon!', 'info');
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
window.dashboardUtils = {
    formatNumber,
    formatPercentage,
    getStatusColor,
    loadDashboardData
}; 
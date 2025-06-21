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
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const formData = new FormData(form);
        const machineData = {};
        for (const [key, value] of formData.entries()) {
            if (key !== 'trainingData') {
                machineData[key] = value;
            }
        }
        
        const response = await fetch('/api/dashboard/add-machine', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: createFormDataWithFile(machineData, formData.get('trainingData'))
        });
        
        const result = await response.json();
        if (result.success) {
            showMessage('Machine added successfully! Model training has started.', 'success');
            document.getElementById('addMachineModal').classList.remove('show');
            setTimeout(loadDashboardData, 1000);
        } else {
            showMessage(result.message || 'Failed to add machine.', 'error');
        }
    } catch (error) {
        console.error('Error adding machine:', error);
        showMessage('A network error occurred. Please try again.', 'error');
    } finally {
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
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
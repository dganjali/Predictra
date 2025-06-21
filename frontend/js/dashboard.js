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
}

function initDashboard() {
    // Initialize logout functionality
    initLogout();
    
    // Initialize dashboard navigation
    initDashboardNav();
    
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

async function loadDashboardData() {
    const token = localStorage.getItem('token');
    
    try {
        // Load dashboard overview data
        const overviewResponse = await fetch('/api/dashboard/overview', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const overviewData = await overviewResponse.json();
        
        if (overviewData.success) {
            // Update dashboard with real data when implemented
            console.log('Dashboard overview data:', overviewData.data);
        }
        
        // Load machines data
        const machinesResponse = await fetch('/api/dashboard/machines', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const machinesData = await machinesResponse.json();
        
        if (machinesData.success) {
            // Update machines section when implemented
            console.log('Machines data:', machinesData.data);
        }
        
        // Load alerts data
        const alertsResponse = await fetch('/api/dashboard/alerts', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const alertsData = await alertsResponse.json();
        
        if (alertsData.success) {
            // Update alerts section when implemented
            console.log('Alerts data:', alertsData.data);
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Show error message to user
        if (window.authUtils && window.authUtils.showMessage) {
            window.authUtils.showMessage('Error loading dashboard data. Please refresh the page.', 'error');
        }
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
window.dashboardUtils = {
    formatNumber,
    formatPercentage,
    getStatusColor,
    loadDashboardData
}; 
// Main JavaScript file for navigation and general functionality

document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add scroll effect to navbar
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
            }
        });
    }
    
    // Check if user is authenticated and update navigation
    checkAuthStatus();

    // Initialize typewriter
    initTypewriter();

    // Dynamically load subscribe.js (wires the simple mailing-list forms)
    try {
        const s = document.createElement('script');
        s.src = 'js/subscribe.js';
        s.defer = true;
        document.body.appendChild(s);
    } catch (e) {
        console.warn('Failed to load subscribe script', e);
    }
});

// Check authentication status and update UI accordingly
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (token && user) {
        // User is logged in
        updateNavForAuthenticatedUser(user);
    } else {
        // User is not logged in
        updateNavForUnauthenticatedUser();
    }
}

// Update navigation for authenticated users
function updateNavForAuthenticatedUser(user) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;
    
    // Clear existing menu items
    navMenu.innerHTML = '';
    
    // Add authenticated user menu items
    const menuItems = [
        { href: '/dashboard', text: 'Dashboard', icon: 'fas fa-tachometer-alt' },
        { href: '/about', text: 'About', icon: 'fas fa-info-circle' },
        { href: '#', text: 'Profile', icon: 'fas fa-user', onclick: 'showUserProfile()' },
        { href: '#', text: 'Logout', icon: 'fas fa-sign-out-alt', onclick: 'logout()', class: 'btn-secondary' }
    ];
    
    menuItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        
        const link = document.createElement('a');
        link.href = item.href;
        link.className = `nav-link ${item.class || ''}`;
        link.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
        
        if (item.onclick) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                eval(item.onclick);
            });
        }
        
        li.appendChild(link);
        navMenu.appendChild(li);
    });
}

// Update navigation for unauthenticated users
function updateNavForUnauthenticatedUser() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;
    
    // Clear existing menu items
    navMenu.innerHTML = '';
    
    // Add unauthenticated user menu items
    const menuItems = [
        { href: '/', text: 'Home', icon: 'fas fa-home' },
        { href: '/about', text: 'About', icon: 'fas fa-info-circle' },
        { href: '/signin', text: 'Sign In', icon: 'fas fa-sign-in-alt' },
        { href: '/signup', text: 'Sign Up', icon: 'fas fa-user-plus', class: 'btn-primary' }
    ];
    
    menuItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        
        const link = document.createElement('a');
        link.href = item.href;
        link.className = `nav-link ${item.class || ''}`;
        link.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
        
        li.appendChild(link);
        navMenu.appendChild(li);
    });
}

// Logout function
function logout() {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to home page
    window.location.href = '/';
}

// Show user profile (placeholder function)
function showUserProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        alert(`User Profile:\nName: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nCompany: ${user.company || 'N/A'}`);
    }
}

// Utility function to show messages
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const icon = document.createElement('i');
    icon.className = getMessageIcon(type);
    
    const text = document.createElement('span');
    text.textContent = message;
    
    messageDiv.appendChild(icon);
    messageDiv.appendChild(text);
    
    // Insert at the top of the main content
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(messageDiv, main.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Get appropriate icon for message type
function getMessageIcon(type) {
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    return icons[type] || icons.info;
}

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility function to validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Utility function to validate password strength
function validatePassword(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    let strength = 0;
    let feedback = [];
    
    if (password.length >= minLength) strength++;
    else feedback.push(`At least ${minLength} characters`);
    
    if (hasUpperCase) strength++;
    else feedback.push('One uppercase letter');
    
    if (hasLowerCase) strength++;
    else feedback.push('One lowercase letter');
    
    if (hasNumbers) strength++;
    else feedback.push('One number');
    
    if (hasSpecialChar) strength++;
    else feedback.push('One special character');
    
    return {
        strength: strength,
        maxStrength: 5,
        feedback: feedback,
        isValid: strength >= 3
    };
}

// Export functions for use in other modules
window.authUtils = {
    checkAuthStatus,
    logout,
    showMessage,
    formatDate,
    validateEmail,
    validatePassword
};

function initTypewriter() {
    const container = document.getElementById('typewriter-container');
    if (!container) return;

    const textElement = container.querySelector('.typewriter-text');
    const cursorElement = container.querySelector('.cursor');

    const lines = [
        "Analyzing sensor data stream...",
        "Real-time anomaly detection in progress...",
        "Calculating Remaining Useful Lifetime (RUL)...",
        "Generating predictive maintenance alerts...",
        "Bayesian inference models updating...",
        "System operating at 99.8% efficiency.",
        "Monitoring pump_AX12... Status: Healthy",
        "Monitoring motor_B45... Status: Warning"
    ];

    let lineIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentLine = lines[lineIndex];
        
        if (isDeleting) {
            // Deleting text
            textElement.textContent = currentLine.substring(0, charIndex - 1);
            charIndex--;
        } else {
            // Typing text
            textElement.textContent = currentLine.substring(0, charIndex + 1);
            charIndex++;
        }

        let typeSpeed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentLine.length) {
            // Pause at end of line
            typeSpeed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            lineIndex = (lineIndex + 1) % lines.length;
            typeSpeed = 500;
        }
        
        setTimeout(type, typeSpeed);
    }

    type();
} 
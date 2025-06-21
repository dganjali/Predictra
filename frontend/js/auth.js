// Authentication JavaScript file for sign in and sign up functionality

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing auth...');
    // Initialize authentication functionality
    initAuth();
});

function initAuth() {
    console.log('initAuth called');
    // Check if we're on a sign in or sign up page
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    
    console.log('signinForm found:', !!signinForm);
    console.log('signupForm found:', !!signupForm);
    
    if (signinForm) {
        console.log('Initializing sign in form...');
        initSignIn(signinForm);
    }
    
    if (signupForm) {
        console.log('Initializing sign up form...');
        initSignUp(signupForm);
    }
    
    // Initialize password toggles
    initPasswordToggles();
    
    // Initialize password strength meter for signup
    initPasswordStrength();
}

// Simple email validation function
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Simple password validation function
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

function initSignIn(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // Clear previous errors
        clearErrors();
        
        // Get form data
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        
        // Validate form
        if (!validateSignInForm(email, password)) {
            return;
        }
        
        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Store token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Show success message
                if (window.authUtils && window.authUtils.showMessage) {
                    window.authUtils.showMessage('Sign in successful! Redirecting...', 'success');
                }
                
                // Redirect to dashboard immediately
                window.location.href = '/dashboard';
            } else {
                // Show error message
                showError('email', data.message || 'Sign in failed');
                if (window.authUtils && window.authUtils.showMessage) {
                    window.authUtils.showMessage(data.message || 'Sign in failed', 'error');
                }
            }
        } catch (error) {
            console.error('Sign in error:', error);
            showError('email', 'Network error. Please try again.');
            if (window.authUtils && window.authUtils.showMessage) {
                window.authUtils.showMessage('Network error. Please try again.', 'error');
            }
        } finally {
            // Reset loading state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
}

function initSignUp(form) {
    console.log('initSignUp called with form:', form);
    form.addEventListener('submit', async function(e) {
        console.log('Form submit event triggered!');
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        console.log('Submit button found:', !!submitBtn);
        
        // Clear previous errors
        clearErrors();
        
        // Get form data
        const formData = new FormData(form);
        const firstName = formData.get('firstName');
        const lastName = formData.get('lastName');
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const termsAccepted = formData.get('termsAccepted') === 'on';
        
        console.log('Form data:', { firstName, lastName, email, password: password ? '***' : 'empty', confirmPassword: confirmPassword ? '***' : 'empty', termsAccepted });
        
        // Validate form
        if (!validateSignUpForm(firstName, lastName, email, password, confirmPassword, termsAccepted)) {
            console.log('Form validation failed');
            return;
        }
        
        console.log('Form validation passed, sending request...');
        
        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password
                })
            });
            
            console.log('Response received:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                // Store token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Show success message
                if (window.authUtils && window.authUtils.showMessage) {
                    window.authUtils.showMessage('Account created successfully! Redirecting...', 'success');
                }
                
                // Redirect to dashboard immediately
                window.location.href = '/dashboard';
            } else {
                // Handle validation errors
                if (data.errors && Array.isArray(data.errors)) {
                    data.errors.forEach(error => {
                        showError(error.param, error.msg);
                    });
                } else {
                    showError('email', data.message || 'Sign up failed');
                }
                
                if (window.authUtils && window.authUtils.showMessage) {
                    window.authUtils.showMessage(data.message || 'Sign up failed', 'error');
                }
            }
        } catch (error) {
            console.error('Sign up error:', error);
            showError('email', 'Network error. Please try again.');
            if (window.authUtils && window.authUtils.showMessage) {
                window.authUtils.showMessage('Network error. Please try again.', 'error');
            }
        } finally {
            // Reset loading state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
    
    console.log('Signup form event listener attached');
}

function validateSignInForm(email, password) {
    let isValid = true;
    
    // Validate email
    if (!email || !email.trim()) {
        showError('email', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
    }
    
    // Validate password
    if (!password || !password.trim()) {
        showError('password', 'Password is required');
        isValid = false;
    }
    
    return isValid;
}

function validateSignUpForm(firstName, lastName, email, password, confirmPassword, termsAccepted) {
    let isValid = true;
    
    // Validate first name
    if (!firstName || !firstName.trim()) {
        showError('firstName', 'First name is required');
        isValid = false;
    } else if (firstName.trim().length < 2) {
        showError('firstName', 'First name must be at least 2 characters');
        isValid = false;
    }
    
    // Validate last name
    if (!lastName || !lastName.trim()) {
        showError('lastName', 'Last name is required');
        isValid = false;
    } else if (lastName.trim().length < 2) {
        showError('lastName', 'Last name must be at least 2 characters');
        isValid = false;
    }
    
    // Validate email
    if (!email || !email.trim()) {
        showError('email', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
    }
    
    // Validate password
    if (!password || !password.trim()) {
        showError('password', 'Password is required');
        isValid = false;
    } else {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            showError('password', 'Password is too weak. Please include uppercase, lowercase, numbers, and special characters.');
            isValid = false;
        }
    }
    
    // Validate confirm password
    if (!confirmPassword || !confirmPassword.trim()) {
        showError('confirmPassword', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }
    
    // Validate terms acceptance
    if (!termsAccepted) {
        showError('termsAccepted', 'You must accept the terms and conditions');
        isValid = false;
    }
    
    return isValid;
}

function initPasswordToggles() {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });
    });
}

function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (passwordInput && strengthFill && strengthText) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            
            if (!password) {
                strengthFill.className = 'strength-fill';
                strengthFill.style.width = '0%';
                strengthText.textContent = 'Password strength';
                return;
            }
            
            const validation = validatePassword(password);
            const percentage = (validation.strength / validation.maxStrength) * 100;
            
            strengthFill.style.width = percentage + '%';
            
            if (validation.strength <= 1) {
                strengthFill.className = 'strength-fill weak';
                strengthText.textContent = 'Weak';
            } else if (validation.strength <= 2) {
                strengthFill.className = 'strength-fill fair';
                strengthText.textContent = 'Fair';
            } else if (validation.strength <= 3) {
                strengthFill.className = 'strength-fill good';
                strengthText.textContent = 'Good';
            } else {
                strengthFill.className = 'strength-fill strong';
                strengthText.textContent = 'Strong';
            }
        });
    }
}

function showError(fieldName, message) {
    const errorElement = document.getElementById(fieldName + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
}

// Real-time validation for signup form
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        // Real-time email validation
        const emailInput = signupForm.querySelector('#email');
        if (emailInput) {
            emailInput.addEventListener('blur', function() {
                const email = this.value.trim();
                if (email && !validateEmail(email)) {
                    showError('email', 'Please enter a valid email address');
                } else {
                    clearFieldError('email');
                }
            });
        }
        
        // Real-time password confirmation validation
        const passwordInput = signupForm.querySelector('#password');
        const confirmPasswordInput = signupForm.querySelector('#confirmPassword');
        
        if (passwordInput && confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', function() {
                const password = passwordInput.value;
                const confirmPassword = this.value;
                
                if (confirmPassword && password !== confirmPassword) {
                    showError('confirmPassword', 'Passwords do not match');
                } else {
                    clearFieldError('confirmPassword');
                }
            });
        }
    }
});

function clearFieldError(fieldName) {
    const errorElement = document.getElementById(fieldName + 'Error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
} 
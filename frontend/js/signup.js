document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');

    // Define API URL based on environment
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:5001' 
        : 'https://blueshacksByteBite.onrender.com';

    try {
        const response = await fetch(`${API_URL}/api/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (data.success) {
            message.textContent = 'Signup successful! Redirecting to signin...';
            message.className = 'success';
            setTimeout(() => {
                window.location.href = 'signin.html';
            }, 1500);
        } else {
            message.textContent = data.message || 'Signup failed';
            message.className = 'error';
        }
    } catch (error) {
        message.textContent = 'Error connecting to server. Please try again.';
        message.className = 'error';
        console.error('Error during signup:', error);
    }
});

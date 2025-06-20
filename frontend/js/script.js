import { isAuthenticated, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Load default welcome page without authentication check
    document.querySelector('.container').innerHTML = `
        <h1>Welcome to ByteBite</h1>
        <div class="nav-buttons">
            <a href="/signin" class="btn">Sign In</a>
            <a href="/signup" class="btn">Sign Up</a>
        </div>
    `;
});

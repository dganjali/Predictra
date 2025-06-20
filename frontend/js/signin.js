const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : 'https://blueshacksByteBite.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
  // Clear any stored token and username on every load of the sign-in page
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  const loginForm = document.getElementById("signin-form");

  loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Get the values from the login form
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      // Ensure both fields are filled
      if (!username || !password) {
          alert("Please fill in both username and password.");
          return;
      }

      try {
          // Send a POST request to the login API
          const response = await fetch(`${API_URL}/api/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                  email: username, // Change username to email
                  password 
              })
          });
          
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();

          if (data.token) {
              // Save the token and the entered username (not data.username)
              localStorage.setItem("token", data.token);
              localStorage.setItem("username", username);
              
              // Redirect to the dashboard page
              window.location.href = "/dashboard.html";
          } else {
              alert(data.message || "Login failed. Please check your credentials.");
          }
      } catch (error) {
          console.error("Login error:", error);
          alert("Server connection failed. Please try again.");
      }
  });
});

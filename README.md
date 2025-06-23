# Predictra - An All-In-One Personalized Predictive Maintenance Dashboard for Factory Owners
## Any _Machine_, One _Dashboard_, No More _Surprises_.
### Built by Danial Ganjali, Arjan Waraich, Justin Rui, Emerson Ni
A full-stack platform for machine-specific Remaining Useful Lifetime (RUL) estimation using anomaly detection, Bayesian inferencing, LSTM networking, bootstrapping & XGboosting. Maximize uptime, increase efficiency, optimizing maintenance schedules and know **which**  machines are failing, **when**.

## 🚀 Features

- **User Authentication**: Secure sign up, sign in, and JWT-based authentication
- **Modern UI**: Responsive design with beautiful, modern interface
- **Dashboard**: Protected dashboard area for authenticated users
- **RUL Estimation**: Framework for predictive maintenance (to be implemented)
- **Real-time Monitoring**: Placeholder for real-time machine monitoring
- **Security**: Password hashing, rate limiting, and input validation

## 🏗️ Project Structure

```
SpurHacks2025/
├── backend/
│   ├── server.js              # Main Express server
│   ├── models/
│   │   └── User.js            # MongoDB User model
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   └── routes/
│       ├── auth.js            # Authentication routes
│       └── dashboard.js       # Dashboard API routes
├── frontend/
│   ├── index.html             # Home page
│   ├── signin.html            # Sign in page
│   ├── signup.html            # Sign up page
│   ├── dashboard.html         # Dashboard page
│   ├── about.html             # About page
│   ├── css/
│   │   └── styles.css         # Main stylesheet
│   └── js/
│       ├── main.js            # Main JavaScript utilities
│       ├── auth.js            # Authentication JavaScript
│       └── dashboard.js       # Dashboard JavaScript
├── package.json               # Node.js dependencies
├── env.example               # Environment variables template
└── README.md                 # This file
```

## 🛠️ Technology Stack

### Backend
- **Anomaly LSTM Network** - Generating RUL Training features from Healthy Machine Runtime Data w/ Bayesing Inferencing (for Anomaly Scoring)
- **Forecasting LSTM Network** - Reccurently Timestamping Training Features (RUL Targets) & Fitting | Modelling and Forecasting
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **helmet** - Security middleware
- **cors** - Cross-origin resource sharing

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with CSS Grid and Flexbox
- **Vanilla JavaScript** - Client-side functionality
- **Font Awesome** - Icons

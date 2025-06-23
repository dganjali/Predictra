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

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn**

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd SpurHacks2025
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

1. Copy the environment template:
```bash
cp env.example .env
```

2. Edit the `.env` file with your configuration:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/predictive_maintenance_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRE=24h

# Security
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important**: Replace `your_super_secret_jwt_key_here_make_it_long_and_random` with a strong, random JWT secret key.

### 4. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# On Windows
net start MongoDB
```

### 5. Run the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📱 Usage

### 1. Home Page
- Visit `http://localhost:3000` to see the landing page
- Learn about the predictive maintenance features
- Navigate to sign up or sign in

### 2. User Registration
- Click "Sign Up" or visit `http://localhost:3000/signup`
- Fill in your details (first name, last name, email, password)
- Optionally provide company information
- Accept terms and conditions
- Click "Create Account"

### 3. User Authentication
- Click "Sign In" or visit `http://localhost:3000/signin`
- Enter your email and password
- Click "Sign In"

### 4. Dashboard
- After successful authentication, you'll be redirected to the dashboard
- View your user information
- The dashboard is ready for implementing RUL estimation features

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Authenticate user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Dashboard (Protected)
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/machines` - Get machines list
- `GET /api/dashboard/alerts` - Get system alerts

## 🔒 Security Features

- **Password Hashing**: Passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Server-side validation using express-validator
- **Rate Limiting**: Protection against brute force attacks
- **CORS Protection**: Configured for security
- **Helmet**: Security headers middleware

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern Interface**: Clean, professional design
- **Form Validation**: Real-time client-side validation
- **Password Strength Meter**: Visual password strength indicator
- **Loading States**: User feedback during operations
- **Error Handling**: Clear error messages
- **Success Feedback**: Confirmation messages

## 🚧 Next Steps for RUL Implementation

The authentication system is complete. To implement the RUL estimation features:

1. **Create Machine Models**: Add MongoDB schemas for machines, sensors, and metadata
2. **Implement Anomaly Detection**: Add autoencoder models for anomaly scoring
3. **Bayesian Inference**: Implement the RUL estimation pipeline
4. **Real-time Data**: Add WebSocket support for real-time monitoring
5. **Dashboard Charts**: Integrate charting libraries (Chart.js, D3.js)
6. **Machine Management**: Add CRUD operations for machines
7. **Alert System**: Implement notification system

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check the `MONGODB_URI` in your `.env` file
- Verify MongoDB is accessible on the specified port

### Port Already in Use
- Change the `PORT` in your `.env` file
- Or kill the process using the current port

### JWT Issues
- Ensure `JWT_SECRET` is set in your `.env` file
- Make sure the secret is long and random

### CORS Issues
- Check the CORS configuration in `server.js`
- Update the allowed origins for your domain

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/predictive_maintenance_db |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRE` | JWT expiration time | 24h |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

For support or questions:
- Email: info@predictivemaintenance.com
- Phone: +1 (555) 123-4567

---

**Note**: This is a foundation for the predictive maintenance dashboard. The actual RUL estimation models and machine learning components need to be implemented based on your specific requirements and data sources.

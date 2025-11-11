const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Trust the first proxy in front of the app (e.g., on Render)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://cdnjs.cloudflare.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      "font-src": ["'self'", "https://cdnjs.cloudflare.com"],
    },
  // Backend server disabled in this repository. This project is now a static
  // landing page deployed on Vercel with a small serverless subscribe endpoint
  // at `/api/subscribe`. The original Node/Express backend has been intentionally
  // disabled. To re-enable a full backend, replace this file with an Express
  // server and restore the `routes/` and `models/` code.

  module.exports = null;
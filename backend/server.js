require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const debounce = require('debounce-promise');
const User = require('./models/User');
const { spawn } = require('child_process');

const app = express();
app.use(cors({
  origin: ['http://localhost:5001', 'http://localhost:5002', 'https://blueshacksByteBite.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));

// Environment variables
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI; // Always use Atlas cluster
const JWT_SECRET = process.env.JWT_SECRET;
const NUTRITIONIX_APP_ID = process.env.NUTRITIONIX_APP_ID;
const NUTRITIONIX_API_KEY = process.env.NUTRITIONIX_API_KEY;

// Nutritionix API Integration
const searchNutritionix = debounce(async (query) => {
  try {
    const response = await axios.get(
      'https://trackapi.nutritionix.com/v2/search/instant',
      {
        params: { query },
        headers: {
          'x-app-id': NUTRITIONIX_APP_ID,
          'x-app-key': NUTRITIONIX_API_KEY
        }
      }
    );
    return response.data.common.slice(0, 5).map(item => item.food_name);
  } catch (error) {
    console.error('Error searching Nutritionix:', error);
    return [];
  }
}, 300);

// MongoDB connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    retryWrites: true,
    w: 'majority',
    authSource: 'admin'
}).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if MongoDB connection fails
});

// MongoDB schemas
const StockSchema = new mongoose.Schema({
  type: String,
  food_type: {
    type: String,
    enum: ['Snacks', 'Protein', 'Vegetables', 'Grain', 'Dairy', 'Canned Goods'],
    required: true
  },
  quantity: Number,
  expiration_date: Date,
  days_until_expiry: {
    type: Number,
    default: function() {
      return Math.ceil((this.expiration_date - new Date()) / (1000 * 60 * 60 * 24));
    }
  },
  weekly_customers: { type: Number, default: 100 },
  nutritional_value: {
    calories: Number,
    sugars: Number,
    nutritional_ratio: {
      type: Number,
      default: function() {
        return this.nutritional_value.calories / (this.nutritional_value.sugars + 1);
      }
    }
  },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const Stock = mongoose.model('Stock', StockSchema);

// Middleware to verify JWT token for restricted pages
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Function to fetch nutritional info
const getNutritionalInfo = async (foodType) => {
  try {
    const response = await axios.post(
      'https://trackapi.nutritionix.com/v2/natural/nutrients',
      { query: foodType },
      {
        headers: {
          'x-app-id': NUTRITIONIX_APP_ID,
          'x-app-key': NUTRITIONIX_API_KEY,
        }
      }
    );

    if (response.data?.foods?.[0]) {
      const food = response.data.foods[0];
      return {
        calories: food.nf_calories,
        total_fat: food.nf_total_fat,
        protein: food.nf_protein,
        carbohydrates: food.nf_total_carbohydrate,
        sugars: food.nf_sugars,
        sodium: food.nf_sodium
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching nutritional info:', error);
    return null;
  }
};

// Auth endpoints
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Check if user exists already
    const existingUser = await User.findOne({ 
      $or: [
        { email: email },
        { username: username }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await user.save();
    res.json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating user' 
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Look for user by email or username
    const user = await User.findOne({
      $or: [
        { email: email },
        { username: email } // This allows logging in with username too
      ]
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true, 
      token,
      email: user.email,
      username: user.username // Use the actual username
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Error logging in' });
  }
});

// Inventory endpoints
app.get('/api/search', verifyToken, async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);

    try {
        const response = await axios.get(
            'https://trackapi.nutritionix.com/v2/search/instant',
            {
                params: { query },
                headers: {
                    'x-app-id': NUTRITIONIX_APP_ID,
                    'x-app-key': NUTRITIONIX_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const suggestions = response.data.common.slice(0, 5).map(item => item.food_name);
        res.json(suggestions);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch suggestions',
            details: error.message 
        });
    }
});

app.get('/api/inventory', verifyToken, async (req, res) => {
  try {
    const inventory = await Stock.find({ addedBy: req.user.id })
      .sort({ createdAt: -1 });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.post('/api/inventory/add', verifyToken, async (req, res) => {
  try {
    const { type, category, quantity, expiration_date } = req.body;
    const userId = req.user.id;
    
    const nutritionalValue = await getNutritionalInfo(type) || {
      calories: 100,  // Default values if API fails
      sugars: 0
    };

    // First save to MongoDB
    const newItem = new Stock({
      type,
      food_type: category,
      quantity: Number(quantity),
      expiration_date,
      addedBy: userId,
      nutritional_value: {
        calories: nutritionalValue.calories || 100,
        sugars: nutritionalValue.sugars || 0,
        nutritional_ratio: (nutritionalValue.calories || 100) / ((nutritionalValue.sugars || 0) + 1)
      },
      weekly_customers: 100
    });

    await newItem.save();

    // Then update Excel file via Python script
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const pythonProcess = spawn(pythonPath, [
      path.resolve(__dirname, '../backend-model/api.py'),
      'add_item',
      JSON.stringify({
        user_id: userId.toString(),
        item_data: {
          type,
          category,
          quantity: Number(quantity),
          expiration_date,
          nutritional_value: nutritionalValue
        }
      })
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('Python Error:', stderr);
    });

    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python process failed:', stderr);
          reject(new Error('Failed to update Excel file'));
          return;
        }
        resolve();
      });
    });

    res.json({ success: true, newItem });
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({ 
      error: 'Failed to add item', 
      details: error.message 
    });
  }
});

// Add delete endpoint
app.delete('/api/inventory/delete/:id', verifyToken, async (req, res) => {
    try {
        const item = await Stock.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Remove the ownership check since items are shared
        await Stock.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

app.post('/api/predict', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const inventory = await Stock.find({ addedBy: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!inventory.length) {
      return res.json({
        success: true,
        distribution_plan: []
      });
    }

    const formattedInventory = inventory.map(item => ({
      food_item: item.type,
      food_type: item.food_type,
      current_quantity: parseInt(item.quantity),
      expiration_date: new Date(item.expiration_date).toISOString(),
      days_until_expiry: Math.max(0, Math.ceil((new Date(item.expiration_date) - new Date()) / (1000 * 60 * 60 * 24))),
      calories: parseInt(item.nutritional_value.calories) || 100,
      sugars: parseInt(item.nutritional_value.sugars) || 0,
      nutritional_ratio: parseFloat(item.nutritional_value.nutritional_ratio) || 1,
      weekly_customers: parseInt(item.weekly_customers) || 100
    }));

    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.resolve(__dirname, '../backend-model/api.py');
    
    // Ensure the Python script exists
    if (!require('fs').existsSync(scriptPath)) {
      throw new Error('Python script not found: ' + scriptPath);
    }

    const pythonProcess = spawn(pythonPath, [
      scriptPath,
      'predict',
      JSON.stringify({
        user_id: userId.toString(),
        inventory_data: formattedInventory
      })
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python stderr:', stderr);
          reject(new Error(stderr || 'Python process failed'));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(res.json(result));
        } catch (parseError) {
          console.error('Parse error:', parseError);
          console.error('Raw output:', stdout);
          reject(new Error('Failed to parse prediction results'));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('Process error:', error);
        reject(error);
      });
    });

  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get distribution plan'
    });
  }
});

// Serve the sign-in page on root
app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'signin.html'));
});

// Protect the dashboard route with verifyToken middleware
app.get('/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'dashboard.html'));
});

// Serve other frontend pages (signup, index, etc.)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// API error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    details: err.message
  });
});

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'signin.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'signup.html'));
});

app.get('/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'dashboard.html'));
});

// Handle 404s for HTML requests
app.get('*.html', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../frontend', '404.html'));
});

// Handle 404s for API requests
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Update static file serving
app.use(express.static(path.join(__dirname, '../frontend')));

// Add specific mime type for CSS
app.get('*.css', function(req, res, next) {
    res.type('text/css');
    next();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
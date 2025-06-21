const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'training_data');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only CSV, Excel, JSON, and TXT files are allowed.'), false);
        }
    }
});

// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview data
// @access  Private
router.get('/overview', auth, async (req, res) => {
  try {
    // Placeholder data - you'll implement actual dashboard logic here
    const overviewData = {
      totalMachines: 0,
      criticalAlerts: 0,
      maintenanceDue: 0,
      healthyMachines: 0,
      recentActivity: []
    };

    res.json({
      success: true,
      data: overviewData
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/machines
// @desc    Get list of machines
// @access  Private
router.get('/machines', auth, async (req, res) => {
  try {
    // Placeholder data - you'll implement actual machine data here
    const machines = [];

    res.json({
      success: true,
      data: machines
    });
  } catch (error) {
    console.error('Get machines error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/alerts
// @desc    Get system alerts
// @access  Private
router.get('/alerts', auth, async (req, res) => {
  try {
    // Placeholder data - you'll implement actual alert system here
    const alerts = [];

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get dashboard data
router.get('/data', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        // Placeholder dashboard data - in a real app, this would come from a database
        const dashboardData = {
            user: {
                name: user.firstName + ' ' + user.lastName,
                email: user.email
            },
            machines: [
                {
                    id: 'machine_001',
                    name: 'Pump Station A',
                    type: 'pump',
                    status: 'healthy',
                    healthScore: 95,
                    rulEstimate: 1825,
                    lastUpdated: new Date().toISOString(),
                    location: 'Building A, Floor 2, Line 3',
                    criticality: 'critical',
                    scadaSystem: 'Siemens WinCC'
                },
                {
                    id: 'machine_002',
                    name: 'Conveyor Line 3',
                    type: 'conveyor',
                    status: 'warning',
                    healthScore: 78,
                    rulEstimate: 365,
                    lastUpdated: new Date().toISOString(),
                    location: 'Building B, Floor 1, Line 1',
                    criticality: 'important',
                    scadaSystem: 'Rockwell FactoryTalk'
                }
            ],
            alerts: [
                {
                    id: 'alert_001',
                    machineId: 'machine_002',
                    machineName: 'Conveyor Line 3',
                    type: 'warning',
                    message: 'Vibration levels approaching threshold',
                    timestamp: new Date().toISOString()
                }
            ],
            stats: {
                totalMachines: 2,
                healthyMachines: 1,
                warningMachines: 1,
                criticalMachines: 0,
                averageHealthScore: 86.5
            }
        };
        
        res.json({ success: true, data: dashboardData });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
    }
});

// Add new machine with SCADA configuration and training data
router.post('/add-machine', auth, upload.single('trainingData'), async (req, res) => {
    try {
        // Parse machine data from JSON string
        const machineData = JSON.parse(req.body.machineData);
        
        // Validate required fields
        const requiredFields = [
            'machineName', 'machineType', 'manufacturer', 'model', 
            'serialNumber', 'assetTag', 'scadaSystem', 'location', 
            'installationDate', 'criticality', 'detectionAlgorithm', 'sensitivity'
        ];
        
        for (const field of requiredFields) {
            if (!machineData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Missing required field: ${field}` 
                });
            }
        }
        
        // Validate sensors
        if (!machineData.sensors || machineData.sensors.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one sensor must be selected' 
            });
        }
        
        // Validate training data file
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Training data file is required' 
            });
        }
        
        // Validate data splits
        if (machineData.trainingSplit + machineData.validationSplit !== 100) {
            return res.status(400).json({ 
                success: false, 
                message: 'Training and validation splits must equal 100%' 
            });
        }
        
        console.log('Processing SCADA machine addition:', machineData.machineName);
        console.log('Training data file:', req.file.originalname);
        
        // In a real application, you would:
        // 1. Save machine data to database
        // 2. Process the training data file
        // 3. Train the anomaly detection model
        // 4. Store the trained model
        
        // For now, we'll simulate the process
        const machineId = `machine_${Date.now()}`;
        
        // Simulate training process
        const trainingResult = await simulateModelTraining(machineData, req.file);
        
        res.json({
            success: true,
            message: 'Machine added successfully and anomaly detection model trained',
            data: {
                machineId: machineId,
                machineName: machineData.machineName,
                trainingFile: req.file.originalname,
                modelStatus: 'trained',
                trainingMetrics: trainingResult.metrics,
                nextRetraining: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
            }
        });
        
    } catch (error) {
        console.error('Add machine error:', error);
        
        // Clean up uploaded file if there was an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to add machine' 
        });
    }
});

// Get machine details and sensor data
router.get('/machine/:machineId', auth, async (req, res) => {
    try {
        const { machineId } = req.params;
        
        // In a real application, you would fetch this from a database
        // For now, return placeholder data
        const machineData = {
            id: machineId,
            name: 'Pump Station A',
            type: 'pump',
            manufacturer: 'Siemens',
            model: '1LE1001-1DB32',
            serialNumber: 'SN2024-001234',
            assetTag: 'ASSET-2024-001',
            scadaSystem: 'Siemens WinCC',
            scadaVersion: '2020 R2',
            plcType: 'Siemens S7',
            communicationProtocol: 'PROFINET',
            ipAddress: '192.168.1.100',
            port: 4840,
            location: 'Building A, Floor 2, Line 3',
            department: 'Production',
            installationDate: '2023-01-15',
            lastMaintenance: '2024-01-15',
            operatingHours: 16,
            maintenanceInterval: 180,
            criticality: 'critical',
            operatingMode: 'continuous',
            status: 'healthy',
            healthScore: 95,
            rulEstimate: 1825,
            sensors: ['temperature', 'vibration', 'current', 'speed'],
            lastUpdated: new Date().toISOString(),
            sensorData: {
                temperature: { value: 65.2, unit: '°C', status: 'normal' },
                vibration: { value: 4.8, unit: 'mm/s', status: 'normal' },
                current: { value: 15.3, unit: 'A', status: 'normal' },
                speed: { value: 1650, unit: 'RPM', status: 'normal' }
            },
            modelInfo: {
                algorithm: 'Autoencoder',
                sensitivity: 0.90,
                lastTrained: '2024-01-15T10:00:00Z',
                accuracy: 94.2,
                nextRetraining: '2024-02-15T10:00:00Z'
            }
        };
        
        res.json({ success: true, data: machineData });
    } catch (error) {
        console.error('Machine details error:', error);
        res.status(500).json({ success: false, message: 'Failed to load machine details' });
    }
});

// Get sensor data for a machine
router.get('/machine/:machineId/sensor-data', auth, async (req, res) => {
    try {
        const { machineId } = req.params;
        const { hours = 24 } = req.query;
        
        // In a real application, you would fetch this from a time-series database
        // For now, return placeholder sensor data
        const sensorData = generatePlaceholderSensorData(machineId, parseInt(hours));
        
        res.json({ success: true, data: sensorData });
    } catch (error) {
        console.error('Sensor data error:', error);
        res.status(500).json({ success: false, message: 'Failed to load sensor data' });
    }
});

// Helper function to simulate model training
async function simulateModelTraining(machineData, trainingFile) {
    // Simulate training time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock training metrics
    const metrics = {
        accuracy: 85 + Math.random() * 15, // 85-100%
        precision: 80 + Math.random() * 20, // 80-100%
        recall: 75 + Math.random() * 25, // 75-100%
        f1Score: 80 + Math.random() * 20, // 80-100%
        trainingTime: 120 + Math.random() * 180, // 2-5 minutes
        dataPoints: machineData.dataPoints || 10000,
        features: machineData.sensors.length,
        algorithm: machineData.detectionAlgorithm
    };
    
    return { metrics };
}

// Helper function to generate placeholder sensor data
function generatePlaceholderSensorData(machineId, hours) {
    const data = [];
    const baseTime = new Date();
    baseTime.setHours(baseTime.getHours() - hours);
    
    for (let i = 0; i < hours * 12; i++) { // 12 data points per hour
        const timestamp = new Date(baseTime.getTime() + i * 5 * 60 * 1000); // 5-minute intervals
        
        data.push({
            timestamp: timestamp.toISOString(),
            machineId: machineId,
            temperature: 60 + Math.random() * 20 + Math.sin(i * 0.1) * 5,
            vibration: 3 + Math.random() * 4 + Math.sin(i * 0.05) * 2,
            current: 12 + Math.random() * 6 + Math.sin(i * 0.08) * 3,
            speed: 1500 + Math.random() * 200 + Math.sin(i * 0.03) * 100,
            healthScore: 85 + Math.random() * 15,
            rulEstimate: 1000 + Math.random() * 1000,
            status: 'healthy',
            anomalyScore: Math.random() * 0.1 // Low anomaly scores for healthy data
        });
    }
    
    return data;
}

module.exports = router; 
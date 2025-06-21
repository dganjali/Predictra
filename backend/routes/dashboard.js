const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Machine = require('../models/Machine');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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
        fileSize: 500 * 1024 * 1024 // 500MB limit
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
    // Get user's machines
    const machines = await Machine.find({ userId: req.user._id });
    
    const overviewData = {
      totalMachines: machines.length,
      criticalAlerts: machines.filter(m => m.status === 'critical').length,
      maintenanceDue: machines.filter(m => {
        if (!m.lastMaintenance || !m.maintenanceInterval) return false;
        const daysSinceMaintenance = (Date.now() - m.lastMaintenance.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceMaintenance >= m.maintenanceInterval;
      }).length,
      healthyMachines: machines.filter(m => m.status === 'healthy').length,
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
// @desc    Get list of machines for the current user
// @access  Private
router.get('/machines', auth, async (req, res) => {
  try {
    const machines = await Machine.find({ userId: req.user._id }).sort({ createdAt: -1 });

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
// @desc    Get system alerts for the current user
// @access  Private
router.get('/alerts', auth, async (req, res) => {
  try {
    // Get machines with warnings or critical status
    const alertMachines = await Machine.find({ 
      userId: req.user._id,
      status: { $in: ['warning', 'critical'] }
    });

    const alerts = alertMachines.map(machine => ({
      id: machine._id,
      machineId: machine._id,
      machineName: machine.machineName,
      type: machine.status,
      message: `Machine ${machine.machineName} is in ${machine.status} status`,
      timestamp: machine.lastUpdated
    }));

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
        const user = await User.findById(req.user._id).select('-password');
        
        // Get user's machines
        const machines = await Machine.find({ userId: req.user._id }).sort({ createdAt: -1 });
        
        // Get alerts
        const alertMachines = await Machine.find({ 
            userId: req.user._id,
            status: { $in: ['warning', 'critical'] }
        });

        const alerts = alertMachines.map(machine => ({
            id: machine._id,
            machineId: machine._id,
            machineName: machine.machineName,
            type: machine.status,
            message: `Machine ${machine.machineName} is in ${machine.status} status`,
            timestamp: machine.lastUpdated
        }));

        // Calculate stats
        const stats = {
            totalMachines: machines.length,
            healthyMachines: machines.filter(m => m.status === 'healthy').length,
            warningMachines: machines.filter(m => m.status === 'warning').length,
            criticalMachines: machines.filter(m => m.status === 'critical').length,
            averageHealthScore: machines.length > 0 
                ? machines.reduce((sum, m) => sum + m.healthScore, 0) / machines.length 
                : 0
        };
        
        const dashboardData = {
            user: {
                name: user.firstName + ' ' + user.lastName,
                email: user.email
            },
            machines: machines.map(machine => ({
                id: machine._id,
                name: machine.machineName,
                type: machine.machineType,
                status: machine.status,
                healthScore: machine.healthScore,
                rulEstimate: machine.rulEstimate,
                lastUpdated: machine.lastUpdated,
                location: machine.location,
                criticality: machine.criticality,
                scadaSystem: machine.scadaSystem
            })),
            alerts: alerts,
            stats: stats
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
            'machineName', 'machineType', 'model', 
            'serialNumber', 'scadaSystem'
        ];
        
        for (const field of requiredFields) {
            if (!machineData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Missing required field: ${field}` 
                });
            }
        }
        
        /*
        // Validate sensors - REMOVED PER USER REQUEST
        if (!machineData.sensors || machineData.sensors.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one sensor must be selected' 
            });
        }
        */
        
        // Validate training data file
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Training data file is required' 
            });
        }
        
        console.log('Processing SCADA machine addition:', machineData.machineName);
        console.log('Training data file:', req.file.originalname);
        
        // Create new machine record
        const newMachine = new Machine({
            userId: req.user._id,
            // Machine Identification
            machineName: machineData.machineName,
            machineType: machineData.machineType,
            manufacturer: machineData.manufacturer,
            model: machineData.model,
            serialNumber: machineData.serialNumber,
            assetTag: machineData.assetTag,
            
            // SCADA Configuration
            scadaSystem: machineData.scadaSystem,
            scadaVersion: machineData.scadaVersion,
            plcType: machineData.plcType,
            communicationProtocol: machineData.communicationProtocol,
            ipAddress: machineData.ipAddress,
            port: machineData.port,

            // Sensor Configuration
            sensors: machineData.sensors,
            dataDescription: machineData.dataDescription,
            trainingDataPath: req.file.path,
            modelStatus: 'training'
        });
        
        // Save machine to database
        await newMachine.save();
        
        // Asynchronously start the model training process
        trainAnomalyDetectionModel(newMachine._id, req.user._id, req.file.path);

        res.status(201).json({ 
            success: true, 
            message: 'Machine added and model training started.', 
            data: newMachine 
        });

    } catch (error) {
        console.error('Add machine error:', error);
        
        // Clean up uploaded file if there's an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting training file after failed machine creation:", err);
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add machine. ' + error.message 
        });
    }
});

// Function to call the Python training script
function trainAnomalyDetectionModel(machineId, userId, dataPath) {
    const pythonScriptPath = path.join(__dirname, '..', 'models', 'anomaly.py');
    const pythonProcess = spawn('python3', [pythonScriptPath, userId.toString(), machineId.toString(), dataPath]);

    pythonProcess.stdout.on('data', async (data) => {
        const output = data.toString();
        console.log(`[Training Output for ${machineId}]: ${output}`);
        try {
            const result = JSON.parse(output);
            if (result.success) {
                await Machine.findByIdAndUpdate(machineId, { 
                    modelStatus: 'trained',
                    lastUpdated: Date.now(),
                    operationalStatus: 'active'
                });
                console.log(`Model for machine ${machineId} trained successfully.`);
            } else {
                await Machine.findByIdAndUpdate(machineId, { 
                    modelStatus: 'failed',
                    operationalStatus: 'error',
                    statusDetails: `Training failed: ${result.error}`
                });
                console.error(`Training failed for machine ${machineId}: ${result.error}`);
            }
        } catch (e) {
            // In case of non-JSON output, just log it
             console.log(`[Training Log for ${machineId}]: ${output}`);
        }
    });

    pythonProcess.stderr.on('data', async (data) => {
        const errorMsg = data.toString();
        console.error(`[Training Error for ${machineId}]: ${errorMsg}`);
        try {
             await Machine.findByIdAndUpdate(machineId, { 
                modelStatus: 'failed',
                operationalStatus: 'error',
                statusDetails: `Training script error: ${errorMsg.substring(0, 200)}...` // Truncate long errors
            });
        } catch (dbError) {
            console.error(`Failed to update machine status after training error for ${machineId}:`, dbError);
        }
    });

    pythonProcess.on('close', (code) => {
        console.log(`Training process for machine ${machineId} exited with code ${code}`);
        if (code !== 0) {
            // Handle cases where the process exits with an error code but hasn't been marked as failed
             Machine.findOne({_id: machineId}).then(machine => {
                if (machine && machine.modelStatus !== 'trained') {
                    machine.modelStatus = 'failed';
                    machine.operationalStatus = 'error';
                    machine.statusDetails = `Training process exited with non-zero code: ${code}. Check logs.`;
                    return machine.save();
                }
            }).catch(err => console.error('Error updating machine on script exit error:', err));
        }
    });
}

// @route   GET /api/dashboard/machine/:id/training-status
// @desc    Get the model training status for a specific machine
// @access  Private
router.get('/machine/:id/training-status', auth, async (req, res) => {
    try {
        const machine = await Machine.findById(req.params.id);

        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }

        // Ensure the machine belongs to the user
        if (machine.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized for this machine' });
        }

        res.json({
            success: true,
            data: {
                machineId: machine._id,
                machineName: machine.machineName,
                modelStatus: machine.modelStatus,
                statusDetails: machine.statusDetails,
                lastUpdated: machine.lastUpdated
            }
        });

    } catch (error) {
        console.error('Get training status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get machine details and sensor data
router.get('/machine/:machineId', auth, async (req, res) => {
    try {
        const { machineId } = req.params;
        
        // Find machine belonging to the current user
        const machine = await Machine.findOne({ 
            _id: machineId, 
            userId: req.user._id 
        });
        
        if (!machine) {
            return res.status(404).json({ 
                success: false, 
                message: 'Machine not found' 
            });
        }
        
        // Return machine data
        const machineData = {
            id: machine._id,
            name: machine.machineName,
            type: machine.machineType,
            manufacturer: machine.manufacturer,
            model: machine.model,
            serialNumber: machine.serialNumber,
            assetTag: machine.assetTag,
            scadaSystem: machine.scadaSystem,
            scadaVersion: machine.scadaVersion,
            plcType: machine.plcType,
            communicationProtocol: machine.communicationProtocol,
            ipAddress: machine.ipAddress,
            port: machine.port,
            location: machine.location,
            department: machine.department,
            installationDate: machine.installationDate,
            lastMaintenance: machine.lastMaintenance,
            operatingHours: machine.operatingHours,
            maintenanceInterval: machine.maintenanceInterval,
            criticality: machine.criticality,
            operatingMode: machine.operatingMode,
            status: machine.status,
            healthScore: machine.healthScore,
            rulEstimate: machine.rulEstimate,
            sensors: machine.sensors,
            lastUpdated: machine.lastUpdated,
            sensorData: {
                temperature: { value: 65.2, unit: '°C', status: 'normal' },
                vibration: { value: 4.8, unit: 'mm/s', status: 'normal' },
                current: { value: 15.3, unit: 'A', status: 'normal' },
                speed: { value: 1650, unit: 'RPM', status: 'normal' }
            },
            modelInfo: {
                algorithm: machine.trainingMetrics?.algorithm || 'Autoencoder',
                sensitivity: 0.90,
                lastTrained: machine.lastTrained,
                accuracy: machine.trainingMetrics?.accuracy || 94.2,
                nextRetraining: machine.nextRetraining
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
        
        // Verify machine belongs to the current user
        const machine = await Machine.findOne({ 
            _id: machineId, 
            userId: req.user._id 
        });
        
        if (!machine) {
            return res.status(404).json({ 
                success: false, 
                message: 'Machine not found' 
            });
        }
        
        // In a real application, you would fetch this from a time-series database
        // For now, return placeholder sensor data
        const sensorData = generatePlaceholderSensorData(machineId, parseInt(hours));
        
        res.json({ success: true, data: sensorData });
    } catch (error) {
        console.error('Sensor data error:', error);
        res.status(500).json({ success: false, message: 'Failed to load sensor data' });
    }
});

// Placeholder for simulating data
async function simulateModelTraining(machineData, trainingFile) {
    console.log(`Simulating model training for ${machineData.machineName}...`);
    // This is a mock function. In a real scenario, this would trigger a Python script.
    // Simulate training time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock training metrics
    const metrics = {
        accuracy: 85 + Math.random() * 15, // 85-100%
        precision: 80 + Math.random() * 20, // 80-100%
        recall: 75 + Math.random() * 25, // 75-100%
        f1Score: 80 + Math.random() * 20, // 80-100%
        trainingTime: 120 + Math.random() * 180, // 2-5 minutes
        dataPoints: 10000, // Default value
        features: machineData.sensors.length,
        algorithm: 'Autoencoder' // Default algorithm
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
const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Machine = require('../models/Machine');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only .csv files are allowed!'), false);
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
                _id: machine._id,
                machineName: machine.machineName,
                machineType: machine.machineType,
                manufacturer: machine.manufacturer,
                model: machine.model,
                serialNumber: machine.serialNumber,
                status: machine.status,
                healthScore: machine.healthScore,
                rulEstimate: machine.rulEstimate,
                lastUpdated: machine.lastUpdated,
                sensors: machine.sensors,
                training_status: machine.training_status,
                model_params: machine.model_params,
                // Add any other fields from the schema you want to expose
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

// @route   POST /api/dashboard/machines
// @desc    Add a new machine (without training)
// @access  Private
router.post('/machines', auth, async (req, res) => {
    try {
        const { machineName, machineType, manufacturer } = req.body;
        const user = req.user;

        const newMachine = new Machine({
            ...req.body,
            userId: user._id,
            training_status: 'none'
        });

        await newMachine.save();

        res.status(201).json({
            success: true,
            message: 'Machine added successfully.',
            machine: newMachine
        });

    } catch (error) {
        console.error('Add machine error:', error);
        // Handle validation errors specifically
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
});

// @route   POST /api/dashboard/machine/:machineId/train
// @desc    Train a model for an existing machine
// @access  Private
router.post('/machine/:machineId/train', auth, upload.single('csvFile'), async (req, res) => {
    try {
        const { machineId } = req.params;
        const { sensors, columns } = req.body;
        const user = req.user;

        // Remove the requirement for CSV file since we're using pre-trained parameters
        // if (!req.file) {
        //     return res.status(400).json({ success: false, message: 'Training data file is required.' });
        // }
        
        const machine = await Machine.findOne({ _id: machineId, userId: user._id });
        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found.' });
        }

        // Update machine with new training info
        machine.sensors = JSON.parse(sensors || '[]');
        machine.training_columns = JSON.parse(columns || '[]');
        if (req.file) {
            machine.training_data_path = req.file.path;
        }
        machine.training_status = 'pending'; // Set to pending to kick off polling
        
        await machine.save();

        // Start training process in the background
        trainModel(machine, user);

        res.status(200).json({
            success: true,
            message: 'Training has started successfully.',
            machine: machine
        });

    } catch (error) {
        console.error('Train machine error:', error);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
});

// @route   GET /api/dashboard/machine/:machineId/status
// @desc    Get real-time training status for a machine using Server-Sent Events (SSE)
// @access  Private
router.get('/machine/:machineId/status', auth, async (req, res) => {
    const { machineId } = req.params;

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendStatus = async () => {
        try {
            const machine = await Machine.findById(machineId);
            if (!machine) {
                res.write(`data: ${JSON.stringify({ success: false, message: 'Machine not found.' })}\\n\\n`);
                return;
            }
            const payload = {
                success: true,
                status: machine.training_status,
                progress: machine.training_progress,
                message: machine.training_message
            };
            res.write(`data: ${JSON.stringify(payload)}\\n\\n`);
            
            // If training is done, we can close the connection from the server side.
            if (machine.training_status === 'completed' || machine.training_status === 'failed') {
                res.end();
            }
        } catch (error) {
            console.error(`Error fetching status for machine ${machineId}:`, error);
            res.write(`data: ${JSON.stringify({ success: false, message: 'Error fetching status.' })}\\n\\n`);
        }
    };

    const dataInterval = setInterval(sendStatus, 2000);

    // Send a comment every 15 seconds to keep the connection alive
    const keepAliveInterval = setInterval(() => {
        res.write(':keep-alive\\n\\n');
    }, 15000);

    // Clean up intervals when the client closes the connection
    req.on('close', () => {
        clearInterval(dataInterval);
        clearInterval(keepAliveInterval);
        res.end();
    });
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

// @route   POST /api/dashboard/machine/:id/predict
// @desc    Get a risk score for a single reading
// @access  Private
router.post('/machine/:id/predict', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { sensorData } = req.body;

        const machine = await Machine.findById(id);
        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        if (machine.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }
        if (machine.modelStatus !== 'trained') {
            return res.status(400).json({ success: false, message: 'Model for this machine is not trained yet.' });
        }

        // --- Data Validation and Ordering ---
        // Use pre-trained model files instead of machine-specific files
        const pretrainedConfigPath = path.join(__dirname, '../models/pretrained_config.json');
        if (!fs.existsSync(pretrainedConfigPath)) {
            return res.status(500).json({ success: false, message: 'Pre-trained model configuration not found.' });
        }
        
        const pretrainedConfig = JSON.parse(fs.readFileSync(pretrainedConfigPath, 'utf8'));
        const pretrained = pretrainedConfig.pretrained_model;
        const expectedColumns = pretrained.trained_columns;
        
        // Map sensor data to the expected column names
        // The sensorData keys are the sensorIds from the frontend form
        const mappedSensorData = {};
        for (const sensor of machine.sensors) {
            if (sensorData.hasOwnProperty(sensor.sensorId)) {
                // Use the sensor's sensorId (which is the column name from CSV) as the key
                mappedSensorData[sensor.sensorId] = sensorData[sensor.sensorId];
            }
        }
        
        // Order the data according to the pre-trained model's expected column order
        const orderedSensorData = expectedColumns.map(column => mappedSensorData[column]);

        if (orderedSensorData.some(v => v === undefined)) {
            const missing = expectedColumns.filter(col => !mappedSensorData.hasOwnProperty(col));
            return res.status(400).json({
                success: false,
                message: `Missing required sensor data. Please provide values for: ${missing.join(', ')}`
            });
        }
        // --- End Validation ---

        // Create a temporary file for the prediction sequence
        const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const sequenceFilePath = path.join(tempDir, `predict_sequence_${machine._id}_${Date.now()}.json`);
        // Write the ordered array to the file, not the original object
        fs.writeFileSync(sequenceFilePath, JSON.stringify(orderedSensorData));

        const pythonScriptPath = path.join(__dirname, '..', 'models', 'anomaly.py');
        const pythonProcess = spawn('python3', [
            pythonScriptPath, 
            'predict',
            'test_user', // Use test_user for pre-trained model
            'test_machine', // Use test_machine for pre-trained model
            sequenceFilePath
        ]);

        let rawOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            rawOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Prediction Error for ${machine._id}]: ${data.toString()}`);
        });

        pythonProcess.on('close', async (code) => {
            // Clean up the temporary file
            fs.unlink(sequenceFilePath, (err) => {
                if (err) console.error("Error deleting temp prediction file:", err);
            });

            if (code !== 0) {
                return res.status(500).json({ success: false, message: 'Prediction script failed.' });
            }

            try {
                const result = JSON.parse(rawOutput);
                if (result.success) {
                    // Update the machine's health score based on the risk assessment
                    const riskScore = result.data.reconstruction_error;
                    const isAnomaly = result.data.is_anomaly;
                    
                    // Convert risk score to health score (inverse relationship)
                    // Higher risk = lower health score
                    let healthScore;
                    if (isAnomaly) {
                        // If anomaly detected, health score is between 0-40
                        healthScore = Math.max(0, 40 - (riskScore * 100));
                    } else {
                        // If normal, health score is between 60-100
                        healthScore = Math.min(100, 100 - (riskScore * 50));
                    }
                    
                    // Update machine status based on health score
                    let status = 'healthy';
                    if (healthScore < 30) {
                        status = 'critical';
                    } else if (healthScore < 60) {
                        status = 'warning';
                    }
                    
                    // Update the machine in database
                    await Machine.findByIdAndUpdate(machine._id, {
                        healthScore: Math.round(healthScore),
                        status: status,
                        lastUpdated: new Date()
                    });
                    
                    console.log(`Updated machine ${machine._id}: healthScore=${Math.round(healthScore)}, status=${status}`);
                    
                    res.json({ 
                        success: true, 
                        data: {
                            ...result.data,
                            healthScore: Math.round(healthScore),
                            status: status
                        }
                    });
                } else {
                    res.status(500).json({ success: false, message: result.error || 'Prediction failed.' });
                }
            } catch (e) {
                console.error('Error parsing python output', e);
                res.status(500).json({ success: false, message: 'Failed to parse prediction output.' });
            }
        });

    } catch (error) {
        console.error('Prediction route error:', error);
        res.status(500).json({ success: false, message: 'Server error during prediction' });
    }
});

// @route   DELETE /api/dashboard/machine/:id
// @desc    Remove a machine and its associated model
// @access  Private
router.delete('/machine/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        const machine = await Machine.findById(id);

        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        if (machine.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }

        // Remove the machine document from the database
        await Machine.findByIdAndDelete(id);

        // Clean up associated files (model, scaler, etc.)
        const modelDir = path.join(__dirname, '..', 'models', 'user_models', `user_${req.user._id.toString()}`, `machine_${machine._id.toString()}`);
        if (fs.existsSync(modelDir)) {
            fs.rmSync(modelDir, { recursive: true, force: true });
            console.log(`Cleaned up model directory: ${modelDir}`);
        }
        
        // Clean up training data if it exists
        if (machine.trainingDataPath && fs.existsSync(machine.trainingDataPath)) {
            fs.unlinkSync(machine.trainingDataPath);
            console.log(`Cleaned up training file: ${machine.trainingDataPath}`);
        }

        res.json({ success: true, message: 'Machine and associated model removed successfully.' });

    } catch (error) {
        console.error('Remove machine error:', error);
        res.status(500).json({ success: false, message: 'Server error during machine removal' });
    }
});

// This endpoint receives a CSV, reads the header row, and returns the column names.
router.post('/get-csv-headers', (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const readable = fs.createReadStream(filePath);
    const reader = readline.createInterface({ input: readable });
    let isHandled = false;

    const cleanupAndRespond = (status, json) => {
        if (isHandled) return;
        isHandled = true;

        reader.close();
        readable.destroy();
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        if (!res.headersSent) {
            res.status(status).json(json);
        }
    };

    reader.on('line', (firstLine) => {
        try {
            const commaCount = (firstLine.match(/,/g) || []).length;
            const semicolonCount = (firstLine.match(/;/g) || []).length;
            const delimiter = commaCount > semicolonCount ? ',' : ';';
            
            // Define a list of common non-sensor column name fragments to exclude
            const excludedKeywords = ['id', 'time', 'date', 'asset', 'serial', 'unnamed', 'index'];
            
            let headers = firstLine.split(delimiter)
                .map(h => h.trim().replace(/"/g, '')) // Remove quotes and trim whitespace
                .filter(h => h); // Filter out any empty headers

            // Filter out headers that match the excluded keywords
            const filteredHeaders = headers.filter(header => 
                !excludedKeywords.some(keyword => header.toLowerCase().includes(keyword))
            );

            if (filteredHeaders.length === 0) {
                cleanupAndRespond(400, { success: false, message: 'Could not find any valid sensor columns in the uploaded file.' });
            } else {
                cleanupAndRespond(200, { success: true, headers: filteredHeaders });
            }
        } catch (error) {
            console.error('Error processing header line:', error);
            cleanupAndRespond(500, { success: false, message: 'An internal server error occurred while processing headers.' });
        }
    });

    reader.on('close', () => {
        if (!isHandled) {
            cleanupAndRespond(400, { success: false, message: 'Uploaded file is empty or invalid.' });
        }
    });

    reader.on('error', (err) => {
        console.error('Error reading file stream:', err);
        cleanupAndRespond(500, { success: false, message: 'Failed to read the uploaded file.' });
    });
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

function getModelPaths(userId, machineId) {
    const machineDir = path.join(__dirname, '../models/user_models', `user_${userId}`, `machine_${machineId}`);
    return {
        model_file: path.join(machineDir, 'model.h5'),
        scaler_file: path.join(machineDir, 'scaler.pkl'),
        columns_file: path.join(machineDir, 'columns.json'),
        threshold_file: path.join(machineDir, 'threshold.json'),
    };
}

async function trainModel(machine, user) {
    const machineId = machine._id.toString();
    const userId = user._id.toString();
    
    try {
        // Check if pre-trained configuration exists
        const pretrainedConfigPath = path.join(__dirname, '../models/pretrained_config.json');
        if (!fs.existsSync(pretrainedConfigPath)) {
            throw new Error('Pre-trained model configuration not found');
        }
        
        const pretrainedConfig = JSON.parse(fs.readFileSync(pretrainedConfigPath, 'utf8'));
        const pretrained = pretrainedConfig.pretrained_model;
        
        // Update machine with success status and pre-trained model parameters immediately
        const modelParams = {
            threshold: pretrained.threshold,
            mae_threshold: pretrained.mae_threshold,
            mean_loss: pretrained.mean_loss,
            max_loss: pretrained.max_loss,
            min_loss: pretrained.min_loss,
            std_loss: pretrained.std_loss,
            percentile_90: pretrained.percentile_90,
            percentile_95: pretrained.percentile_95,
            percentile_99: pretrained.percentile_99,
            mae_stats: pretrained.mae_stats,
            model_info: pretrained.model_info,
            source: 'pre_trained_model',
            trained_columns: pretrained.trained_columns
        };
        
        await Machine.findByIdAndUpdate(machineId, {
            training_status: 'completed',
            training_progress: 100,
            model_params: modelParams,
            modelStatus: 'trained',
            training_message: 'Pre-trained model applied instantly!',
            lastTrained: new Date()
        });
        
        console.log(`✅ Pre-trained model applied instantly for machine ${machineId}`);
        console.log(`📊 Using pre-trained parameters: threshold=${pretrained.threshold}`);
        console.log(`🎯 Model source: ${pretrained.source_data} (${pretrained.trained_columns.length} sensors)`);
        
    } catch (error) {
        console.error(`❌ Error applying pre-trained model for machine ${machineId}:`, error);
        
        await Machine.findByIdAndUpdate(machineId, {
            training_status: 'failed',
            training_progress: 0,
            training_message: `Error: ${error.message}`,
            lastTrained: new Date()
        });
    }
}

module.exports = router; 
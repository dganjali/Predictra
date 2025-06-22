const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Machine = require('../models/Machine');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process');
const readline = require('readline');

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
                modelStatus: machine.modelStatus,
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

        // Set up default sensors that match the pre-trained model
        const pretrainedConfigPath = path.join(__dirname, '../models/pretrained_config.json');
        let defaultSensors = [];
        let modelParams = null;
        let trainingStatus = 'none';
        let modelStatus = 'untrained';

        if (fs.existsSync(pretrainedConfigPath)) {
            try {
                const pretrainedConfig = JSON.parse(fs.readFileSync(pretrainedConfigPath, 'utf8'));
                const pretrained = pretrainedConfig.pretrained_model;
                
                // Create sensors that match the expected columns
                defaultSensors = pretrained.trained_columns.map((columnName, index) => ({
                    sensorId: columnName,
                    name: columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    type: 'numeric',
                    unit: index % 4 === 0 ? '°C' : index % 4 === 1 ? 'Hz' : index % 4 === 2 ? 'A' : 'bar',
                    minValue: 0,
                    maxValue: 100
                }));

                // Set up model parameters for instant use
                modelParams = {
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
                
                trainingStatus = 'completed';
                modelStatus = 'trained';
                
                console.log(`✅ Auto-configured machine with ${defaultSensors.length} sensors from pre-trained model`);
            } catch (error) {
                console.error('Error loading pre-trained config:', error);
            }
        }

        const newMachine = new Machine({
            ...req.body,
            userId: user._id,
            training_status: trainingStatus,
            modelStatus: modelStatus,
            sensors: defaultSensors,
            model_params: modelParams,
            lastTrained: modelParams ? new Date() : undefined
        });

        await newMachine.save();

        res.status(201).json({
            success: true,
            message: 'Machine added successfully with pre-configured sensors.',
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

        console.log('🚀 Training request received for machine:', machineId);
        console.log('📁 File uploaded:', req.file ? req.file.filename : 'No file');
        console.log('⚙️ Sensors:', sensors);
        console.log('📊 Columns:', columns);

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Training data file is required.' });
        }
        
        const machine = await Machine.findOne({ _id: machineId, userId: user._id });
        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found.' });
        }

        // Parse the sensor configuration
        const parsedSensors = JSON.parse(sensors || '[]');
        const parsedColumns = JSON.parse(columns || '[]');

        console.log('✅ Parsed sensors:', parsedSensors);
        console.log('✅ Parsed columns:', parsedColumns);

        // Update machine with new training info
        machine.sensors = parsedSensors;
        machine.training_columns = parsedColumns;
        machine.training_data_path = req.file.path;
        machine.training_status = 'pending';
        machine.training_progress = 0;
        machine.training_message = 'Preparing to start training...';
        
        await machine.save();

        // Start training process in the background
        trainModelWithCSV(machine, user, req.file.path);

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

        console.log(`🔍 Prediction request for machine ${id}`);
        console.log(`📊 Sensor data received:`, sensorData);

        const machine = await Machine.findById(id);
        if (!machine) {
            console.log(`❌ Machine ${id} not found`);
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        
        console.log(`✅ Machine found: ${machine.machineName}`);
        console.log(`👤 Machine userId: ${machine.userId}, Request userId: ${req.user._id}`);
        console.log(`🎯 Machine modelStatus: ${machine.modelStatus}`);
        console.log(`🧠 Machine training_status: ${machine.training_status}`);
        console.log(`⚙️  Machine sensors:`, machine.sensors);
        console.log(`📋 Machine model_params:`, machine.model_params);
        
        if (machine.userId.toString() !== req.user._id.toString()) {
            console.log(`❌ User not authorized for machine ${id}`);
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }
        
        // Check multiple training status indicators
        const isTrained = machine.modelStatus === 'trained' || 
                         machine.training_status === 'completed' ||
                         (machine.model_params && machine.model_params.source === 'pre_trained_model');
        
        console.log(`🔄 Is machine trained? ${isTrained}`);
        
        if (!isTrained) {
            console.log(`❌ Model for machine ${id} is not trained yet`);
            return res.status(400).json({ success: false, message: 'Model for this machine is not trained yet.' });
        }

        // --- Data Validation and Ordering ---
        // Use pre-trained model files instead of machine-specific files
        const pretrainedConfigPath = path.join(__dirname, '../models/pretrained_config.json');
        if (!fs.existsSync(pretrainedConfigPath)) {
            console.log(`❌ Pre-trained config not found at: ${pretrainedConfigPath}`);
            return res.status(500).json({ success: false, message: 'Pre-trained model configuration not found.' });
        }
        
        const pretrainedConfig = JSON.parse(fs.readFileSync(pretrainedConfigPath, 'utf8'));
        const pretrained = pretrainedConfig.pretrained_model;
        const expectedColumns = pretrained.trained_columns;
        
        console.log(`📂 Expected columns from pre-trained model:`, expectedColumns);
        
        // Map sensor data to the expected column names
        // The sensorData keys are the sensorIds from the frontend form
        const mappedSensorData = {};
        for (const sensor of machine.sensors) {
            console.log(`🔍 Checking sensor: ${sensor.sensorId} (${sensor.name})`);
            if (sensorData.hasOwnProperty(sensor.sensorId)) {
                // Use the sensor's sensorId (which is the column name from CSV) as the key
                mappedSensorData[sensor.sensorId] = sensorData[sensor.sensorId];
                console.log(`✅ Mapped ${sensor.sensorId} = ${sensorData[sensor.sensorId]}`);
            } else {
                console.log(`❌ Missing sensor data for: ${sensor.sensorId}`);
            }
        }
        
        console.log(`🗺️  Mapped sensor data:`, mappedSensorData);
        
        // Order the data according to the pre-trained model's expected column order
        const orderedSensorData = expectedColumns.map(column => {
            const value = mappedSensorData[column];
            console.log(`📊 Column ${column}: ${value}`);
            return value;
        });

        console.log(`📋 Ordered sensor data:`, orderedSensorData);

        if (orderedSensorData.some(v => v === undefined)) {
            const missing = expectedColumns.filter(col => !mappedSensorData.hasOwnProperty(col));
            console.log(`❌ Missing required sensor data:`, missing);
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
                    
                    // Calculate RUL and health score using the new helper functions
                    const { rulEstimate, riskPercentage } = calculateRUL(riskScore, isAnomaly);
                    const healthScore = calculateHealthScore(riskScore, isAnomaly);
                    
                    // Determine machine status
                    const status = determineMachineStatus(healthScore);
                    
                    // Update the machine in database
                    await Machine.findByIdAndUpdate(machine._id, {
                        healthScore: healthScore,
                        rulEstimate: rulEstimate,
                        status: status,
                        lastUpdated: new Date()
                    });
                    
                    console.log(`Updated machine ${machine._id}: healthScore=${healthScore}, rulEstimate=${rulEstimate}, status=${status}`);
                    
                    res.json({ 
                        success: true, 
                        data: {
                            ...result.data,
                            healthScore: healthScore,
                            rulEstimate: rulEstimate,
                            status: status,
                            riskPercentage: riskPercentage
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
router.post('/get-csv-headers', upload.single('csvFile'), (req, res) => {
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

async function trainModelWithCSV(machine, user, csvFilePath) {
    const machineId = machine._id.toString();
    const userId = user._id.toString();
    
    try {
        console.log(`🏋️ Starting fast training for machine ${machineId} using CSV: ${csvFilePath}`);
        
        // Update progress: Starting
        await Machine.findByIdAndUpdate(machineId, {
            training_status: 'in_progress',
            training_progress: 5,
            training_message: 'Initializing training environment...'
        });
        
        // Validate CSV file exists
        if (!fs.existsSync(csvFilePath)) {
            throw new Error('Training CSV file not found');
        }
        
        // Update progress: Reading data
        await Machine.findByIdAndUpdate(machineId, {
            training_progress: 15,
            training_message: 'Reading and preprocessing training data...'
        });
        
        // Use streaming to read only the first 1MB of CSV data for faster training
        const Papa = require('papaparse');
        
        // Get file size
        const stats = fs.statSync(csvFilePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        console.log(`📊 CSV file size: ${fileSizeInMB.toFixed(2)} MB`);
        
        // Read only first 1MB of data for faster training
        const maxBytesToRead = 1 * 1024 * 1024; // 1MB
        const readStream = fs.createReadStream(csvFilePath, { 
            encoding: 'utf8',
            highWaterMark: 64 * 1024 // 64KB chunks
        });
        
        let bytesRead = 0;
        let csvContent = '';
        let headers = null;
        let dataRows = [];
        
        // Read file in chunks until we reach 1MB or end of file
        for await (const chunk of readStream) {
            bytesRead += chunk.length;
            csvContent += chunk;
            
            // Stop reading if we've reached 1MB
            if (bytesRead >= maxBytesToRead) {
                console.log(`📊 Read ${(bytesRead / (1024 * 1024)).toFixed(2)} MB of data (limited to first 1MB for fast training)`);
                break;
            }
        }
        
        readStream.destroy();
        
        // Parse the CSV content
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true
        });
        
        if (parseResult.errors.length > 0) {
            console.warn('CSV parsing warnings:', parseResult.errors);
        }
        
        headers = parseResult.meta.fields;
        dataRows = parseResult.data;
        
        console.log(`📋 CSV headers: ${headers.length} columns`);
        console.log(`📊 Processed ${dataRows.length} rows from first 1MB of data`);
        
        // Force garbage collection after processing
        forceGarbageCollection();
        
        // Create sampled CSV file with the processed data
        const sampleCsvPath = csvFilePath.replace('.csv', '_sample.csv');
        const sampleCsvContent = Papa.unparse({
            fields: headers,
            data: dataRows
        });
        
        // Write sample CSV
        fs.writeFileSync(sampleCsvPath, sampleCsvContent);
        
        // Clear large variables from memory
        csvContent = null;
        dataRows = null;
        headers = null;
        forceGarbageCollection();
        
        // Update progress: Starting Python training
        await Machine.findByIdAndUpdate(machineId, {
            training_progress: 25,
            training_message: 'Starting fast ML model training...'
        });
        
        // Prepare training parameters
        const pythonScriptPath = path.join(__dirname, '..', 'models', 'anomaly.py');
        const selectedColumns = machine.training_columns || [];
        
        console.log(`🎯 Training with columns:`, selectedColumns);
        
        // Create temporary columns file
        const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const columnsFilePath = path.join(tempDir, `columns_${machineId}_${Date.now()}.json`);
        fs.writeFileSync(columnsFilePath, JSON.stringify(selectedColumns));
        
        // Start Python training process with fast training mode
        console.log(`🚀 Starting Python process: python3 ${pythonScriptPath} train_fast ${userId} ${machineId} ${sampleCsvPath} ${columnsFilePath}`);
        
        const pythonProcess = spawn('python3', [
            pythonScriptPath,
            'train_fast',  // New fast training mode
            userId,
            machineId,
            sampleCsvPath,
            columnsFilePath
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });
        
        let rawOutput = '';
        let lastProgress = 25;
        let processStartTime = Date.now();
        
        // Monitor Python process output for progress updates
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            rawOutput += output;
            console.log(`[Python stdout for ${machineId}]: ${output.trim()}`);
            
            // Parse progress from Python output
            if (output.includes('Starting fast training')) {
                lastProgress = 40;
                updateProgress(machineId, lastProgress, 'Fast training neural network...');
            } else if (output.includes('Epoch')) {
                lastProgress = Math.min(80, lastProgress + 10); // Faster progress updates
                const epochMatch = output.match(/Epoch (\d+)/);
                const epoch = epochMatch ? epochMatch[1] : '?';
                updateProgress(machineId, lastProgress, `Fast training epoch ${epoch}...`);
            } else if (output.includes('Saving model')) {
                lastProgress = 90;
                updateProgress(machineId, lastProgress, 'Saving trained model...');
            } else if (output.includes('Training completed')) {
                lastProgress = 95;
                updateProgress(machineId, lastProgress, 'Finalizing training...');
            }
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            console.error(`[Training Error for ${machineId}]: ${errorOutput}`);
        });
        
        // Add timeout to prevent hanging
        const trainingTimeout = setTimeout(() => {
            console.error(`⏰ Training timeout for machine ${machineId} after 60 seconds`);
            pythonProcess.kill('SIGTERM');
            Machine.findByIdAndUpdate(machineId, {
                training_status: 'failed',
                training_progress: 0,
                training_message: 'Training timed out. Please try again with a smaller file.'
            });
        }, 60000); // 60 second timeout
        
        pythonProcess.on('close', async (code) => {
            clearTimeout(trainingTimeout);
            const trainingDuration = Date.now() - processStartTime;
            console.log(`⏱️ Training process for machine ${machineId} completed in ${trainingDuration}ms with exit code ${code}`);
            
            // Clean up temporary files
            [sampleCsvPath, columnsFilePath].forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error(`Error deleting temp file ${filePath}:`, err);
                    });
                }
            });
            
            if (code !== 0) {
                console.error(`❌ Training failed for machine ${machineId} with exit code ${code}`);
                await Machine.findByIdAndUpdate(machineId, {
                    training_status: 'failed',
                    training_progress: 0,
                    training_message: 'Training failed. Please check your data and try again.'
                });
                return;
            }
            
            try {
                // Parse training results
                let trainingResult = null;
                try {
                    const lines = rawOutput.split('\n');
                    const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('success'));
                    if (jsonLine) {
                        trainingResult = JSON.parse(jsonLine.trim());
                    }
                } catch (parseError) {
                    console.error('Error parsing training output:', parseError);
                }
                
                if (trainingResult && trainingResult.success) {
                    // Training successful - update machine with results
                    const modelParams = {
                        threshold: trainingResult.threshold,
                        mae_threshold: trainingResult.mae_threshold || trainingResult.threshold,
                        mean_loss: trainingResult.mean_loss,
                        max_loss: trainingResult.max_loss,
                        min_loss: trainingResult.min_loss,
                        std_loss: trainingResult.std_loss,
                        percentile_90: trainingResult.percentile_90,
                        percentile_95: trainingResult.percentile_95,
                        percentile_99: trainingResult.percentile_99,
                        source: 'custom_trained_model',
                        trained_columns: selectedColumns,
                        training_samples: dataRows.length,
                        total_file_lines: dataRows.length,
                        training_date: new Date().toISOString()
                    };
                    
                    await Machine.findByIdAndUpdate(machineId, {
                        training_status: 'completed',
                        training_progress: 100,
                        model_params: modelParams,
                        modelStatus: 'trained',
                        training_message: `Training completed successfully! Used ${dataRows.length} samples from ${dataRows.length} total lines.`,
                        lastTrained: new Date()
                    });
                    
                    console.log(`✅ Training completed successfully for machine ${machineId}`);
                    console.log(`📊 Model threshold: ${trainingResult.threshold}`);
                    console.log(`🎯 Training samples: ${dataRows.length} from ${dataRows.length} total lines`);
                } else {
                    throw new Error('Training completed but no valid results returned');
                }
                
            } catch (error) {
                console.error(`❌ Error processing training results for machine ${machineId}:`, error);
                await Machine.findByIdAndUpdate(machineId, {
                    training_status: 'failed',
                    training_progress: 0,
                    training_message: `Training failed: ${error.message}`
                });
            }
        });
        
    } catch (error) {
        console.error(`❌ Error starting training for machine ${machineId}:`, error);
        await Machine.findByIdAndUpdate(machineId, {
            training_status: 'failed',
            training_progress: 0,
            training_message: `Training setup failed: ${error.message}`
        });
    }
}

// Helper function to update training progress
async function updateProgress(machineId, progress, message) {
    try {
        await Machine.findByIdAndUpdate(machineId, {
            training_progress: progress,
            training_message: message
        });
        console.log(`📈 Progress ${progress}%: ${message}`);
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

// Helper function to force garbage collection if available
function forceGarbageCollection() {
    if (global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection');
    }
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

// @route   POST /api/dashboard/machine/:id/setup-pretrained
// @desc    Setup a machine to use the pre-trained model
// @access  Private
router.post('/machine/:id/setup-pretrained', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const machine = await Machine.findOne({ _id: id, userId: req.user._id });
        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }

        // Set up with pre-trained model
        const pretrainedConfigPath = path.join(__dirname, '../models/pretrained_config.json');
        if (!fs.existsSync(pretrainedConfigPath)) {
            return res.status(500).json({ success: false, message: 'Pre-trained model configuration not found.' });
        }
        
        const pretrainedConfig = JSON.parse(fs.readFileSync(pretrainedConfigPath, 'utf8'));
        const pretrained = pretrainedConfig.pretrained_model;
        
        // Create sensors that match the expected columns
        const defaultSensors = pretrained.trained_columns.map((columnName, index) => ({
            sensorId: columnName,
            name: columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: 'numeric',
            unit: index % 4 === 0 ? '°C' : index % 4 === 1 ? 'Hz' : index % 4 === 2 ? 'A' : 'bar',
            minValue: 0,
            maxValue: 100
        }));

        // Set up model parameters
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

        // Update the machine
        await Machine.findByIdAndUpdate(id, {
            training_status: 'completed',
            modelStatus: 'trained',
            sensors: defaultSensors,
            model_params: modelParams,
            lastTrained: new Date(),
            training_progress: 100,
            training_message: 'Pre-trained model configured successfully!'
        });

        res.json({ 
            success: true, 
            message: 'Machine configured with pre-trained model successfully!',
            sensorsConfigured: defaultSensors.length
        });

    } catch (error) {
        console.error('Setup pre-trained model error:', error);
        res.status(500).json({ success: false, message: 'Server error during setup' });
    }
});

// @route   POST /api/dashboard/machine/:id/predict-csv
// @desc    Get risk analysis for a CSV file containing sensor data window
// @access  Private
router.post('/machine/:id/predict-csv', auth, upload.single('csvFile'), async (req, res) => {
    try {
        const { id } = req.params;
        const csvFile = req.file;

        console.log(`🔍 CSV Prediction request for machine ${id}`);
        console.log(`📊 CSV file received:`, csvFile?.originalname);

        const machine = await Machine.findById(id);
        if (!machine) {
            console.log(`❌ Machine ${id} not found`);
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        
        if (machine.userId.toString() !== req.user._id.toString()) {
            console.log(`❌ User not authorized for machine ${id}`);
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }
        
        // Check if model is trained
        const isTrained = machine.modelStatus === 'trained' || 
                         machine.training_status === 'completed' ||
                         (machine.model_params && machine.model_params.source === 'pre_trained_model');
        
        if (!isTrained) {
            console.log(`❌ Model for machine ${id} is not trained yet`);
            return res.status(400).json({ success: false, message: 'Model for this machine is not trained yet.' });
        }

        if (!csvFile) {
            return res.status(400).json({ success: false, message: 'No CSV file provided.' });
        }

        // Process the CSV file for prediction
        const csvFilePath = csvFile.path;
        console.log(`📂 Processing CSV file: ${csvFilePath}`);

        // Use pre-trained model configuration
        const pretrainedConfigPath = path.join(__dirname, '../models/pretrained_config.json');
        if (!fs.existsSync(pretrainedConfigPath)) {
            return res.status(500).json({ success: false, message: 'Pre-trained model configuration not found.' });
        }
        
        const pretrainedConfig = JSON.parse(fs.readFileSync(pretrainedConfigPath, 'utf8'));
        const pretrained = pretrainedConfig.pretrained_model;
        const expectedColumns = pretrained.trained_columns;

        // Create a temporary columns file for the prediction
        const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const columnsFilePath = path.join(tempDir, `predict_columns_${machine._id}_${Date.now()}.json`);
        fs.writeFileSync(columnsFilePath, JSON.stringify(expectedColumns));

        // Start Python prediction process for CSV
        const pythonScriptPath = path.join(__dirname, '..', 'models', 'anomaly.py');
        console.log(`🚀 Starting CSV prediction: python3 ${pythonScriptPath} predict_csv test_user test_machine ${csvFilePath} ${columnsFilePath}`);
        
        const pythonProcess = spawn('python3', [
            pythonScriptPath, 
            'predict_csv',
            'test_user', // Use test_user for pre-trained model
            'test_machine', // Use test_machine for pre-trained model
            csvFilePath,
            columnsFilePath
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        let rawOutput = '';
        let processStartTime = Date.now();
        
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            rawOutput += output;
            console.log(`[Python stdout for CSV prediction]: ${output.trim()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[CSV Prediction Error]: ${data.toString()}`);
        });

        // Add timeout for CSV prediction
        const predictionTimeout = setTimeout(() => {
            console.error(`⏰ CSV prediction timeout for machine ${id} after 120 seconds`);
            pythonProcess.kill('SIGTERM');
            res.status(500).json({ success: false, message: 'CSV prediction timed out. Please try with a smaller file.' });
        }, 120000); // 2 minute timeout

        pythonProcess.on('close', async (code) => {
            clearTimeout(predictionTimeout);
            const predictionDuration = Date.now() - processStartTime;
            console.log(`⏱️ CSV prediction process completed in ${predictionDuration}ms with exit code ${code}`);

            // Clean up temporary files
            [csvFilePath, columnsFilePath].forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error(`Error deleting temp file ${filePath}:`, err);
                    });
                }
            });

            if (code !== 0) {
                return res.status(500).json({ success: false, message: 'CSV prediction script failed.' });
            }

            try {
                const result = JSON.parse(rawOutput);
                if (result.success) {
                    // Process the CSV prediction results
                    const analysisResults = result.data;
                    
                    // Calculate overall risk metrics
                    const totalReadings = analysisResults.length;
                    const anomalyCount = analysisResults.filter(r => r.is_anomaly).length;
                    const anomalyPercentage = (anomalyCount / totalReadings) * 100;
                    
                    // Calculate average risk score
                    const avgRiskScore = analysisResults.reduce((sum, r) => sum + r.reconstruction_error, 0) / totalReadings;
                    
                    // Calculate RUL and health score using the new helper functions
                    const { rulEstimate, riskPercentage } = calculateRUL(avgRiskScore, anomalyPercentage > 5);
                    const healthScore = calculateHealthScore(avgRiskScore, anomalyPercentage > 5);
                    const overallStatus = determineMachineStatus(healthScore);
                    
                    // Update the machine in database
                    await Machine.findByIdAndUpdate(machine._id, {
                        healthScore: healthScore,
                        rulEstimate: rulEstimate,
                        status: overallStatus,
                        lastUpdated: new Date()
                    });
                    
                    console.log(`Updated machine ${machine._id}: healthScore=${healthScore}, rulEstimate=${rulEstimate}, status=${overallStatus}`);
                    
                    res.json({ 
                        success: true, 
                        data: {
                            analysisResults: analysisResults,
                            summary: {
                                totalReadings: totalReadings,
                                anomalyCount: anomalyCount,
                                anomalyPercentage: Math.round(anomalyPercentage * 100) / 100,
                                avgRiskScore: Math.round(avgRiskScore * 10000) / 10000,
                                healthScore: healthScore,
                                rulEstimate: rulEstimate,
                                status: overallStatus,
                                riskPercentage: riskPercentage
                            }
                        }
                    });
                } else {
                    res.status(500).json({ success: false, message: result.error || 'CSV prediction failed.' });
                }
            } catch (parseError) {
                console.error('Error parsing CSV prediction output:', parseError);
                res.status(500).json({ success: false, message: 'Error processing prediction results.' });
            }
        });

    } catch (error) {
        console.error(`❌ Error in CSV prediction for machine ${id}:`, error);
        res.status(500).json({ success: false, message: `CSV prediction error: ${error.message}` });
    }
});

// Helper function to calculate RUL using specific model parameters
function calculateRUL(riskScore, isAnomaly = false) {
    // Model parameters from the provided configuration
    const WINDOW_SIZE = 100;
    const DROPOUT_RATE = 0.2;
    const BATCH_SIZE = 32;
    const EPOCHS = 10;
    const PATIENCE = 5;
    const CLASSIFIER_THRESHOLD = 90;
    const RUL_THRESHOLD = 90;
    
    // Convert risk score to a percentage (0-100)
    const riskPercentage = Math.min(100, Math.max(0, riskScore * 100));
    
    // Calculate RUL based on risk percentage and thresholds
    let rulEstimate;
    if (riskPercentage >= RUL_THRESHOLD) {
        // High risk - low RUL (0-30 days)
        rulEstimate = Math.max(0, 30 - (riskPercentage - RUL_THRESHOLD) * 0.5);
    } else if (riskPercentage >= CLASSIFIER_THRESHOLD) {
        // Medium risk - moderate RUL (30-90 days)
        rulEstimate = 30 + (RUL_THRESHOLD - riskPercentage) * 2;
    } else {
        // Low risk - high RUL (90-365 days)
        rulEstimate = 90 + (CLASSIFIER_THRESHOLD - riskPercentage) * 3;
    }
    
    // Ensure RUL is within reasonable bounds (0-365 days)
    rulEstimate = Math.max(0, Math.min(365, rulEstimate));
    
    return {
        rulEstimate: Math.round(rulEstimate),
        riskPercentage: Math.round(riskPercentage),
        modelParams: {
            WINDOW_SIZE,
            DROPOUT_RATE,
            BATCH_SIZE,
            EPOCHS,
            PATIENCE,
            CLASSIFIER_THRESHOLD,
            RUL_THRESHOLD
        }
    };
}

// Helper function to calculate health score
function calculateHealthScore(riskScore, isAnomaly = false) {
    let healthScore;
    if (isAnomaly) {
        // If anomaly detected, health score is between 0-40
        healthScore = Math.max(0, 40 - (riskScore * 100));
    } else {
        // If normal, health score is between 60-100
        healthScore = Math.min(100, 100 - (riskScore * 50));
    }
    
    return Math.round(healthScore);
}

// Helper function to determine machine status
function determineMachineStatus(healthScore) {
    if (healthScore < 30) {
        return 'critical';
    } else if (healthScore < 60) {
        return 'warning';
    } else {
        return 'healthy';
    }
}

module.exports = router;
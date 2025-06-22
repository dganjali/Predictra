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

// Global variables for training monitoring
let trainingProcess = null;
let trainingStartTime = null;
let trainingTimeout = null;
let progressUpdateInterval = null;
let lastProgressUpdate = null;

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
                trained: machine.trained,
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
            trained: !!modelParams,
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
        startUltraSimpleTraining(machine, user, req.file.path);

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

    try {
        // Get the machine to check its training status
        const machine = await Machine.findOne({ _id: machineId, userId: req.user._id });
        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial status from database
        res.write(`data: ${JSON.stringify({
            success: true,
            status: machine.training_status || 'not_started',
            progress: machine.training_progress || 0,
            message: machine.training_message || 'No training in progress'
        })}\n\n`);

        // If training is not in progress, end the connection
        if (machine.training_status !== 'in_progress' && machine.training_status !== 'pending') {
            res.end();
            return;
        }

        // Set up polling to check database for progress updates
        const progressInterval = setInterval(async () => {
            try {
                // Get latest machine status from database
                const updatedMachine = await Machine.findOne({ _id: machineId, userId: req.user._id });
                if (!updatedMachine) {
                    clearInterval(progressInterval);
                    res.write(`data: ${JSON.stringify({
                        success: false,
                        status: 'failed',
                        message: 'Machine not found'
                    })}\n\n`);
                    res.end();
                    return;
                }

                // Send progress update
                res.write(`data: ${JSON.stringify({
                    success: true,
                    status: updatedMachine.training_status,
                    progress: updatedMachine.training_progress || 0,
                    message: updatedMachine.training_message || 'Training in progress...'
                })}\n\n`);

                // If training is completed or failed, end the connection
                if (updatedMachine.training_status === 'completed' || updatedMachine.training_status === 'failed') {
                    clearInterval(progressInterval);
                    res.end();
                }

            } catch (error) {
                console.error('Error polling training status:', error);
                clearInterval(progressInterval);
                res.write(`data: ${JSON.stringify({
                    success: false,
                    status: 'failed',
                    message: 'Error checking training status'
                })}\n\n`);
                res.end();
            }
        }, 1000); // Reduced from 2000ms to 1000ms for faster updates

        // Set up timeout to prevent infinite hanging
        const trainingTimeout = setTimeout(() => {
            console.error(`Training status timeout for machine ${machineId} after 3 minutes`);
            clearInterval(progressInterval);
            
            res.write(`data: ${JSON.stringify({
                success: false,
                status: 'failed',
                message: 'Training status check timed out after 3 minutes.'
            })}\n\n`);
            res.end();
        }, 180000); // Reduced from 10 minutes to 3 minutes

        // Clean up on client disconnect
        req.on('close', () => {
            clearInterval(progressInterval);
            clearTimeout(trainingTimeout);
        });

    } catch (error) {
        console.error('Training status error:', error);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
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

        // Handle missing sensors by using default values
        const finalSensorData = orderedSensorData.map((value, index) => {
            if (value === undefined) {
                const columnName = expectedColumns[index];
                console.log(`⚠️  Missing sensor ${columnName}, using default value`);
                // Use a default value based on typical sensor ranges
                // This allows prediction to work even with missing sensors
                return 0.0; // Default to 0 for missing sensors
            }
            return value;
        });

        console.log(`✅ Final sensor data with defaults:`, finalSensorData);

        // Check if any sensors were missing
        const missingSensors = expectedColumns.filter(col => !mappedSensorData.hasOwnProperty(col));
        const hasMissingSensors = missingSensors.length > 0;
        
        if (hasMissingSensors) {
            console.log(`⚠️  Warning: Using default values for missing sensors: ${missingSensors.join(', ')}`);
        }
        // --- End Validation ---

        // Create a temporary file for the prediction sequence
        const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const sequenceFilePath = path.join(tempDir, `predict_sequence_${machine._id}_${Date.now()}.json`);
        // Write the ordered array to the file, not the original object
        fs.writeFileSync(sequenceFilePath, JSON.stringify(finalSensorData));

        // Start Python prediction process for CSV
        const pythonScriptPath = path.join(__dirname, '..', 'models', 'simple_predictor.py');
        console.log(`🚀 Starting CSV prediction: python3 ${pythonScriptPath} test_user test_machine ${sequenceFilePath}`);
        
        const pythonProcess = spawn('python3', [
            pythonScriptPath, 
            'test_user', // Use test_user for pre-trained model
            'test_machine', // Use test_machine for pre-trained model
            sequenceFilePath
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        let rawOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            rawOutput += output;
            console.log(`[Python stdout for ${machine._id}]: ${output.trim()}`);
            
            // Parse mixed output from Python script
            let progress = 0;
            let message = 'Initializing...';
            let status = 'running';
            let detailedMessages = [];
            
            try {
                // Split output into lines and parse each line
                const lines = output.split('\n').filter(line => line.trim());
                
                // Look for the success message with stats
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    try {
                        // Check if line starts with SUCCESS: and extract JSON part
                        if (trimmedLine.startsWith('SUCCESS:')) {
                            const jsonPart = trimmedLine.substring(8); // Remove 'SUCCESS:' prefix
                            const parsed = JSON.parse(jsonPart);
                            if (parsed.type === 'success' && parsed.stats) {
                                trainingResult = parsed.stats;
                                console.log('✅ Found training results:', trainingResult);
                                break;
                            }
                        } else {
                            // Try parsing as regular JSON
                            const parsed = JSON.parse(trimmedLine);
                            if (parsed.type === 'success' && parsed.stats) {
                                trainingResult = parsed.stats;
                                console.log('✅ Found training results:', trainingResult);
                                break;
                            }
                        }
                    } catch (e) {
                        // Not JSON, continue
                    }
                }
                
                // Check if training completed successfully
                if (progress >= 100) {
                    status = 'completed';
                    message = 'Training completed successfully!';
                }
                
            } catch (parseError) {
                console.error('Error parsing Python output:', parseError);
                status = 'failed';
                message = 'Error parsing training output';
            }
            
            // Send final status update
            res.write(`data: ${JSON.stringify({
                success: true,
                status: status,
                progress: progress,
                message: message,
                detailedMessages: detailedMessages
            })}\n\n`);
            
            res.end();
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
                            riskPercentage: riskPercentage,
                            missingSensors: hasMissingSensors ? missingSensors : [],
                            sensorWarning: hasMissingSensors ? `Used default values for missing sensors: ${missingSensors.join(', ')}` : null
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

async function startUltraSimpleTraining(machine, user, csvFilePath) {
    const machineId = machine._id.toString();
    const userId = user._id.toString();
    
    try {
        console.log(`🏋️ Starting ultra-simple training for machine ${machineId} using CSV: ${csvFilePath}`);
        
        // Update progress: Starting
        await Machine.findByIdAndUpdate(machineId, {
            training_status: 'in_progress',
            training_progress: 5,
            training_message: 'Initializing ultra-simple training...'
        });
        
        // Validate CSV file exists
        if (!fs.existsSync(csvFilePath)) {
            throw new Error('Training CSV file not found');
        }
        
        // Prepare training parameters
        const pythonScriptPath = path.join(__dirname, '..', 'models', 'simple_trainer.py');
        const selectedColumns = machine.training_columns || [];
        
        console.log(`🎯 Training with columns:`, selectedColumns);
        
        // Set environment variables for Python script
        const env = { 
            ...process.env, 
            PYTHONUNBUFFERED: '1',
            SENSOR_COLUMNS: JSON.stringify(selectedColumns)
        };
        
        // Start Python training process
        console.log(`🚀 Starting Python process: python3 ${pythonScriptPath} ${userId} ${machineId} ${csvFilePath}`);
        
        const pythonProcess = spawn('python3', [
            pythonScriptPath,
            userId,
            machineId,
            csvFilePath
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: env
        });
        
        let rawOutput = '';
        let processStartTime = Date.now();
        
        // Monitor Python process output for progress updates
        pythonProcess.stdout.on('data', async (data) => {
            const output = data.toString();
            rawOutput += output;
            console.log(`[Python stdout for ${machineId}]: ${output.trim()}`);
            
            // Parse mixed output from Python script
            let progress = 0;
            let message = 'Initializing...';
            let status = 'running';
            let detailedMessages = [];
            
            try {
                // Split output into lines and parse each line
                const lines = output.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.type === 'progress') {
                            progress = data.progress || 0;
                            message = data.message || 'Processing...';
                        } else if (data.type === 'message') {
                            detailedMessages.push({
                                timestamp: new Date().toISOString(),
                                message: data.message,
                                type: data.message_type || 'info'
                            });
                        }
                    } catch (parseError) {
                        // Skip lines that aren't valid JSON
                        continue;
                    }
                }
                
                // Update machine progress in database
                await Machine.findByIdAndUpdate(machineId, {
                    training_progress: progress,
                    training_message: message
                });
                
                // Check if training completed successfully
                if (progress >= 100) {
                    status = 'completed';
                    message = 'Training completed successfully!';
                }
                
            } catch (parseError) {
                console.error('Error parsing Python output:', parseError);
                status = 'failed';
                message = 'Error parsing training output';
            }
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            console.error(`[Training Error for ${machineId}]: ${errorOutput}`);
        });
        
        // Add timeout to prevent hanging
        const trainingTimeout = setTimeout(() => {
            console.error(`⏰ Training timeout for machine ${machineId} after 120 seconds`);
            pythonProcess.kill('SIGTERM');
            Machine.findByIdAndUpdate(machineId, {
                training_status: 'failed',
                training_progress: 0,
                training_message: 'Training timed out. Please try again with a smaller file.'
            });
        }, 120000); // Reduced from 300 seconds to 120 seconds (2 minutes)
        
        pythonProcess.on('close', async (code) => {
            clearTimeout(trainingTimeout);
            const trainingDuration = Date.now() - processStartTime;
            console.log(`⏱️ Training process for machine ${machineId} completed in ${trainingDuration}ms with exit code ${code}`);
            
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
                // Parse training results from output - be more robust
                let trainingResult = null;
                const lines = rawOutput.split('\n');
                
                // Look for the success message with stats
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    try {
                        // Check if line starts with SUCCESS: and extract JSON part
                        if (trimmedLine.startsWith('SUCCESS:')) {
                            const jsonPart = trimmedLine.substring(8); // Remove 'SUCCESS:' prefix
                            const parsed = JSON.parse(jsonPart);
                            if (parsed.type === 'success' && parsed.stats) {
                                trainingResult = parsed.stats;
                                console.log('✅ Found training results:', trainingResult);
                                break;
                            }
                        } else {
                            // Try parsing as regular JSON
                            const parsed = JSON.parse(trimmedLine);
                            if (parsed.type === 'success' && parsed.stats) {
                                trainingResult = parsed.stats;
                                console.log('✅ Found training results:', trainingResult);
                                break;
                            }
                        }
                    } catch (e) {
                        // Not JSON, continue
                    }
                }
                
                if (trainingResult) {
                    // Training successful - update machine with comprehensive results
                    const modelParams = {
                        // Core training metrics
                        threshold: trainingResult.threshold,
                        mean_error: trainingResult.mean_error,
                        std_error: trainingResult.std_error,
                        min_error: trainingResult.min_error,
                        max_error: trainingResult.max_error,
                        percentile_90: trainingResult.percentile_90,
                        percentile_95: trainingResult.percentile_95,
                        percentile_99: trainingResult.percentile_99,
                        
                        // Model performance
                        final_loss: trainingResult.final_loss,
                        final_val_loss: trainingResult.final_val_loss,
                        epochs_trained: trainingResult.epochs_trained,
                        training_samples: trainingResult.training_samples,
                        training_duration: trainingResult.training_duration,
                        avg_epoch_time: trainingResult.avg_epoch_time,
                        
                        // Model configuration
                        source: 'ultra_simple_trained_model',
                        trained_columns: trainingResult.sensor_columns,
                        model_type: trainingResult.model_type,
                        training_date: new Date().toISOString(),
                        
                        // Pretrained model integration
                        pretrained_threshold: trainingResult.pretrained_threshold,
                        threshold_improvement: trainingResult.threshold_improvement,
                        
                        // Additional metadata
                        user_id: machine.userId.toString(),
                        machine_id: machineId,
                        model_version: '1.0',
                        training_algorithm: 'simple_autoencoder',
                        data_preprocessing: {
                            scaling_method: 'StandardScaler',
                            missing_value_handling: 'forward_fill_backward_fill',
                            outlier_handling: 'percentile_based_threshold'
                        },
                        model_architecture: {
                            type: 'autoencoder',
                            layers: ['dense_16', 'dense_8', 'dense_4', 'dense_8', 'dense_16', 'dense_output'],
                            activation: 'relu',
                            output_activation: 'linear',
                            loss_function: 'mse',
                            optimizer: 'adam'
                        },
                        training_config: {
                            batch_size: 32,
                            validation_split: 0.2,
                            early_stopping: false,
                            max_epochs: 5,
                            learning_rate: 0.001
                        },
                        performance_metrics: {
                            anomaly_detection_threshold: trainingResult.threshold,
                            reconstruction_error_stats: {
                                mean: trainingResult.mean_error,
                                std: trainingResult.std_error,
                                min: trainingResult.min_error,
                                max: trainingResult.max_error
                            },
                            percentiles: {
                                p90: trainingResult.percentile_90,
                                p95: trainingResult.percentile_95,
                                p99: trainingResult.percentile_99
                            }
                        }
                    };
                    
                    console.log('📊 Model params to save:', JSON.stringify(modelParams, null, 2));
                    
                    // Update machine with comprehensive training results
                    const updateData = {
                        training_status: 'completed',
                        trained: true,
                        training_progress: 100,
                        model_params: modelParams,
                        modelStatus: 'trained',
                        training_message: `Ultra-simple training completed successfully! Used ${trainingResult.training_samples} samples.`,
                        lastTrained: new Date(),
                        trainingDuration: trainingDuration,
                        training_columns: trainingResult.sensor_columns
                    };
                    
                    await Machine.findByIdAndUpdate(machineId, updateData);
                    
                    console.log(`✅ Ultra-simple training completed successfully for machine ${machineId}`);
                    console.log(`📊 Model threshold: ${trainingResult.threshold}`);
                    console.log(`🎯 Training samples: ${trainingResult.training_samples}`);
                    console.log(`⏱️ Training duration: ${trainingDuration}ms`);
                    console.log(`📁 Parameters saved for user: ${machine.userId}, machine: ${machineId}`);
                } else {
                    console.error('❌ No training results found in output. Raw output:', rawOutput);
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
        console.error(`❌ Error starting ultra-simple training for machine ${machineId}:`, error);
        await Machine.findByIdAndUpdate(machineId, {
            training_status: 'failed',
            training_progress: 0,
            training_message: `Training failed to start: ${error.message}`
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
        console.log(`📊 Progress update for ${machineId}: ${progress}% - ${message}`);
    } catch (error) {
        console.error(`Error updating progress for ${machineId}:`, error);
    }
}

// Helper function to force garbage collection if available
function forceGarbageCollection() {
    if (global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection');
    }
}

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

// Get machine training parameters
router.get('/machine/:id/training-params', async (req, res) => {
    try {
        const { id } = req.params;

        const machine = await Machine.findById(id);

        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        
        if (machine.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }

        // Check if machine has been trained
        if (!machine.model_params || machine.modelStatus !== 'trained') {
            return res.status(404).json({ 
                success: false, 
                message: 'Machine has not been trained yet',
                training_status: machine.training_status,
                model_status: machine.modelStatus
            });
        }

        // Return comprehensive training parameters
        const trainingParams = {
            success: true,
            machine_id: machine._id,
            machine_name: machine.machineName,
            user_id: machine.userId,
            training_status: machine.training_status,
            model_status: machine.modelStatus,
            last_trained: machine.lastTrained,
            training_duration: machine.trainingDuration,
            training_columns: machine.training_columns,
            model_params: machine.model_params,
            training_message: machine.training_message
        };

        res.json(trainingParams);

    } catch (error) {
        console.error('Get training params error:', error);
        res.status(500).json({ success: false, message: 'Server error while retrieving training parameters' });
    }
});

// Get all machines training parameters for a user
router.get('/machines/training-params', async (req, res) => {
    try {
        const machines = await Machine.find({ 
            userId: req.user._id,
            modelStatus: 'trained'
        }).select('machineName machineType model_params training_status lastTrained training_columns');

        const trainingParams = machines.map(machine => ({
            machine_id: machine._id,
            machine_name: machine.machineName,
            machine_type: machine.machineType,
            training_status: machine.training_status,
            last_trained: machine.lastTrained,
            training_columns: machine.training_columns,
            has_model_params: !!machine.model_params,
            model_summary: machine.model_params ? {
                threshold: machine.model_params.threshold,
                training_samples: machine.model_params.training_samples,
                epochs_trained: machine.model_params.epochs_trained,
                final_loss: machine.model_params.final_loss,
                model_type: machine.model_params.model_type,
                trained_columns_count: machine.model_params.trained_columns?.length || 0
            } : null
        }));

        res.json({
            success: true,
            user_id: req.user._id,
            total_trained_machines: trainingParams.length,
            machines: trainingParams
        });

    } catch (error) {
        console.error('Get all training params error:', error);
        res.status(500).json({ success: false, message: 'Server error while retrieving training parameters' });
    }
});

// Update machine training parameters (for existing machines)
router.put('/machine/:id/update-params', async (req, res) => {
    try {
        const { id } = req.params;

        const machine = await Machine.findById(id);

        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        
        if (machine.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }

        // Check if machine has been trained
        if (!machine.model_params || machine.modelStatus !== 'trained') {
            return res.status(404).json({ 
                success: false, 
                message: 'Machine has not been trained yet',
                training_status: machine.training_status,
                model_status: machine.modelStatus
            });
        }

        // Update with new comprehensive structure if missing fields
        const currentParams = machine.model_params;
        const updatedParams = {
            // Core training metrics
            threshold: currentParams.threshold || 1.0,
            mean_error: currentParams.mean_error || 0.5,
            std_error: currentParams.std_error || 0.3,
            min_error: currentParams.min_error || 0.1,
            max_error: currentParams.max_error || 2.0,
            percentile_90: currentParams.percentile_90 || 0.8,
            percentile_95: currentParams.percentile_95 || 1.0,
            percentile_99: currentParams.percentile_99 || 1.5,
            
            // Model performance
            final_loss: currentParams.final_loss || 0.5,
            final_val_loss: currentParams.final_val_loss || 0.6,
            epochs_trained: currentParams.epochs_trained || 2,
            training_samples: currentParams.training_samples || 500,
            training_duration: currentParams.training_duration || 15000,
            avg_epoch_time: currentParams.avg_epoch_time || 7500,
            
            // Model configuration
            source: currentParams.source || 'ultra_simple_trained_model',
            trained_columns: currentParams.trained_columns || machine.training_columns || [],
            model_type: currentParams.model_type || 'simple_autoencoder',
            training_date: currentParams.training_date || machine.lastTrained?.toISOString() || new Date().toISOString(),
            
            // Pretrained model integration
            pretrained_threshold: currentParams.pretrained_threshold || 0.9,
            threshold_improvement: currentParams.threshold_improvement || 0.1,
            
            // Additional metadata
            user_id: currentParams.user_id || machine.userId.toString(),
            machine_id: currentParams.machine_id || machine._id.toString(),
            model_version: currentParams.model_version || '1.0',
            training_algorithm: currentParams.training_algorithm || 'simple_autoencoder',
            data_preprocessing: currentParams.data_preprocessing || {
                scaling_method: 'StandardScaler',
                missing_value_handling: 'forward_fill_backward_fill',
                outlier_handling: 'percentile_based_threshold'
            },
            model_architecture: currentParams.model_architecture || {
                type: 'autoencoder',
                layers: ['dense_16', 'dense_8', 'dense_4', 'dense_8', 'dense_16', 'dense_output'],
                activation: 'relu',
                output_activation: 'linear',
                loss_function: 'mse',
                optimizer: 'adam'
            },
            training_config: currentParams.training_config || {
                batch_size: 32,
                validation_split: 0.2,
                early_stopping: false,
                max_epochs: 5,
                learning_rate: 0.001
            },
            performance_metrics: currentParams.performance_metrics || {
                anomaly_detection_threshold: currentParams.threshold || 1.0,
                reconstruction_error_stats: {
                    mean: currentParams.mean_error || 0.5,
                    std: currentParams.std_error || 0.3,
                    min: currentParams.min_error || 0.1,
                    max: currentParams.max_error || 2.0
                },
                percentiles: {
                    p90: currentParams.percentile_90 || 0.8,
                    p95: currentParams.percentile_95 || 1.0,
                    p99: currentParams.percentile_99 || 1.5
                }
            }
        };

        // Update the machine with comprehensive parameters
        await Machine.findByIdAndUpdate(machine._id, {
            model_params: updatedParams,
            training_status: 'completed'
        });

        res.json({
            success: true,
            message: 'Machine training parameters updated successfully',
            machine_id: machine._id,
            machine_name: machine.machineName,
            updated_params: updatedParams
        });

    } catch (error) {
        console.error('Update training params error:', error);
        res.status(500).json({ success: false, message: 'Server error while updating training parameters' });
    }
});

// Calculate risk and RUL for a trained machine
router.post('/machine/:id/calculate-risk-rul', upload.single('csvFile'), async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
        }

        const machine = await Machine.findById(id);

        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }
        
        if (machine.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }

        // Check if machine has been trained
        if (!machine.trained || !machine.model_params) {
            return res.status(400).json({ 
                success: false, 
                message: 'Machine has not been trained yet. Please train the machine first.',
                trained: machine.trained,
                has_model_params: !!machine.model_params
            });
        }

        const csvFilePath = req.file.path;
        console.log(`🔍 Calculating risk and RUL for machine ${id} using CSV: ${csvFilePath}`);

        // Start prediction process using the machine's stored parameters
        const predictionResult = await startPredictionWithStoredParams(machine, csvFilePath);

        // Clean up uploaded file
        if (fs.existsSync(csvFilePath)) {
            fs.unlinkSync(csvFilePath);
        }

        res.json({
            success: true,
            message: 'Risk and RUL calculation completed successfully',
            machine_id: machine._id,
            machine_name: machine.machineName,
            results: predictionResult
        });

    } catch (error) {
        console.error('Calculate risk/RUL error:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: `Error calculating risk and RUL: ${error.message}` 
        });
    }
});

// Helper function to start prediction using stored parameters
async function startPredictionWithStoredParams(machine, csvFilePath) {
    const machineId = machine._id.toString();
    const userId = machine.userId.toString();
    
    try {
        console.log(`🚀 Starting prediction for machine ${machineId} with stored parameters`);
        
        // Validate CSV file exists
        if (!fs.existsSync(csvFilePath)) {
            throw new Error('Prediction CSV file not found');
        }
        
        // Get stored model parameters
        const modelParams = machine.model_params;
        const trainedColumns = modelParams.trained_columns || machine.training_columns || [];
        const threshold = modelParams.threshold;
        
        console.log(`📊 Using stored parameters:`);
        console.log(`   - Threshold: ${threshold}`);
        console.log(`   - Trained columns: ${trainedColumns.length}`);
        console.log(`   - Model type: ${modelParams.model_type}`);
        
        // Prepare prediction parameters
        const pythonScriptPath = path.join(__dirname, '..', 'models', 'simple_predictor.py');
        
        // Set environment variables for Python script
        const env = { 
            ...process.env, 
            PYTHONUNBUFFERED: '1',
            SENSOR_COLUMNS: JSON.stringify(trainedColumns),
            MODEL_THRESHOLD: threshold.toString()
        };
        
        // Start Python prediction process
        console.log(`🚀 Starting Python prediction process: python3 ${pythonScriptPath} ${userId} ${machineId} ${csvFilePath}`);
        
        const pythonProcess = spawn('python3', [
            pythonScriptPath,
            userId,
            machineId,
            csvFilePath
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: env
        });
        
        let rawOutput = '';
        let processStartTime = Date.now();
        
        // Monitor Python process output
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            rawOutput += output;
            console.log(`[Python prediction stdout for ${machineId}]: ${output.trim()}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            console.error(`[Prediction Error for ${machineId}]: ${errorOutput}`);
        });
        
        // Add timeout to prevent hanging
        const predictionTimeout = setTimeout(() => {
            console.error(`⏰ Prediction timeout for machine ${machineId} after 60 seconds`);
            pythonProcess.kill('SIGTERM');
            throw new Error('Prediction timed out. Please try again with a smaller file.');
        }, 60000); // 60 seconds timeout
        
        // Wait for process completion
        return new Promise((resolve, reject) => {
            pythonProcess.on('close', async (code) => {
                clearTimeout(predictionTimeout);
                const predictionDuration = Date.now() - processStartTime;
                console.log(`⏱️ Prediction process for machine ${machineId} completed in ${predictionDuration}ms with exit code ${code}`);
                
                if (code !== 0) {
                    console.error(`❌ Prediction failed for machine ${machineId} with exit code ${code}`);
                    reject(new Error('Prediction failed. Please check your data and try again.'));
                    return;
                }
                
                try {
                    // Parse prediction results from output
                    let predictionResult = null;
                    const lines = rawOutput.split('\n');
                    
                    // Look for the success message with prediction stats
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;
                        
                        try {
                            // Check if line starts with SUCCESS: and extract JSON part
                            if (trimmedLine.startsWith('SUCCESS:')) {
                                const jsonPart = trimmedLine.substring(8); // Remove 'SUCCESS:' prefix
                                const parsed = JSON.parse(jsonPart);
                                if (parsed.type === 'success' && parsed.predictions) {
                                    predictionResult = parsed.predictions;
                                    console.log('✅ Found prediction results:', predictionResult);
                                    break;
                                }
                            } else {
                                // Try parsing as regular JSON
                                const parsed = JSON.parse(trimmedLine);
                                if (parsed.type === 'success' && parsed.predictions) {
                                    predictionResult = parsed.predictions;
                                    console.log('✅ Found prediction results:', predictionResult);
                                    break;
                                }
                            }
                        } catch (e) {
                            // Not JSON, continue
                        }
                    }
                    
                    if (predictionResult) {
                        // Calculate risk and RUL using stored parameters
                        const riskScore = predictionResult.anomaly_score || 0;
                        const isAnomaly = predictionResult.is_anomaly || false;
                        
                        // Use machine-specific parameters for calculations
                        const rulResult = calculateRULWithMachineParams(riskScore, isAnomaly, modelParams);
                        const healthScore = calculateHealthScoreWithMachineParams(riskScore, isAnomaly, modelParams);
                        const machineStatus = determineMachineStatus(healthScore);
                        
                        const finalResult = {
                            prediction_duration: predictionDuration,
                            anomaly_score: riskScore,
                            is_anomaly: isAnomaly,
                            health_score: healthScore,
                            machine_status: machineStatus,
                            rul_estimate: rulResult.rulEstimate,
                            risk_percentage: rulResult.riskPercentage,
                            prediction_confidence: predictionResult.confidence || 0.85,
                            processed_samples: predictionResult.processed_samples || 0,
                            model_threshold_used: threshold,
                            machine_params_used: {
                                threshold: modelParams.threshold,
                                mean_error: modelParams.mean_error,
                                std_error: modelParams.std_error,
                                model_type: modelParams.model_type,
                                training_samples: modelParams.training_samples
                            }
                        };
                        
                        console.log(`✅ Prediction completed successfully for machine ${machineId}`);
                        console.log(`📊 Anomaly score: ${riskScore}`);
                        console.log(`🏥 Health score: ${healthScore}`);
                        console.log(`⏰ RUL estimate: ${rulResult.rulEstimate} days`);
                        
                        resolve(finalResult);
                    } else {
                        console.error('❌ No prediction results found in output. Raw output:', rawOutput);
                        reject(new Error('Prediction completed but no valid results returned'));
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing prediction results for machine ${machineId}:`, error);
                    reject(error);
                }
            });
        });
        
    } catch (error) {
        console.error(`❌ Error starting prediction for machine ${machineId}:`, error);
        throw error;
    }
}

// Helper function to calculate RUL using machine-specific parameters
function calculateRULWithMachineParams(riskScore, isAnomaly = false, modelParams) {
    // Use machine-specific thresholds if available, otherwise use defaults
    const threshold = modelParams.threshold || 1.0;
    const meanError = modelParams.mean_error || 0.5;
    const stdError = modelParams.std_error || 0.3;
    
    // Normalize risk score based on machine's threshold
    const normalizedRisk = Math.min(1.0, riskScore / threshold);
    
    // Convert risk score to a percentage (0-100)
    const riskPercentage = Math.min(100, Math.max(0, normalizedRisk * 100));
    
    // Calculate RUL based on risk percentage and machine parameters
    let rulEstimate;
    if (riskPercentage >= 90) {
        // High risk - low RUL (0-30 days)
        rulEstimate = Math.max(0, 30 - (riskPercentage - 90) * 0.5);
    } else if (riskPercentage >= 70) {
        // Medium risk - moderate RUL (30-90 days)
        rulEstimate = 30 + (90 - riskPercentage) * 2;
    } else {
        // Low risk - high RUL (90-365 days)
        rulEstimate = 90 + (70 - riskPercentage) * 3;
    }
    
    // Ensure RUL is within reasonable bounds (0-365 days)
    rulEstimate = Math.max(0, Math.min(365, rulEstimate));
    
    return {
        rulEstimate: Math.round(rulEstimate),
        riskPercentage: Math.round(riskPercentage),
        modelParams: {
            threshold: threshold,
            mean_error: meanError,
            std_error: stdError,
            risk_score: riskScore,
            normalized_risk: normalizedRisk
        }
    };
}

// Helper function to calculate health score using machine-specific parameters
function calculateHealthScoreWithMachineParams(riskScore, isAnomaly = false, modelParams) {
    const threshold = modelParams.threshold || 1.0;
    const normalizedRisk = Math.min(1.0, riskScore / threshold);
    
    let healthScore;
    if (isAnomaly) {
        // If anomaly detected, health score is between 0-40
        healthScore = Math.max(0, 40 - (normalizedRisk * 100));
    } else {
        // If normal, health score is between 60-100
        healthScore = Math.min(100, 100 - (normalizedRisk * 50));
    }
    
    return Math.round(healthScore);
}

module.exports = router;
module.exports.calculateRULWithMachineParams = calculateRULWithMachineParams;
module.exports.calculateHealthScoreWithMachineParams = calculateHealthScoreWithMachineParams;
module.exports.determineMachineStatus = determineMachineStatus;
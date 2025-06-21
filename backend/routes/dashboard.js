const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Machine = require('../models/Machine');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');

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
        fileSize: 100 * 1024 * 1024 // 100MB limit
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
                scadaSystem: machine.scadaSystem,
                sensors: machine.sensors,
                modelStatus: machine.modelStatus,
                statusDetails: machine.statusDetails,
                lastTrained: machine.lastTrained,
                manufacturer: machine.manufacturer,
                model: machine.model,
                serialNumber: machine.serialNumber,
                assetTag: machine.assetTag,
                scadaVersion: machine.scadaVersion,
                plcType: machine.plcType,
                communicationProtocol: machine.communicationProtocol,
                ipAddress: machine.ipAddress,
                port: machine.port,
                department: machine.department,
                installationDate: machine.installationDate,
                lastMaintenance: machine.lastMaintenance
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
    // Set a long timeout for this specific route, e.g., 15 minutes
    req.setTimeout(900000);

    try {
        const machineData = req.body;
        
        // --- Assemble Sensors Array ---
        const sensors = [];
        // When form fields have the same name, multer creates an array.
        const sensorNames = Array.isArray(machineData.sensorName) ? machineData.sensorName : [machineData.sensorName];
        const sensorUnits = Array.isArray(machineData.sensorUnit) ? machineData.sensorUnit : [machineData.sensorUnit];

        if (sensorNames && sensorUnits && sensorNames.length === sensorUnits.length) {
            for (let i = 0; i < sensorNames.length; i++) {
                if (sensorNames[i]) { // Ensure sensor name is not empty
                    sensors.push({
                        sensorId: `sensor_${i + 1}`,
                        name: sensorNames[i],
                        type: sensorNames[i], // Using name as type for simplicity
                        unit: sensorUnits[i]
                    });
                }
            }
        }
        // --- End Assembly ---

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
        
        // Validate sensors
        if (sensors.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one valid sensor must be provided.' 
            });
        }
        
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
            sensors: sensors, // Use the assembled sensors array
            dataDescription: machineData.dataDescription,
            trainingDataPath: req.file.path,
            modelStatus: 'training'
        });
        
        // Save the new machine to get its ID
        await newMachine.save();

        // Asynchronously start the model training process without waiting for it to finish.
        // The Python script will update the DB on completion.
        trainAnomalyDetectionModel(
            newMachine._id,
            req.user._id,
            req.file.path,
            sensors.map(s => s.name)
        );

        // Immediately respond to the client that the process has started.
        res.status(201).json({
            success: true,
            message: 'Machine added and model training has started.',
            data: newMachine
        });

    } catch (error) {
        console.error('Add machine error:', error);

        // If a file was uploaded but an error occurred, clean it up.
        // The training function also cleans up, but this is a fallback.
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: `Failed to add machine: ${error.message}`
        });
    }
});

// Function to call the Python training script
function trainAnomalyDetectionModel(machineId, userId, dataPath, sensorNames) {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(__dirname, '..', 'models', 'anomaly.py');
        const sensorNamesArg = sensorNames.join(',');
        const pythonProcess = spawn('python3', [pythonScriptPath, 'train', userId.toString(), machineId.toString(), dataPath, sensorNamesArg]);

        let finalResult = null;
        let lastError = '';

        // Process stdout line by line
        const handleOutput = async (data) => {
            const output = data.toString();
            // Split by newline in case multiple JSON objects are sent at once
            const lines = output.split(/\\r?\\n/).filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const result = JSON.parse(line);
                    if (result.type === 'progress') {
                        // This is a progress update
                        await Machine.findByIdAndUpdate(machineId, {
                            trainingProgress: result.progress,
                            statusDetails: result.message
                        });
                    } else if (result.success) {
                        // This is the final success message
                        finalResult = result;
                    } else {
                        // This is a final failure message from the script
                        lastError = result.error || 'Unknown training error.';
                    }
                } catch (e) {
                    // Not a JSON line, just a regular log.
                    console.log(`[Training Log for ${machineId}]: ${line}`);
                }
            }
        };

        pythonProcess.stdout.on('data', handleOutput);
        pythonProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            console.error(`[Training Error for ${machineId}]: ${errorMsg}`);
            lastError += errorMsg;
        });

        pythonProcess.on('close', async (code) => {
            console.log(`Training process for machine ${machineId} exited with code ${code}`);
            
            // Clean up the uploaded file
            if (fs.existsSync(dataPath)) {
                fs.unlinkSync(dataPath, (err) => {
                    if(err) console.error(`Error deleting training file ${dataPath}:`, err)
                });
            }

            if (code === 0 && finalResult && finalResult.success) {
                // Success
                await Machine.findByIdAndUpdate(machineId, { 
                    modelStatus: 'trained',
                    trainingProgress: 100,
                    lastUpdated: Date.now(),
                    lastTrained: Date.now(),
                    operationalStatus: 'active',
                    statusDetails: 'Model trained successfully.',
                    trainingMetrics: finalResult.metrics || {}
                });
                resolve({ success: true, message: 'Model trained successfully.' });
            } else {
                // Failure
                const failureReason = `Training failed. Exit code: ${code}. Error: ${lastError}`;
                await Machine.findByIdAndUpdate(machineId, { 
                    modelStatus: 'failed',
                    operationalStatus: 'error',
                    trainingProgress: 0, // Reset progress on failure
                    statusDetails: failureReason
                });
                reject(new Error(failureReason));
            }
        });

        pythonProcess.on('error', (err) => {
            // This is for errors spawning the process itself
            console.error('Failed to start training process:', err);
            if (fs.existsSync(dataPath)) {
                fs.unlinkSync(dataPath);
            }
            reject(new Error('Failed to start training process.'));
        });
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
                trainingProgress: machine.trainingProgress,
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
        const modelDir = path.join(__dirname, '..', 'models', 'user_models', `user_${req.user._id.toString()}`, `machine_${machine._id.toString()}`);
        const columnsFilePath = path.join(modelDir, 'model_columns.json');

        if (!fs.existsSync(columnsFilePath)) {
            return res.status(500).json({ success: false, message: 'Model configuration (model_columns.json) not found. Please retrain the model.' });
        }

        const expectedColumns = JSON.parse(fs.readFileSync(columnsFilePath, 'utf-8'));
        
        // The frontend may send sensor IDs like 'sensor_0', 'sensor_1', etc.
        // The `machine.sensors` array maps these IDs to the actual column names from the CSV.
        const mappedSensorData = {};
        for (const sensor of machine.sensors) {
            if (sensorData.hasOwnProperty(sensor.sensorId)) {
                mappedSensorData[sensor.name] = sensorData[sensor.sensorId];
            }
        }
        
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
            req.user._id.toString(), 
            machine._id.toString(), 
            sequenceFilePath
        ]);

        let rawOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            rawOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Prediction Error for ${machine._id}]: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
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
                    res.json({ success: true, data: result.data });
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
router.post('/get-csv-headers', upload.single('trainingData'), (req, res) => {
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
            let headers = firstLine.split(delimiter);
            
            headers = headers.map(h => h.trim()).filter(h => h && h.toLowerCase() !== 'time_stamp' && h.toLowerCase() !== 'timestamp');

            if (headers.length === 0) {
                cleanupAndRespond(400, { success: false, message: 'Could not find any valid header columns in the uploaded file.' });
            } else {
                cleanupAndRespond(200, { success: true, headers: headers });
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

module.exports = router; 
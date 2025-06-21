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

// @route   POST /api/dashboard/machines
// @desc    Add a new machine, optionally with a CSV for training
// @access  Private
router.post('/machines', auth, upload.single('csvFile'), async (req, res) => {
    try {
        const machineData = req.body;
        const user = req.user;

        const newMachine = new Machine({
            ...machineData,
            userId: user._id,
            sensors: [],
            modelStatus: 'untrained',
            statusDetails: 'Machine added. Ready for data connection.'
        });

        if (req.file) {
            newMachine.training_data_path = req.file.path;
            newMachine.training_columns = JSON.parse(machineData.columns || '[]');
            newMachine.training_status = 'pending';
        }

        await newMachine.save();

        if (req.file) {
            // Start training process in the background
            trainModel(newMachine, user);
        }

        res.status(201).json({
            success: true,
            message: 'Machine added successfully. Training will start shortly if a file was provided.',
            machine: newMachine
        });

    } catch (error) {
        console.error('Add machine error:', error);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
});

async function trainModel(machine, user) {
    const machineId = machine._id.toString();
    const userId = user._id.toString();
    const filePath = machine.training_data_path;
    let columns = machine.training_columns;

    try {
        await Machine.findByIdAndUpdate(machineId, { training_status: 'in_progress' });
        
        const timestampSynonyms = ['timestamp', 'timestamps', 'time_stamp', 'date'];
        let timestampColumn = '';
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split(/\r?\n/);
        const header = lines[0];
        const fileColumns = header.split(/[,;]/).map(c => c.trim());


        for (const col of fileColumns) {
            if(timestampSynonyms.includes(col.toLowerCase())) {
                timestampColumn = col;
                break;
            }
        }
        
        if (timestampColumn && timestampColumn !== 'time_stamp') {
            lines[0] = header.replace(timestampColumn, 'time_stamp');
            const updatedData = lines.join('\n');
            fs.writeFileSync(filePath, updatedData);
        } else if (!timestampColumn) {
            throw new Error('No timestamp column found in the CSV file. Please use one of: ' + timestampSynonyms.join(', '));
        }

        const idSynonyms = ['id', 'machine_id'];
        columns = columns.filter(c => !timestampSynonyms.includes(c.toLowerCase()) && !idSynonyms.includes(c.toLowerCase()));
        
        const pythonProcess = spawn('python3', [
            path.join(__dirname, '../models/anomaly.py'),
            'train',
            userId,
            machineId,
            filePath,
            columns.join(',')
        ]);

        let lastJsonOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[TRAIN-LOG ${machineId}]: ${output}`);
            const jsonStrings = output.trim().split('\n');
            lastJsonOutput = jsonStrings[jsonStrings.length - 1];
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[TRAIN-ERR ${machineId}]: ${data.toString()}`);
        });

        pythonProcess.on('close', async (code) => {
            console.log(`[TRAIN-CLOSE ${machineId}]: child process exited with code ${code}`);
            try {
                const result = JSON.parse(lastJsonOutput);
                if (code === 0 && result.success) {
                    const paths = getModelPaths(userId, machineId);
                    const thresholdData = fs.readFileSync(paths.threshold_file, 'utf8');
                    await Machine.findByIdAndUpdate(machineId, {
                        training_status: 'completed',
                        model_params: JSON.parse(thresholdData),
                        modelStatus: 'trained'
                    });
                    console.log(`Training completed successfully for machine ${machineId}`);
                } else {
                    throw new Error(result.error || 'Unknown training error');
                }
            } catch (e) {
                await Machine.findByIdAndUpdate(machineId, { training_status: 'failed' });
                console.error(`Failed to update machine status after training for ${machineId}: ${e.message}`);
            }
        });

    } catch (error) {
        console.error(`Error during training setup for machine ${machineId}:`, error);
        await Machine.findByIdAndUpdate(machineId, { training_status: 'failed' });
    }
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

// @route   GET /api/dashboard/machine/:machineId/status
// @desc    Get training status for a specific machine
// @access  Private
router.get('/machine/:machineId/status', auth, async (req, res) => {
    try {
        const { machineId } = req.params;
        const machine = await Machine.findOne({ _id: machineId, userId: req.user._id });

        if (!machine) {
            return res.status(404).json({ success: false, message: 'Machine not found' });
        }

        res.json({
            success: true,
            status: machine.training_status,
            modelStatus: machine.modelStatus
        });

    } catch (error) {
        console.error(`Error fetching status for machine ${req.params.machineId}:`, error);
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

module.exports = router; 
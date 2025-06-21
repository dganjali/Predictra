const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Machine Identification
  machineName: {
    type: String,
    required: [true, 'Machine name is required'],
    trim: true,
    maxlength: [100, 'Machine name cannot exceed 100 characters']
  },
  machineType: {
    type: String,
    required: [true, 'Machine type is required'],
    enum: [
      'pump', 'motor', 'compressor', 'turbine', 'conveyor', 
      'milling_machine', 'lathe', 'press', 'furnace', 'dryer', 
      'fan', 'gearbox', 'bearing', 'valve', 'heat_exchanger', 'other'
    ]
  },
  manufacturer: {
    type: String,
    trim: true,
    maxlength: [100, 'Manufacturer name cannot exceed 100 characters']
  },
  model: {
    type: String,
    required: [true, 'Model number is required'],
    trim: true,
    maxlength: [100, 'Model number cannot exceed 100 characters']
  },
  serialNumber: {
    type: String,
    required: [true, 'Serial number is required'],
    trim: true,
    maxlength: [100, 'Serial number cannot exceed 100 characters']
  },
  assetTag: {
    type: String,
    trim: true,
    maxlength: [100, 'Asset tag cannot exceed 100 characters']
  },
  
  // SCADA Configuration
  scadaSystem: {
    type: String,
    required: [true, 'SCADA system is required'],
    enum: [
      'wonderware', 'siemens', 'rockwell', 'ge', 'honeywell', 
      'abb', 'schneider', 'custom', 'other'
    ]
  },
  scadaVersion: {
    type: String,
    trim: true,
    maxlength: [50, 'SCADA version cannot exceed 50 characters']
  },
  plcType: {
    type: String,
    enum: [
      'siemens_s7', 'rockwell_controllogix', 'rockwell_compactlogix',
      'schneider_modicon', 'abb_800xa', 'ge_rx3i', 'honeywell_c300', 'other'
    ]
  },
  communicationProtocol: {
    type: String,
    enum: [
      'modbus_tcp', 'modbus_rtu', 'opc_ua', 'opc_da', 'ethernet_ip',
      'profinet', 'profibus', 'hart', 'other'
    ]
  },
  ipAddress: {
    type: String,
    trim: true,
    maxlength: [15, 'IP address cannot exceed 15 characters']
  },
  port: {
    type: Number,
    min: [1, 'Port must be greater than 0'],
    max: [65535, 'Port must be less than 65536']
  },
  
  // Operational Parameters
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters']
  },
  installationDate: {
    type: Date
  },
  lastMaintenance: {
    type: Date
  },
  operatingHours: {
    type: Number,
    min: [0, 'Operating hours cannot be negative'],
    max: [24, 'Operating hours cannot exceed 24']
  },
  maintenanceInterval: {
    type: Number,
    min: [1, 'Maintenance interval must be at least 1 day']
  },
  criticality: {
    type: String,
    enum: ['critical', 'important', 'normal', 'low'],
    default: 'normal'
  },
  operatingMode: {
    type: String,
    enum: ['continuous', 'intermittent', 'batch', 'standby']
  },
  
  // Sensor Configuration
  sensors: [{
    sensorId: String,
    name: String,
    type: String,
    unit: String
  }],
  
  // Training Data Information
  dataDescription: {
    type: String,
    trim: true,
    maxlength: [500, 'Data description cannot exceed 500 characters']
  },
  trainingDataPath: {
    type: String
  },
  
  // Model Information
  modelStatus: {
    type: String,
    enum: ['untrained', 'training', 'trained', 'failed'],
    default: 'untrained'
  },
  statusDetails: {
    type: String
  },
  trainingMetrics: {
    type: Map,
    of: String
  },
  lastTrained: {
    type: Date
  },
  nextRetraining: {
    type: Date
  },
  
  // Current Status
  status: {
    type: String,
    enum: ['healthy', 'warning', 'critical', 'offline'],
    default: 'healthy'
  },
  healthScore: {
    type: Number,
    min: [0, 'Health score cannot be negative'],
    max: [100, 'Health score cannot exceed 100'],
    default: 100
  },
  rulEstimate: {
    type: Number,
    min: [0, 'RUL estimate cannot be negative'],
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Maintenance Information
  maintenanceStatus: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for efficient queries
machineSchema.index({ userId: 1, machineName: 1 });
machineSchema.index({ userId: 1, status: 1 });
machineSchema.index({ userId: 1, criticality: 1 });

module.exports = mongoose.model('Machine', machineSchema); 
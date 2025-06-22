const mongoose = require('mongoose');
const Machine = require('./models/Machine');

// Connect to MongoDB (adjust connection string as needed)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/predictive_maintenance';

async function testRiskRulCalculation() {
    try {
        console.log('🧪 Testing risk and RUL calculation functionality...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Find a trained machine
        const trainedMachine = await Machine.findOne({ 
            trained: true,
            model_params: { $exists: true, $ne: null }
        });
        
        if (!trainedMachine) {
            console.log('⚠️ No trained machines found in database');
            return;
        }
        
        console.log(`📊 Found trained machine: ${trainedMachine.machineName} (ID: ${trainedMachine._id})`);
        console.log(`👤 User ID: ${trainedMachine.userId}`);
        console.log(`🏷️ Machine Type: ${trainedMachine.machineType}`);
        console.log(`✅ Trained: ${trainedMachine.trained}`);
        console.log(`📈 Training Status: ${trainedMachine.training_status}`);
        console.log(`🤖 Model Status: ${trainedMachine.modelStatus}`);
        
        // Test the risk/RUL calculation functions
        console.log('\n🧮 Testing risk and RUL calculation functions...');
        
        // Import the calculation functions
        const dashboard = require('./routes/dashboard');
        const { calculateRULWithMachineParams, calculateHealthScoreWithMachineParams, determineMachineStatus } = dashboard;
        
        // Test with different risk scores
        const testCases = [
            { riskScore: 0.5, description: 'Low risk' },
            { riskScore: 1.0, description: 'Medium risk' },
            { riskScore: 1.5, description: 'High risk' },
            { riskScore: 2.0, description: 'Very high risk' }
        ];
        
        for (const testCase of testCases) {
            console.log(`\n📊 Testing ${testCase.description} (risk score: ${testCase.riskScore}):`);
            
            // Calculate RUL
            const rulResult = calculateRULWithMachineParams(testCase.riskScore, false, trainedMachine.model_params);
            console.log(`   - RUL Estimate: ${rulResult.rulEstimate} days`);
            console.log(`   - Risk Percentage: ${rulResult.riskPercentage}%`);
            console.log(`   - Normalized Risk: ${rulResult.modelParams.normalized_risk.toFixed(3)}`);
            
            // Calculate health score
            const healthScore = calculateHealthScoreWithMachineParams(testCase.riskScore, false, trainedMachine.model_params);
            console.log(`   - Health Score: ${healthScore}`);
            
            // Determine machine status
            const machineStatus = determineMachineStatus(healthScore);
            console.log(`   - Machine Status: ${machineStatus}`);
        }
        
        // Test anomaly detection
        console.log('\n🚨 Testing anomaly detection:');
        const anomalyRiskScore = 2.5;
        const rulAnomaly = calculateRULWithMachineParams(anomalyRiskScore, true, trainedMachine.model_params);
        const healthAnomaly = calculateHealthScoreWithMachineParams(anomalyRiskScore, true, trainedMachine.model_params);
        const statusAnomaly = determineMachineStatus(healthAnomaly);
        
        console.log(`   - Anomaly Risk Score: ${anomalyRiskScore}`);
        console.log(`   - RUL Estimate: ${rulAnomaly.rulEstimate} days`);
        console.log(`   - Health Score: ${healthAnomaly}`);
        console.log(`   - Machine Status: ${statusAnomaly}`);
        
        // Test machine-specific parameters
        console.log('\n🔧 Testing machine-specific parameters:');
        console.log(`   - Stored Threshold: ${trainedMachine.model_params.threshold}`);
        console.log(`   - Mean Error: ${trainedMachine.model_params.mean_error || 'N/A'}`);
        console.log(`   - Std Error: ${trainedMachine.model_params.std_error || 'N/A'}`);
        console.log(`   - Model Type: ${trainedMachine.model_params.model_type || 'N/A'}`);
        console.log(`   - Training Samples: ${trainedMachine.model_params.training_samples || 'N/A'}`);
        
        // Test parameter validation
        console.log('\n✅ Testing parameter validation:');
        const hasRequiredParams = trainedMachine.model_params && 
                                trainedMachine.model_params.threshold && 
                                trainedMachine.trained;
        
        console.log(`   - Has Required Parameters: ${hasRequiredParams}`);
        console.log(`   - Machine Trained: ${trainedMachine.trained}`);
        console.log(`   - Has Model Params: ${!!trainedMachine.model_params}`);
        console.log(`   - Has Threshold: ${!!trainedMachine.model_params?.threshold}`);
        
        if (hasRequiredParams) {
            console.log('✅ Machine is ready for risk/RUL calculation!');
        } else {
            console.log('❌ Machine is not ready for risk/RUL calculation');
        }
        
        console.log('\n🎉 Risk and RUL calculation test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing risk/RUL calculation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
testRiskRulCalculation().catch(console.error); 
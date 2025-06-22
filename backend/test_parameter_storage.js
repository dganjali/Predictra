const mongoose = require('mongoose');
const Machine = require('./models/Machine');

// Connect to MongoDB (adjust connection string as needed)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/predictive_maintenance';

async function testParameterStorage() {
    try {
        console.log('🧪 Testing training parameter storage...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Find a machine that has been trained
        const trainedMachine = await Machine.findOne({ 
            modelStatus: 'trained',
            model_params: { $exists: true, $ne: null }
        });
        
        if (!trainedMachine) {
            console.log('⚠️ No trained machines found in database');
            return;
        }
        
        console.log(`📊 Found trained machine: ${trainedMachine.machineName} (ID: ${trainedMachine._id})`);
        console.log(`👤 User ID: ${trainedMachine.userId}`);
        console.log(`🏷️ Machine Type: ${trainedMachine.machineType}`);
        console.log(`📈 Training Status: ${trainedMachine.training_status}`);
        console.log(`🤖 Model Status: ${trainedMachine.modelStatus}`);
        console.log(`📅 Last Trained: ${trainedMachine.lastTrained}`);
        
        // Check if model_params exists and has the expected structure
        if (trainedMachine.model_params) {
            console.log('\n📋 Model Parameters Structure:');
            console.log(`   - Threshold: ${trainedMachine.model_params.threshold}`);
            console.log(`   - Training Samples: ${trainedMachine.model_params.training_samples}`);
            console.log(`   - Epochs Trained: ${trainedMachine.model_params.epochs_trained}`);
            console.log(`   - Final Loss: ${trainedMachine.model_params.final_loss}`);
            console.log(`   - Model Type: ${trainedMachine.model_params.model_type}`);
            console.log(`   - Source: ${trainedMachine.model_params.source}`);
            console.log(`   - User ID: ${trainedMachine.model_params.user_id}`);
            console.log(`   - Machine ID: ${trainedMachine.model_params.machine_id}`);
            console.log(`   - Trained Columns Count: ${trainedMachine.model_params.trained_columns?.length || 0}`);
            
            // Check for additional metadata
            if (trainedMachine.model_params.data_preprocessing) {
                console.log(`   - Scaling Method: ${trainedMachine.model_params.data_preprocessing.scaling_method}`);
            }
            
            if (trainedMachine.model_params.model_architecture) {
                console.log(`   - Architecture Type: ${trainedMachine.model_params.model_architecture.type}`);
                console.log(`   - Loss Function: ${trainedMachine.model_params.model_architecture.loss_function}`);
            }
            
            if (trainedMachine.model_params.training_config) {
                console.log(`   - Batch Size: ${trainedMachine.model_params.training_config.batch_size}`);
                console.log(`   - Max Epochs: ${trainedMachine.model_params.training_config.max_epochs}`);
            }
            
            // Check performance metrics
            if (trainedMachine.model_params.performance_metrics) {
                console.log(`   - Anomaly Threshold: ${trainedMachine.model_params.performance_metrics.anomaly_detection_threshold}`);
                if (trainedMachine.model_params.performance_metrics.reconstruction_error_stats) {
                    console.log(`   - Mean Error: ${trainedMachine.model_params.performance_metrics.reconstruction_error_stats.mean}`);
                    console.log(`   - Std Error: ${trainedMachine.model_params.performance_metrics.reconstruction_error_stats.std}`);
                }
            }
            
            console.log('\n✅ Model parameters are properly stored!');
            
            // Test user-specific query
            const userMachines = await Machine.find({ 
                userId: trainedMachine.userId,
                modelStatus: 'trained'
            });
            
            console.log(`\n👤 User ${trainedMachine.userId} has ${userMachines.length} trained machines`);
            
            // Test machine-specific query
            const specificMachine = await Machine.findById(trainedMachine._id);
            if (specificMachine && specificMachine.model_params) {
                console.log(`\n🔍 Machine ${specificMachine._id} parameters retrieved successfully`);
                console.log(`   - Machine Name: ${specificMachine.machineName}`);
                console.log(`   - Has Model Params: ${!!specificMachine.model_params}`);
                console.log(`   - Training Columns: ${specificMachine.training_columns?.length || 0}`);
            }
            
        } else {
            console.log('❌ Model parameters not found');
        }
        
        // Test parameter retrieval by user
        const userTrainedMachines = await Machine.find({ 
            userId: trainedMachine.userId,
            modelStatus: 'trained'
        }).select('machineName machineType model_params training_status lastTrained training_columns');
        
        console.log(`\n📊 User ${trainedMachine.userId} trained machines summary:`);
        userTrainedMachines.forEach((machine, index) => {
            console.log(`   ${index + 1}. ${machine.machineName} (${machine.machineType})`);
            console.log(`      - Training Status: ${machine.training_status}`);
            console.log(`      - Last Trained: ${machine.lastTrained}`);
            console.log(`      - Has Params: ${!!machine.model_params}`);
            if (machine.model_params) {
                console.log(`      - Threshold: ${machine.model_params.threshold}`);
                console.log(`      - Samples: ${machine.model_params.training_samples}`);
            }
        });
        
        console.log('\n🎉 Parameter storage test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing parameter storage:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
testParameterStorage().catch(console.error); 
const mongoose = require('mongoose');
const Machine = require('./models/Machine');

// Connect to MongoDB (adjust connection string as needed)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/predictive_maintenance';

async function updateExistingMachines() {
    try {
        console.log('🔄 Updating existing machines to set trained field...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Find all machines
        const machines = await Machine.find({});
        console.log(`📊 Found ${machines.length} machines in database`);
        
        for (const machine of machines) {
            console.log(`\n🔧 Processing machine: ${machine.machineName} (ID: ${machine._id})`);
            console.log(`   - Current trained field: ${machine.trained}`);
            console.log(`   - Has model_params: ${!!machine.model_params}`);
            console.log(`   - Model status: ${machine.modelStatus}`);
            console.log(`   - Training status: ${machine.training_status}`);
            
            // Determine if machine should be marked as trained
            let shouldBeTrained = false;
            
            if (machine.model_params && machine.model_params.threshold) {
                shouldBeTrained = true;
                console.log(`   ✅ Machine has model parameters, marking as trained`);
            } else if (machine.modelStatus === 'trained') {
                shouldBeTrained = true;
                console.log(`   ✅ Machine has modelStatus 'trained', marking as trained`);
            } else if (machine.training_status === 'completed') {
                shouldBeTrained = true;
                console.log(`   ✅ Machine has training_status 'completed', marking as trained`);
            } else {
                console.log(`   ❌ Machine does not meet training criteria`);
            }
            
            // Update the machine if needed
            if (shouldBeTrained && !machine.trained) {
                await Machine.findByIdAndUpdate(machine._id, { trained: true });
                console.log(`   🔄 Updated machine to trained: true`);
            } else if (!shouldBeTrained && machine.trained) {
                await Machine.findByIdAndUpdate(machine._id, { trained: false });
                console.log(`   🔄 Updated machine to trained: false`);
            } else {
                console.log(`   ✅ No update needed`);
            }
        }
        
        // Verify the updates
        console.log('\n📋 Verification of updates:');
        const updatedMachines = await Machine.find({});
        
        for (const machine of updatedMachines) {
            console.log(`   - ${machine.machineName}: trained=${machine.trained}, has_params=${!!machine.model_params}`);
        }
        
        const trainedCount = updatedMachines.filter(m => m.trained).length;
        console.log(`\n📊 Summary: ${trainedCount}/${updatedMachines.length} machines are now marked as trained`);
        
        console.log('\n🎉 Machine updates completed successfully!');
        
    } catch (error) {
        console.error('❌ Error updating machines:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the update
updateExistingMachines().catch(console.error); 
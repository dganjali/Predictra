#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:1000';

async function testTrainingWorkflow() {
    console.log('🧪 Testing Training and Prediction Workflow');
    console.log('=' * 50);
    
    try {
        // Step 1: Create a test user (or use existing)
        const testUser = {
            email: 'testworkflow@example.com',
            password: 'testpassword123'
        };
        
        let authToken;
        
        // Always try to sign in first since user might already exist
        try {
            console.log('🔐 Attempting to sign in...');
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/signin`, testUser);
            authToken = loginResponse.data.token;
            console.log('✅ Signed in successfully');
        } catch (loginError) {
            console.log('ℹ️ Sign in failed:', loginError.response?.data?.message || loginError.message);
            console.log('🔄 Trying to create new user...');
            try {
                const signupResponse = await axios.post(`${BASE_URL}/api/auth/signup`, {
                    firstName: 'Test',
                    lastName: 'User',
                    email: testUser.email,
                    password: testUser.password
                });
                authToken = signupResponse.data.token;
                console.log('✅ Created new test user');
            } catch (signupError) {
                console.error('❌ Failed to create or sign in user:', signupError.response?.data || signupError.message);
                return;
            }
        }
        
        // Step 2: Create a test machine
        const machineData = {
            machineName: 'Test Machine Workflow',
            machineType: 'Industrial Equipment',
            location: 'Test Factory',
            sensors: ['temperature', 'vibration', 'pressure', 'speed']
        };
        
        const machineResponse = await axios.post(`${BASE_URL}/api/dashboard/machines`, machineData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const machineId = machineResponse.data._id;
        console.log(`✅ Created test machine: ${machineId}`);
        
        // Step 3: Test training with CSV file
        const csvFilePath = path.join(__dirname, 'models', '0.csv');
        if (!fs.existsSync(csvFilePath)) {
            console.error(`❌ Test CSV file not found: ${csvFilePath}`);
            return;
        }
        
        const formData = new FormData();
        formData.append('csvFile', fs.createReadStream(csvFilePath));
        formData.append('sensorConfig', JSON.stringify({
            'temperature': 'Temperature',
            'vibration': 'Vibration',
            'pressure': 'Pressure',
            'speed': 'Speed'
        }));
        
        console.log('🚀 Starting training...');
        const trainingResponse = await axios.post(
            `${BASE_URL}/api/dashboard/machine/${machineId}/train`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${authToken}`
                },
                timeout: 120000 // 2 minute timeout
            }
        );
        
        console.log('✅ Training completed:', trainingResponse.data.message);
        console.log('📊 Training stats:', {
            samples: trainingResponse.data.training_samples,
            threshold: trainingResponse.data.threshold,
            duration: trainingResponse.data.trainingDuration
        });
        
        // Step 4: Test prediction
        console.log('🔮 Starting prediction...');
        const predictionFormData = new FormData();
        predictionFormData.append('csvFile', fs.createReadStream(csvFilePath));
        
        const predictionResponse = await axios.post(
            `${BASE_URL}/api/dashboard/machine/${machineId}/predict`,
            predictionFormData,
            {
                headers: {
                    ...predictionFormData.getHeaders(),
                    Authorization: `Bearer ${authToken}`
                },
                timeout: 60000 // 1 minute timeout
            }
        );
        
        console.log('✅ Prediction completed:', predictionResponse.data.message);
        console.log('📊 Prediction results:', {
            healthScore: predictionResponse.data.healthScore,
            rulEstimate: predictionResponse.data.rulEstimate,
            status: predictionResponse.data.status,
            anomalyScore: predictionResponse.data.anomalyScore
        });
        
        // Step 5: Check machine status
        const machineStatusResponse = await axios.get(`${BASE_URL}/api/dashboard/machines`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const updatedMachine = machineStatusResponse.data.find(m => m._id === machineId);
        console.log('📊 Final machine status:', {
            trained: updatedMachine.trained,
            healthScore: updatedMachine.healthScore,
            rulEstimate: updatedMachine.rulEstimate,
            status: updatedMachine.status
        });
        
        console.log('🎉 Workflow test completed successfully!');
        
    } catch (error) {
        console.error('❌ Workflow test failed:', error.response?.data || error.message);
        if (error.response?.status) {
            console.error('❌ HTTP Status:', error.response.status);
        }
    }
}

// Run the test
testTrainingWorkflow().catch(console.error);

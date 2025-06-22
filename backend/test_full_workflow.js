#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:1000';

async function testFullWorkflow() {
    console.log('🧪 Testing Full Workflow: Create → Train → Calculate Risk RUL');
    console.log('=' * 60);
    
    try {
        // Step 1: Create a test user (or use existing)
        const testUser = {
            email: 'testfullworkflow@example.com',
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
            console.log('ℹ️ Sign in failed, creating new user...');
            try {
                const signupResponse = await axios.post(`${BASE_URL}/api/auth/signup`, {
                    firstName: 'Test',
                    lastName: 'Full',
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
        
        // Step 2: Create a test machine with valid enum
        const machineData = {
            machineName: 'Test Full Workflow Machine',
            machineType: 'Pump', // Use valid enum value
            location: 'Test Factory',
            sensors: ['temperature', 'vibration', 'pressure', 'speed']
        };
        
        console.log('🏭 Creating test machine...');
        const machineResponse = await axios.post(`${BASE_URL}/api/dashboard/machines`, machineData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const machineId = machineResponse.data._id;
        console.log(`✅ Created test machine: ${machineId}`);
        
        // Step 3: Train the machine
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
        
        // Step 4: Now test calculate-risk-rul
        console.log('🔮 Testing calculate-risk-rul endpoint...');
        const predictionFormData = new FormData();
        predictionFormData.append('csvFile', fs.createReadStream(csvFilePath));
        
        const riskRulResponse = await axios.post(
            `${BASE_URL}/api/dashboard/machine/${machineId}/calculate-risk-rul`,
            predictionFormData,
            {
                headers: {
                    ...predictionFormData.getHeaders(),
                    Authorization: `Bearer ${authToken}`
                },
                timeout: 60000 // 1 minute timeout
            }
        );
        
        console.log('✅ Calculate risk RUL completed successfully!');
        console.log('📊 Results:', {
            success: riskRulResponse.data.success,
            message: riskRulResponse.data.message,
            machine_id: riskRulResponse.data.machine_id,
            results: riskRulResponse.data.results ? {
                health_score: riskRulResponse.data.results.health_score,
                rul_estimate: riskRulResponse.data.results.rul_estimate,
                machine_status: riskRulResponse.data.results.machine_status,
                anomaly_score: riskRulResponse.data.results.anomaly_score
            } : 'No results'
        });
        
        console.log('🎉 Full workflow test completed successfully!');
        
    } catch (error) {
        console.error('❌ Workflow test failed:', error.response?.data || error.message);
        if (error.response?.status) {
            console.error('❌ HTTP Status:', error.response.status);
        }
        if (error.response?.data) {
            console.error('❌ Error details:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.stack) {
            console.error('❌ Stack trace:', error.stack);
        }
    }
}

// Run the test
testFullWorkflow().catch(console.error);

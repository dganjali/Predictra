#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:1000';

async function testCalculateRiskRul() {
    console.log('🧪 Testing Calculate Risk RUL Endpoint');
    console.log('=' * 50);
    
    try {
        // Step 1: Sign in to get auth token
        const testUser = {
            email: 'testworkflow@example.com',
            password: 'testpassword123'
        };
        
        console.log('🔐 Signing in...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/signin`, testUser);
        const authToken = loginResponse.data.token;
        console.log('✅ Signed in successfully');
        
        // Step 2: Use the specific machine ID from the error
        const machineId = '68579d29402d0e8159cceb32'; // From the user's error message
        console.log(`🎯 Testing with specific machine ID: ${machineId}`);
        
        // Check if this machine exists first
        try {
            const machineResponse = await axios.get(`${BASE_URL}/api/dashboard/machines`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log('📋 Machines response:', machineResponse.data);
        } catch (err) {
            console.log('⚠️ Could not get machines list, proceeding with direct test...');
        }
        
        // Step 3: Test the calculate-risk-rul endpoint
        const csvFilePath = path.join(__dirname, 'models', '0.csv');
        if (!fs.existsSync(csvFilePath)) {
            console.error(`❌ Test CSV file not found: ${csvFilePath}`);
            return;
        }
        
        console.log('🔮 Testing calculate-risk-rul endpoint...');
        const formData = new FormData();
        formData.append('csvFile', fs.createReadStream(csvFilePath));
        
        const response = await axios.post(
            `${BASE_URL}/api/dashboard/machine/${machineId}/calculate-risk-rul`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${authToken}`
                },
                timeout: 60000 // 1 minute timeout
            }
        );
        
        console.log('✅ Calculate risk RUL completed successfully!');
        console.log('📊 Results:', {
            success: response.data.success,
            message: response.data.message,
            results: response.data.results ? {
                health_score: response.data.results.health_score,
                rul_estimate: response.data.results.rul_estimate,
                machine_status: response.data.results.machine_status,
                anomaly_score: response.data.results.anomaly_score
            } : 'No results'
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status) {
            console.error('❌ HTTP Status:', error.response.status);
        }
        if (error.response?.data) {
            console.error('❌ Error details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testCalculateRiskRul().catch(console.error);

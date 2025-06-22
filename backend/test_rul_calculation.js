const dashboard = require('./routes/dashboard');

function testRULCalculations() {
    console.log('🧪 Testing RUL calculations with new thresholds...');
    console.log('📊 Average RUL: 150 days');
    console.log('⚠️  Unhealthy threshold: < 90 days');
    console.log('');

    // Test the basic RUL calculation function
    console.log('🔧 Testing basic RUL calculation:');
    const testCases = [
        { riskScore: 0.5, description: 'Low risk' },
        { riskScore: 0.8, description: 'Medium risk' },
        { riskScore: 1.0, description: 'High risk' },
        { riskScore: 1.5, description: 'Very high risk' },
        { riskScore: 2.0, description: 'Extreme risk' }
    ];

    testCases.forEach(test => {
        const result = dashboard.calculateRUL(test.riskScore);
        const status = result.rulEstimate >= 150 ? '🟢 Healthy' : 
                      result.rulEstimate >= 90 ? '🟡 Below Average' : '🔴 Unhealthy';
        
        console.log(`   ${test.description} (risk: ${test.riskScore}):`);
        console.log(`     - RUL: ${result.rulEstimate} days ${status}`);
        console.log(`     - Risk %: ${result.riskPercentage}%`);
        console.log('');
    });

    // Test machine-specific RUL calculation
    console.log('🤖 Testing machine-specific RUL calculation:');
    const mockModelParams = {
        threshold: 1.0,
        mean_error: 0.5,
        std_error: 0.3
    };

    testCases.forEach(test => {
        const result = dashboard.calculateRULWithMachineParams(test.riskScore, false, mockModelParams);
        const status = result.rulEstimate >= 150 ? '🟢 Healthy' : 
                      result.rulEstimate >= 90 ? '🟡 Below Average' : '🔴 Unhealthy';
        
        console.log(`   ${test.description} (risk: ${test.riskScore}):`);
        console.log(`     - RUL: ${result.rulEstimate} days ${status}`);
        console.log(`     - Risk %: ${result.riskPercentage}%`);
        console.log(`     - Normalized Risk: ${result.modelParams.normalized_risk.toFixed(3)}`);
        console.log('');
    });

    // Test health score calculation
    console.log('🏥 Testing health score calculation:');
    testCases.forEach(test => {
        const rulResult = dashboard.calculateRULWithMachineParams(test.riskScore, false, mockModelParams);
        const healthResult = dashboard.calculateHealthScoreWithMachineParams(test.riskScore, false, mockModelParams);
        
        let healthStatus;
        if (healthResult >= 80) healthStatus = '🟢 Excellent';
        else if (healthResult >= 60) healthStatus = '🟡 Good';
        else if (healthResult >= 40) healthStatus = '🟠 Warning';
        else healthStatus = '🔴 Critical';
        
        console.log(`   ${test.description} (risk: ${test.riskScore}):`);
        console.log(`     - RUL: ${rulResult.rulEstimate} days`);
        console.log(`     - Health Score: ${healthResult} ${healthStatus}`);
        console.log('');
    });

    // Test threshold boundaries
    console.log('🎯 Testing threshold boundaries:');
    const boundaryTests = [
        { riskScore: 0.7, description: 'At classifier threshold (70%)' },
        { riskScore: 0.9, description: 'At RUL threshold (90%)' },
        { riskScore: 1.0, description: 'At 100% risk' }
    ];

    boundaryTests.forEach(test => {
        const result = dashboard.calculateRULWithMachineParams(test.riskScore, false, mockModelParams);
        console.log(`   ${test.description}:`);
        console.log(`     - RUL: ${result.rulEstimate} days`);
        console.log(`     - Risk %: ${result.riskPercentage}%`);
        console.log('');
    });

    console.log('✅ RUL calculation test completed!');
    console.log('');
    console.log('📋 Summary of new thresholds:');
    console.log('   - Average RUL: 150 days (healthy baseline)');
    console.log('   - Below Average: 90-150 days');
    console.log('   - Unhealthy: < 90 days');
    console.log('   - Risk thresholds: 70% (classifier), 90% (RUL)');
}

testRULCalculations(); 
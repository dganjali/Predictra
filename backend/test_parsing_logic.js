const { spawn } = require('child_process');
const path = require('path');

async function testParsingLogic() {
    console.log('🧪 Testing training output parsing logic...');
    
    const pythonScript = path.join(__dirname, 'test_training_parsing.py');
    
    const pythonProcess = spawn('python', [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let rawOutput = '';
    let progress = 0;
    let message = 'Initializing...';
    let detailedMessages = [];
    let trainingResult = null;
    
    // Monitor Python process output
    pythonProcess.stdout.on('data', async (data) => {
        const output = data.toString();
        rawOutput += output;
        console.log(`[Python stdout]: ${output.trim()}`);
        
        // Parse mixed output from Python script (simulating the data event handler)
        try {
            const lines = output.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    
                    if (data.type === 'progress') {
                        progress = data.progress || 0;
                        message = data.message || 'Processing...';
                        console.log(`📊 Progress: ${progress}% - ${message}`);
                    } else if (data.type === 'message') {
                        detailedMessages.push({
                            timestamp: new Date().toISOString(),
                            message: data.message,
                            type: data.message_type || 'info'
                        });
                        console.log(`💬 Message: ${data.message} (${data.message_type})`);
                    }
                } catch (parseError) {
                    // Skip lines that aren't valid JSON
                    continue;
                }
            }
        } catch (parseError) {
            console.error('Error parsing Python output:', parseError);
        }
    });
    
    pythonProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error(`[Python stderr]: ${errorOutput}`);
    });
    
    // Handle process completion (simulating the close event handler)
    pythonProcess.on('close', async (code) => {
        console.log(`⏱️ Python process completed with exit code ${code}`);
        
        if (code !== 0) {
            console.error(`❌ Python process failed with exit code ${code}`);
            return;
        }
        
        try {
            // Parse training results from output - be more robust
            const lines = rawOutput.split('\n');
            
            // Look for the success message with stats
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                try {
                    // Check if line starts with SUCCESS: and extract JSON part
                    if (trimmedLine.startsWith('SUCCESS:')) {
                        const jsonPart = trimmedLine.substring(8); // Remove 'SUCCESS:' prefix
                        const parsed = JSON.parse(jsonPart);
                        if (parsed.type === 'success' && parsed.stats) {
                            trainingResult = parsed.stats;
                            console.log('✅ Found training results:', trainingResult);
                            break;
                        }
                    } else {
                        // Try parsing as regular JSON
                        const parsed = JSON.parse(trimmedLine);
                        if (parsed.type === 'success' && parsed.stats) {
                            trainingResult = parsed.stats;
                            console.log('✅ Found training results:', trainingResult);
                            break;
                        }
                    }
                } catch (e) {
                    // Not JSON, continue
                }
            }
            
            if (trainingResult) {
                console.log('🎉 Training parsing test PASSED!');
                console.log(`📊 Final progress: ${progress}%`);
                console.log(`📊 Final message: ${message}`);
                console.log(`📊 Training result: ${JSON.stringify(trainingResult, null, 2)}`);
                console.log(`📊 Detailed messages: ${detailedMessages.length}`);
            } else {
                console.error('❌ Training parsing test FAILED!');
                console.error('❌ No training results found in output.');
                console.error('❌ Raw output:', rawOutput);
            }
            
        } catch (error) {
            console.error(`❌ Error processing training results:`, error);
        }
    });
}

// Run the test
testParsingLogic().catch(console.error); 
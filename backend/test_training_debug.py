#!/usr/bin/env python3
"""
Simple test script to debug training process
"""

import sys
import os
import time
import json

# Add the models directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'models'))

def test_training_script():
    """Test the training script with a simple CSV"""
    
    # Create a simple test CSV
    test_csv_path = 'test_data.csv'
    with open(test_csv_path, 'w') as f:
        f.write("sensor1,sensor2,sensor3,sensor4,sensor5\n")
        for i in range(100):
            f.write(f"{i*0.1},{i*0.2},{i*0.3},{i*0.4},{i*0.5}\n")
    
    print(f"Created test CSV with 100 rows: {test_csv_path}")
    
    # Test directory
    test_dir = 'test_model_output'
    if not os.path.exists(test_dir):
        os.makedirs(test_dir)
    
    # Import and test the trainer
    try:
        from simple_trainer import SimpleAnomalyTrainer
        
        print("Creating trainer instance...")
        trainer = SimpleAnomalyTrainer()
        
        print("Starting training...")
        start_time = time.time()
        
        # Train with test data
        trainer.train(test_csv_path, test_dir, ['sensor1', 'sensor2', 'sensor3', 'sensor4', 'sensor5'])
        
        end_time = time.time()
        print(f"Training completed in {end_time - start_time:.2f} seconds")
        
        # Check if files were created
        expected_files = ['model.h5', 'scaler.pkl', 'columns.json', 'threshold.json', 'training_stats.json']
        for file in expected_files:
            file_path = os.path.join(test_dir, file)
            if os.path.exists(file_path):
                print(f"✓ {file} created successfully")
            else:
                print(f"✗ {file} missing")
        
        # Clean up
        os.remove(test_csv_path)
        import shutil
        shutil.rmtree(test_dir)
        print("Test completed and cleaned up")
        
    except Exception as e:
        print(f"Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_training_script() 
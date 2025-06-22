#!/usr/bin/env python3
"""
Test to verify pretrained model integration for faster training
"""

import os
import sys
import tempfile
import time
import pandas as pd
import numpy as np

def create_test_csv():
    """Create a test CSV file with 10 sensors to match pretrained model"""
    # Create test data with 10 sensors to match pretrained model
    np.random.seed(42)
    n_samples = 200
    n_sensors = 10
    
    data = {}
    # Use the exact column names from pretrained config
    column_names = [
        "sensor_0_avg", "sensor_1_avg", "sensor_2_avg", "sensor_5_avg", "sensor_6_avg",
        "sensor_7_avg", "sensor_8_avg", "sensor_9_avg", "sensor_10_avg", "sensor_11_avg"
    ]
    
    for i, col_name in enumerate(column_names):
        data[col_name] = np.random.normal(0, 1, n_samples)
    
    df = pd.DataFrame(data)
    
    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
    df.to_csv(temp_file.name, index=False)
    temp_file.close()
    
    return temp_file.name

def test_pretrained_training():
    """Test training with pretrained model"""
    print("Testing pretrained model integration...")
    csv_file = create_test_csv()
    
    print(f"Test CSV created: {csv_file}")
    print(f"CSV has 10 sensors to match pretrained model")
    
    # Create test output directory
    output_dir = tempfile.mkdtemp()
    print(f"Output directory: {output_dir}")
    
    # Test sensor columns matching pretrained model
    sensor_columns = [f'sensor_{i}_avg' for i in range(10)]
    
    # Import and run training
    try:
        sys.path.append(os.path.dirname(__file__))
        from models.simple_trainer import UltraSimpleTrainer
        
        print("Starting training with pretrained model...")
        start_time = time.time()
        
        trainer = UltraSimpleTrainer("test_user", "test_machine")
        
        # Run training
        result = trainer.train(csv_file, sensor_columns)
        
        end_time = time.time()
        training_duration = end_time - start_time
        
        print(f"✅ Training completed in {training_duration:.2f} seconds!")
        print(f"Result: {result}")
        
        # Check if pretrained model was used
        if 'pretrained_threshold' in result:
            print(f"✅ Pretrained model was used!")
            print(f"   - Pretrained threshold: {result['pretrained_threshold']:.6f}")
            print(f"   - New threshold: {result['threshold']:.6f}")
            print(f"   - Threshold improvement: {result['threshold_improvement']:.6f}")
        else:
            print(f"⚠️ Pretrained model was not used (trained from scratch)")
        
        # Performance check
        if training_duration < 15:  # Should be very fast with pretrained model
            print(f"🚀 EXCELLENT! Training completed in {training_duration:.2f}s (under 15s target)")
        elif training_duration < 30:
            print(f"✅ GOOD! Training completed in {training_duration:.2f}s (under 30s target)")
        else:
            print(f"⚠️ SLOW! Training took {training_duration:.2f}s (over 30s)")
        
        # Check if log file was created
        if os.path.exists('training.log'):
            print("✅ Log file created: training.log")
            with open('training.log', 'r') as f:
                log_content = f.read()
                print(f"📄 Log file size: {len(log_content)} characters")
                
                # Check for pretrained model usage in logs
                if "pretrained" in log_content.lower():
                    print("✅ Logs show pretrained model was used")
                else:
                    print("⚠️ Logs don't show pretrained model usage")
        else:
            print("❌ Log file not found")
        
    except Exception as e:
        print(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        try:
            os.unlink(csv_file)
            import shutil
            shutil.rmtree(output_dir)
        except:
            pass

if __name__ == "__main__":
    test_pretrained_training() 
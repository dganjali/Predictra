#!/usr/bin/env python3
"""
Test script for the new training system.
"""

import os
import sys
import pandas as pd
import numpy as np

# Add the backend/models directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'models'))

from trainer import SimpleTrainer

def create_test_data():
    """Create a simple test CSV file."""
    # Generate synthetic sensor data
    np.random.seed(42)
    n_samples = 1000
    
    # Create time series data with some patterns
    time = pd.date_range('2024-01-01', periods=n_samples, freq='H')
    
    # Create sensor data with some anomalies
    temperature = 20 + 5 * np.sin(np.linspace(0, 4*np.pi, n_samples)) + np.random.normal(0, 1, n_samples)
    pressure = 100 + 10 * np.cos(np.linspace(0, 2*np.pi, n_samples)) + np.random.normal(0, 2, n_samples)
    vibration = 0.5 + 0.2 * np.sin(np.linspace(0, 8*np.pi, n_samples)) + np.random.normal(0, 0.1, n_samples)
    
    # Add some anomalies
    temperature[500:520] += 15  # Temperature spike
    pressure[700:720] -= 20     # Pressure drop
    vibration[300:320] += 0.5   # Vibration spike
    
    # Create DataFrame
    df = pd.DataFrame({
        'timestamp': time,
        'temperature': temperature,
        'pressure': pressure,
        'vibration': vibration
    })
    
    # Save to CSV
    csv_path = 'test_data.csv'
    df.to_csv(csv_path, index=False)
    print(f"Created test data with {len(df)} samples")
    return csv_path

def test_training():
    """Test the training system."""
    print("🧪 Testing new training system...")
    
    # Create test data
    csv_path = create_test_data()
    
    try:
        # Create trainer
        trainer = SimpleTrainer('test_user', 'test_machine')
        
        # Define sensor columns
        sensor_columns = ['temperature', 'pressure', 'vibration']
        
        print(f"📊 Training with columns: {sensor_columns}")
        
        # Train model
        stats = trainer.train(csv_path, sensor_columns)
        
        print("✅ Training completed successfully!")
        print(f"📈 Final loss: {stats['final_loss']:.6f}")
        print(f"🎯 Threshold: {stats['threshold']:.6f}")
        print(f"📊 Training samples: {stats['training_samples']}")
        print(f"🔧 Model type: {stats['model_type']}")
        
        # Clean up
        if os.path.exists(csv_path):
            os.remove(csv_path)
            print("🧹 Cleaned up test data")
        
        return True
        
    except Exception as e:
        print(f"❌ Training test failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_training()
    sys.exit(0 if success else 1) 
#!/usr/bin/env python3
"""
Test script to verify pretrained model works with the new column structure
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import load_model
import joblib

def test_pretrained_model():
    """Test the pretrained model with the new column structure"""
    print("🧪 Testing pretrained model with new column structure...")
    
    # Load pretrained config
    config_path = os.path.join(os.path.dirname(__file__), 'models', 'pretrained_config.json')
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    print(f"📊 Pretrained columns: {config['pretrained_model']['trained_columns']}")
    print(f"📊 Number of columns: {len(config['pretrained_model']['trained_columns'])}")
    
    # Load pretrained model and scaler
    model_path = os.path.join(os.path.dirname(__file__), 'models', config['pretrained_model']['model_path'])
    scaler_path = os.path.join(os.path.dirname(__file__), 'models', config['pretrained_model']['scaler_path'])
    
    model = load_model(model_path)
    scaler = joblib.load(scaler_path)
    
    print(f"✅ Loaded model with input shape: {model.input_shape}")
    print(f"✅ Loaded scaler with feature names: {scaler.feature_names_in_.tolist()}")
    
    # Create test data with all columns
    print("\n🧪 Creating test data with all columns...")
    test_data = {}
    for col in config['pretrained_model']['trained_columns']:
        test_data[col] = np.random.normal(0, 1, 100)
    
    test_df = pd.DataFrame(test_data)
    print(f"📊 Test data shape: {test_df.shape}")
    print(f"📊 Test data columns: {list(test_df.columns)}")
    
    # Test scaling
    print("\n🧪 Testing scaling...")
    try:
        scaled_data = scaler.transform(test_df)
        print(f"✅ Scaling successful! Scaled shape: {scaled_data.shape}")
    except Exception as e:
        print(f"❌ Scaling failed: {e}")
        return False
    
    # Test prediction
    print("\n🧪 Testing prediction...")
    try:
        predictions = model.predict(scaled_data, verbose=0)
        print(f"✅ Prediction successful! Prediction shape: {predictions.shape}")
        
        # Calculate MSE
        mse_errors = np.mean((scaled_data - predictions) ** 2, axis=1)
        print(f"📊 MSE range: {mse_errors.min():.6f} to {mse_errors.max():.6f}")
        print(f"📊 Mean MSE: {mse_errors.mean():.6f}")
        
        # Check against threshold
        threshold = config['pretrained_model']['threshold']
        anomalies = np.sum(mse_errors > threshold)
        print(f"🎯 Threshold: {threshold:.6f}")
        print(f"🚨 Anomalies detected: {anomalies}/{len(mse_errors)} ({anomalies/len(mse_errors)*100:.1f}%)")
        
    except Exception as e:
        print(f"❌ Prediction failed: {e}")
        return False
    
    # Test with missing columns (should be filled with zeros)
    print("\n🧪 Testing with missing columns...")
    missing_data = {}
    for i, col in enumerate(config['pretrained_model']['trained_columns']):
        if i < 5:  # Only include first 5 columns
            missing_data[col] = np.random.normal(0, 1, 50)
    
    missing_df = pd.DataFrame(missing_data)
    print(f"📊 Missing data shape: {missing_df.shape}")
    print(f"📊 Missing data columns: {list(missing_df.columns)}")
    
    # Fill missing columns with zeros
    for col in config['pretrained_model']['trained_columns']:
        if col not in missing_df.columns:
            missing_df[col] = 0.0
    
    missing_df = missing_df[config['pretrained_model']['trained_columns']]  # Reorder columns
    print(f"📊 After filling missing columns: {missing_df.shape}")
    
    try:
        scaled_missing = scaler.transform(missing_df)
        predictions_missing = model.predict(scaled_missing, verbose=0)
        print(f"✅ Missing columns test successful!")
        
        mse_missing = np.mean((scaled_missing - predictions_missing) ** 2, axis=1)
        print(f"📊 Missing columns MSE range: {mse_missing.min():.6f} to {mse_missing.max():.6f}")
        
    except Exception as e:
        print(f"❌ Missing columns test failed: {e}")
        return False
    
    print("\n🎉 All tests passed! Pretrained model is working correctly.")
    return True

if __name__ == "__main__":
    success = test_pretrained_model()
    if success:
        print("\n✅ Pretrained model is ready for use!")
    else:
        print("\n❌ Pretrained model has issues!")
        sys.exit(1) 
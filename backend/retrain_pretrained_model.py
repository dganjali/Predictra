#!/usr/bin/env python3
"""
Script to retrain the pretrained model with the correct column structure
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
import tensorflow as tf
import joblib

def create_pretrained_data():
    """Create synthetic data for pretrained model with all sensor columns"""
    np.random.seed(42)
    n_samples = 3000  # More samples for better pretrained model
    
    # Create data with all sensor columns
    data = {}
    for i in range(12):  # 12 sensors total
        data[f'sensor_{i}_avg'] = np.random.normal(0, 1, n_samples)
    
    # Add some correlations and patterns to make it more realistic
    for i in range(0, 12, 2):
        # Make some sensors correlated
        data[f'sensor_{i}_avg'] = data[f'sensor_{i}_avg'] * 0.7 + data[f'sensor_{i+1}_avg'] * 0.3
    
    df = pd.DataFrame(data)
    return df

def build_pretrained_model(input_shape):
    """Build a pretrained model with the correct architecture"""
    model = Sequential([
        Dense(64, activation='relu', input_shape=(input_shape,)),
        Dense(32, activation='relu'),
        Dense(16, activation='relu'),
        Dense(8, activation='relu'),
        Dense(16, activation='relu'),
        Dense(32, activation='relu'),
        Dense(64, activation='relu'),
        Dense(input_shape, activation='linear')
    ])
    
    model.compile(
        optimizer='adam',
        loss='mean_squared_error',
        metrics=['mae']
    )
    
    return model

def train_pretrained_model():
    """Train the pretrained model with all columns"""
    print("🔄 Creating pretrained data...")
    df = create_pretrained_data()
    
    print(f"📊 Created data with shape: {df.shape}")
    print(f"📊 Columns: {list(df.columns)}")
    
    # Scale the data
    print("🔄 Scaling data...")
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df)
    
    # Build and train model
    print("🔄 Building pretrained model...")
    model = build_pretrained_model(scaled_data.shape[1])
    
    print(f"🏗️ Model parameters: {model.count_params():,}")
    
    # Train the model
    print("🔄 Training pretrained model...")
    history = model.fit(
        scaled_data, scaled_data,
        epochs=5,
        batch_size=64,
        validation_split=0.2,
        verbose=1
    )
    
    # Calculate threshold
    print("🔄 Calculating threshold...")
    predictions = model.predict(scaled_data, verbose=0)
    mse_errors = np.mean((scaled_data - predictions) ** 2, axis=1)
    threshold = np.percentile(mse_errors, 95)
    
    # Create pretrained config
    pretrained_config = {
        "pretrained_model": {
            "source_data": "synthetic_pretrained_data",
            "threshold": float(threshold),
            "mae_threshold": float(np.percentile(mse_errors, 95)),
            "mean_loss": float(np.mean(mse_errors)),
            "max_loss": float(np.max(mse_errors)),
            "min_loss": float(np.min(mse_errors)),
            "std_loss": float(np.std(mse_errors)),
            "percentile_90": float(np.percentile(mse_errors, 90)),
            "percentile_95": float(threshold),
            "percentile_99": float(np.percentile(mse_errors, 99)),
            "mae_stats": {
                "mean": float(np.mean(np.abs(scaled_data - predictions))),
                "percentile_95": float(np.percentile(np.abs(scaled_data - predictions), 95))
            },
            "model_info": {
                "dense_units": [64, 32, 16, 8, 16, 32, 64],
                "n_features": scaled_data.shape[1],
                "training_samples": len(scaled_data),
                "epochs_trained": 5,
                "batch_size": 64,
                "loss_function": "mse",
                "training_time": "pretrained_model_training"
            },
            "trained_columns": list(df.columns),
            "model_path": "user_models/user_test_user/machine_test_machine/model.h5",
            "scaler_path": "user_models/user_test_user/machine_test_machine/scaler.pkl",
            "rul_parameters": {
                "WINDOW_SIZE": 100,
                "DROPOUT_RATE": 0.2,
                "BATCH_SIZE": 32,
                "EPOCHS": 10,
                "PATIENCE": 5,
                "CLASSIFIER_THRESHOLD": 90,
                "RUL_THRESHOLD": 90
            }
        }
    }
    
    # Save the model and config
    print("🔄 Saving pretrained model and config...")
    
    # Create directory
    model_dir = os.path.join(os.path.dirname(__file__), 'models', 'user_models', 'user_test_user', 'machine_test_machine')
    os.makedirs(model_dir, exist_ok=True)
    
    # Save model
    model_path = os.path.join(model_dir, 'model.h5')
    model.save(model_path)
    print(f"✅ Model saved to: {model_path}")
    
    # Save scaler
    scaler_path = os.path.join(model_dir, 'scaler.pkl')
    joblib.dump(scaler, scaler_path)
    print(f"✅ Scaler saved to: {scaler_path}")
    
    # Save config
    config_path = os.path.join(os.path.dirname(__file__), 'models', 'pretrained_config.json')
    with open(config_path, 'w') as f:
        json.dump(pretrained_config, f, indent=2)
    print(f"✅ Config saved to: {config_path}")
    
    # Print summary
    print("\n🎉 Pretrained model training completed!")
    print(f"📊 Model parameters: {model.count_params():,}")
    print(f"📊 Training samples: {len(scaled_data)}")
    print(f"📊 Input features: {scaled_data.shape[1]}")
    print(f"🎯 Threshold: {threshold:.6f}")
    print(f"📁 Model saved to: {model_path}")
    print(f"📁 Scaler saved to: {scaler_path}")
    print(f"📁 Config saved to: {config_path}")
    
    return pretrained_config

if __name__ == "__main__":
    train_pretrained_model() 
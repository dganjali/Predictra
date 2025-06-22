#!/usr/bin/env python3
"""
Ultra-simple prediction system for trained models.
Works with the UltraSimpleTrainer system.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import load_model
from sklearn.preprocessing import StandardScaler
import joblib
from typing import List, Dict
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class UltraSimplePredictor:
    """Ultra-simple predictor for trained models."""
    
    def __init__(self, user_id: str, machine_id: str):
        self.user_id = user_id
        self.machine_id = machine_id
        self.model_dir = self._get_model_directory()
        self.model = None
        self.scaler = None
        self.threshold = None
        self.sensor_columns = None
        
    def _get_model_directory(self) -> str:
        """Get the model directory path."""
        base_dir = os.path.join(os.path.dirname(__file__), 'user_models')
        return os.path.join(base_dir, f'user_{self.user_id}', f'machine_{self.machine_id}')
    
    def load_model(self) -> bool:
        """Load the trained model and metadata."""
        try:
            # Check if model directory exists
            if not os.path.exists(self.model_dir):
                logger.error(f"Model directory not found: {self.model_dir}")
                return False
            
            # Load model
            model_path = os.path.join(self.model_dir, 'model.h5')
            if not os.path.exists(model_path):
                logger.error(f"Model file not found: {model_path}")
                return False
            
            self.model = load_model(model_path)
            logger.info(f"Loaded model from {model_path}")
            
            # Load scaler
            scaler_path = os.path.join(self.model_dir, 'scaler.pkl')
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                logger.info(f"Loaded scaler from {scaler_path}")
            
            # Load columns
            columns_path = os.path.join(self.model_dir, 'columns.json')
            if os.path.exists(columns_path):
                with open(columns_path, 'r') as f:
                    self.sensor_columns = json.load(f)
                logger.info(f"Loaded sensor columns: {self.sensor_columns}")
            
            # Load threshold
            stats_path = os.path.join(self.model_dir, 'training_stats.json')
            if os.path.exists(stats_path):
                with open(stats_path, 'r') as f:
                    stats = json.load(f)
                self.threshold = stats.get('threshold', 0.1)
                logger.info(f"Loaded threshold: {self.threshold}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            return False
    
    def preprocess_data(self, data: pd.DataFrame) -> np.ndarray:
        """Preprocess input data for prediction."""
        try:
            # Select only the sensor columns that exist in the data
            available_columns = [col for col in self.sensor_columns if col in data.columns]
            if not available_columns:
                raise ValueError(f"No sensor columns found in data. Available: {list(data.columns)}")
            
            # Select data
            df_sensors = data[available_columns].copy()
            
            # Handle missing values
            df_sensors = df_sensors.fillna(method='ffill').fillna(method='bfill')
            if df_sensors.empty:
                raise ValueError("No data remaining after handling missing values")
            
            # Scale the data
            if self.scaler:
                scaled_data = self.scaler.transform(df_sensors)
            else:
                scaled_data = df_sensors.values
            
            return scaled_data
            
        except Exception as e:
            logger.error(f"Error preprocessing data: {str(e)}")
            raise
    
    def predict(self, data: pd.DataFrame) -> Dict:
        """Make predictions on the input data."""
        try:
            if self.model is None:
                if not self.load_model():
                    raise ValueError("Failed to load model")
            
            # Preprocess data
            scaled_data = self.preprocess_data(data)
            
            # Make predictions
            predictions = self.model.predict(scaled_data, verbose=0)
            
            # Calculate reconstruction errors
            mse_errors = np.mean((scaled_data - predictions) ** 2, axis=1)
            
            # Determine anomalies
            anomalies = mse_errors > self.threshold
            
            # Calculate risk scores (normalized error)
            risk_scores = np.clip(mse_errors / self.threshold, 0, 10)
            
            # Prepare results
            results = {
                'predictions': predictions.tolist(),
                'errors': mse_errors.tolist(),
                'anomalies': anomalies.tolist(),
                'risk_scores': risk_scores.tolist(),
                'threshold': self.threshold,
                'num_anomalies': int(np.sum(anomalies)),
                'total_predictions': len(mse_errors),
                'anomaly_rate': float(np.mean(anomalies)),
                'mean_error': float(np.mean(mse_errors)),
                'max_error': float(np.max(mse_errors)),
                'min_error': float(np.min(mse_errors))
            }
            
            logger.info(f"Prediction completed: {results['num_anomalies']} anomalies found")
            return results
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            raise

def main():
    """Main entry point for prediction."""
    if len(sys.argv) != 4:
        print(json.dumps({
            "success": False,
            "message": f"Usage: {sys.argv[0]} <user_id> <machine_id> <csv_path>"
        }), flush=True)
        sys.exit(1)
    
    user_id = sys.argv[1]
    machine_id = sys.argv[2]
    csv_path = sys.argv[3]
    
    try:
        # Load data
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded CSV with {len(df)} rows")
        
        # Create predictor
        predictor = UltraSimplePredictor(user_id, machine_id)
        
        # Make prediction
        results = predictor.predict(df)
        
        # Send results
        output = {
            "success": True,
            "results": results
        }
        print(json.dumps(output), flush=True)
        
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        error_output = {
            "success": False,
            "message": str(e)
        }
        print(json.dumps(error_output), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main() 
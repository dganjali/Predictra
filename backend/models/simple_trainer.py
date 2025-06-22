#!/usr/bin/env python3
"""
Ultra-simple training system for predictive maintenance.
This is a completely new approach that's easy to debug and reliable.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
from sklearn.preprocessing import StandardScaler
import joblib
from typing import List, Dict, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class UltraSimpleTrainer:
    """Ultra-simple trainer that just works."""
    
    def __init__(self, user_id: str, machine_id: str):
        self.user_id = user_id
        self.machine_id = machine_id
        self.model_dir = self._create_model_directory()
        self.scaler = None
        self.model = None
        
    def _create_model_directory(self) -> str:
        """Create and return the model directory path."""
        base_dir = os.path.join(os.path.dirname(__file__), 'user_models')
        user_dir = os.path.join(base_dir, f'user_{self.user_id}')
        machine_dir = os.path.join(user_dir, f'machine_{self.machine_id}')
        
        os.makedirs(machine_dir, exist_ok=True)
        logger.info(f"Created model directory: {machine_dir}")
        return machine_dir
    
    def _send_progress(self, progress: int, message: str):
        """Send progress update to Node.js."""
        progress_data = {
            "type": "progress",
            "progress": progress,
            "message": message
        }
        print(json.dumps(progress_data), flush=True)
        logger.info(f"Progress {progress}%: {message}")
    
    def load_and_preprocess_data(self, csv_path: str, sensor_columns: List[str]) -> Tuple[np.ndarray, List[str]]:
        """Load and preprocess CSV data."""
        self._send_progress(10, "Loading training data...")
        
        try:
            # Read CSV file
            df = pd.read_csv(csv_path)
            logger.info(f"Loaded CSV with {len(df)} rows and {len(df.columns)} columns")
            
            # Find available sensor columns
            available_columns = [col for col in sensor_columns if col in df.columns]
            if not available_columns:
                raise ValueError(f"No sensor columns found in CSV. Available: {list(df.columns)}")
            
            logger.info(f"Using sensor columns: {available_columns}")
            
            # Select only the sensor columns
            df_sensors = df[available_columns].copy()
            
            # Handle missing values
            df_sensors = df_sensors.fillna(method='ffill').fillna(method='bfill')
            if df_sensors.empty:
                raise ValueError("No data remaining after handling missing values")
            
            # Limit data size for faster training
            if len(df_sensors) > 2000:
                df_sensors = df_sensors.sample(n=2000, random_state=42)
                logger.info(f"Sampled 2000 rows for faster training")
            
            # Scale the data
            self.scaler = StandardScaler()
            scaled_data = self.scaler.fit_transform(df_sensors)
            
            self._send_progress(30, f"Preprocessed {len(scaled_data)} samples")
            return scaled_data, available_columns
            
        except Exception as e:
            logger.error(f"Error loading data: {str(e)}")
            raise
    
    def build_simple_model(self, input_shape: int) -> Sequential:
        """Build a very simple neural network."""
        self._send_progress(50, "Building simple neural network...")
        
        model = Sequential([
            Dense(64, activation='relu', input_shape=(input_shape,)),
            Dropout(0.2),
            Dense(32, activation='relu'),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(input_shape, activation='linear')  # Output same as input for reconstruction
        ])
        
        model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        logger.info(f"Built simple model with {model.count_params()} parameters")
        return model
    
    def train_model(self, X_train: np.ndarray) -> Dict:
        """Train the model and return training metrics."""
        self._send_progress(60, "Training neural network...")
        
        # Build model
        self.model = self.build_simple_model(X_train.shape[1])
        
        # Train model with very simple settings
        history = self.model.fit(
            X_train, X_train,  # Autoencoder: input = target
            epochs=3,  # Very few epochs
            batch_size=32,
            validation_split=0.2,
            verbose=0
        )
        
        # Calculate training metrics
        train_loss = history.history['loss'][-1]
        val_loss = history.history['val_loss'][-1] if 'val_loss' in history.history else train_loss
        
        metrics = {
            'final_loss': train_loss,
            'final_val_loss': val_loss,
            'epochs_trained': len(history.history['loss']),
            'training_samples': len(X_train)
        }
        
        self._send_progress(80, f"Training completed. Final loss: {train_loss:.4f}")
        return metrics
    
    def calculate_threshold(self, X_train: np.ndarray) -> float:
        """Calculate anomaly threshold based on reconstruction error."""
        self._send_progress(85, "Calculating anomaly threshold...")
        
        # Get reconstruction errors
        predictions = self.model.predict(X_train, verbose=0)
        mse_errors = np.mean((X_train - predictions) ** 2, axis=1)
        
        # Calculate threshold as 95th percentile of errors
        threshold = np.percentile(mse_errors, 95)
        
        # Calculate additional statistics
        stats = {
            'threshold': float(threshold),
            'mean_error': float(np.mean(mse_errors)),
            'std_error': float(np.std(mse_errors)),
            'min_error': float(np.min(mse_errors)),
            'max_error': float(np.max(mse_errors)),
            'percentile_90': float(np.percentile(mse_errors, 90)),
            'percentile_95': float(threshold),
            'percentile_99': float(np.percentile(mse_errors, 99))
        }
        
        logger.info(f"Calculated threshold: {threshold:.6f}")
        return stats
    
    def save_model(self, sensor_columns: List[str], training_stats: Dict):
        """Save the trained model and metadata."""
        self._send_progress(90, "Saving model and metadata...")
        
        # Save model
        model_path = os.path.join(self.model_dir, 'model.h5')
        self.model.save(model_path)
        
        # Save scaler
        scaler_path = os.path.join(self.model_dir, 'scaler.pkl')
        joblib.dump(self.scaler, scaler_path)
        
        # Save column information
        columns_path = os.path.join(self.model_dir, 'columns.json')
        with open(columns_path, 'w') as f:
            json.dump(sensor_columns, f)
        
        # Save training statistics
        stats_path = os.path.join(self.model_dir, 'training_stats.json')
        with open(stats_path, 'w') as f:
            json.dump(training_stats, f)
        
        logger.info(f"Model saved to {self.model_dir}")
        self._send_progress(100, "Training completed successfully!")
    
    def train(self, csv_path: str, sensor_columns: List[str]) -> Dict:
        """Complete training pipeline."""
        try:
            # Load and preprocess data
            scaled_data, available_columns = self.load_and_preprocess_data(csv_path, sensor_columns)
            
            # Train model
            training_metrics = self.train_model(scaled_data)
            
            # Calculate threshold
            threshold_stats = self.calculate_threshold(scaled_data)
            
            # Combine all statistics
            final_stats = {
                **training_metrics,
                **threshold_stats,
                'sensor_columns': available_columns,
                'model_type': 'simple_autoencoder'
            }
            
            # Save everything
            self.save_model(available_columns, final_stats)
            
            return final_stats
            
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            error_data = {
                "type": "error",
                "message": str(e)
            }
            print(json.dumps(error_data), flush=True)
            raise

def main():
    """Main entry point for the training script."""
    try:
        if len(sys.argv) != 4:
            error_data = {
                "type": "error",
                "message": f"Usage: {sys.argv[0]} <user_id> <machine_id> <csv_path>"
            }
            print(json.dumps(error_data), flush=True)
            sys.exit(1)
        
        user_id = sys.argv[1]
        machine_id = sys.argv[2]
        csv_path = sys.argv[3]
        
        # Load sensor columns from environment or use defaults
        sensor_columns_str = os.environ.get('SENSOR_COLUMNS', '')
        if sensor_columns_str:
            try:
                sensor_columns = json.loads(sensor_columns_str)
            except json.JSONDecodeError:
                error_data = {
                    "type": "error",
                    "message": "Invalid SENSOR_COLUMNS environment variable"
                }
                print(json.dumps(error_data), flush=True)
                sys.exit(1)
        else:
            # Try to infer columns from CSV
            try:
                df = pd.read_csv(csv_path, nrows=1)
                sensor_columns = [col for col in df.columns if col.lower() not in ['timestamp', 'time', 'date', 'id']]
            except Exception as e:
                error_data = {
                    "type": "error",
                    "message": f"Could not read CSV file: {str(e)}"
                }
                print(json.dumps(error_data), flush=True)
                sys.exit(1)
        
        logger.info(f"Starting ultra-simple training for user {user_id}, machine {machine_id}")
        logger.info(f"Using sensor columns: {sensor_columns}")
        
        # Create trainer and start training
        trainer = UltraSimpleTrainer(user_id, machine_id)
        stats = trainer.train(csv_path, sensor_columns)
        
        # Send final success message
        success_data = {
            "type": "success",
            "stats": stats
        }
        print(json.dumps(success_data), flush=True)
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        error_data = {
            "type": "error",
            "message": str(e)
        }
        print(json.dumps(error_data), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main() 
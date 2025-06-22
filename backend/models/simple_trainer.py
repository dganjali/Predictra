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
import gc  # For garbage collection

# Configure TensorFlow to suppress warnings and limit memory usage
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # 0=all, 1=no INFO, 2=no INFO/WARN, 3=no INFO/WARN/ERROR
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'  # Disable GPU to avoid CUDA warnings

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
from sklearn.preprocessing import StandardScaler
import joblib
from typing import List, Dict, Tuple
import logging
import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Suppress TensorFlow logging
tf.get_logger().setLevel('ERROR')

# Configure TensorFlow to limit memory growth
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    except RuntimeError as e:
        print(f"GPU memory growth setting failed: {e}")

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
    
    def _send_detailed_message(self, message: str, message_type: str = "info"):
        """Send detailed message for display."""
        message_data = {
            "type": "message",
            "message": message,
            "message_type": message_type
        }
        print(json.dumps(message_data), flush=True)
        logger.info(f"[{message_type.upper()}] {message}")
    
    def _send_heartbeat(self):
        """Send a heartbeat to keep the connection alive."""
        heartbeat_data = {
            "type": "heartbeat",
            "timestamp": datetime.datetime.now().isoformat()
        }
        print(json.dumps(heartbeat_data), flush=True)
    
    def _cleanup_memory(self):
        """Clean up memory to prevent memory leaks."""
        gc.collect()
        tf.keras.backend.clear_session()
    
    def load_and_preprocess_data(self, csv_path: str, sensor_columns: List[str]) -> Tuple[np.ndarray, List[str]]:
        """Load and preprocess CSV data with memory optimization."""
        self._send_progress(5, "Initializing data processing...")
        self._send_detailed_message("Starting data preprocessing pipeline...", "info")
        
        try:
            # Read CSV file in chunks to prevent memory issues
            self._send_progress(10, "Loading training data...")
            self._send_detailed_message("Reading CSV file...", "info")
            
            # First, detect the delimiter by reading a small sample
            with open(csv_path, 'r') as f:
                first_line = f.readline().strip()
            
            # Detect delimiter (comma or semicolon)
            comma_count = first_line.count(',')
            semicolon_count = first_line.count(';')
            delimiter = ';' if semicolon_count > comma_count else ','
            
            self._send_detailed_message(f"Detected delimiter: '{delimiter}'", "info")
            
            # Read only first few rows to get column info
            df_sample = pd.read_csv(csv_path, nrows=100, delimiter=delimiter)
            self._send_detailed_message(f"CSV has {len(df_sample.columns)} columns", "info")
            
            # If no sensor columns provided, use all numeric columns
            if not sensor_columns:
                # Filter out non-sensor columns (metadata columns)
                exclude_patterns = ['time', 'timestamp', 'date', 'id', 'asset', 'train', 'test', 'status']
                available_columns = []
                
                for col in df_sample.columns:
                    col_lower = col.lower()
                    # Include if it's not a metadata column and contains sensor-related keywords
                    if not any(pattern in col_lower for pattern in exclude_patterns):
                        available_columns.append(col)
                
                self._send_detailed_message(f"Auto-detected {len(available_columns)} sensor columns", "info")
            else:
                # Use provided sensor columns
                available_columns = [col for col in sensor_columns if col in df_sample.columns]
            
            if not available_columns:
                # If still no columns, use all numeric columns
                numeric_columns = df_sample.select_dtypes(include=[np.number]).columns.tolist()
                available_columns = numeric_columns[:20]  # Limit to first 20 numeric columns
                self._send_detailed_message(f"Using first 20 numeric columns: {available_columns[:5]}...", "info")
            
            if not available_columns:
                raise ValueError(f"No suitable sensor columns found. Available columns: {list(df_sample.columns)}")
            
            self._send_detailed_message(f"Using sensor columns: {', '.join(available_columns[:5])}{'...' if len(available_columns) > 5 else ''}", "info")
            
            # Read full dataset with only needed columns
            self._send_progress(15, "Loading sensor data...")
            df_sensors = pd.read_csv(csv_path, usecols=available_columns, delimiter=delimiter)
            self._send_detailed_message(f"Loaded {len(df_sensors)} rows with {len(available_columns)} sensors", "info")
            
            # Handle missing values
            self._send_progress(20, "Processing sensor data...")
            missing_before = df_sensors.isnull().sum().sum()
            df_sensors = df_sensors.fillna(method='ffill').fillna(method='bfill')
            missing_after = df_sensors.isnull().sum().sum()
            
            if missing_before > 0:
                self._send_detailed_message(f"Handled {missing_before - missing_after} missing values", "warning")
            
            if df_sensors.empty:
                raise ValueError("No data remaining after handling missing values")
            
            # Limit data size for faster training and memory efficiency
            original_size = len(df_sensors)
            max_samples = 1500  # Reduced from 2000 to save memory
            if len(df_sensors) > max_samples:
                df_sensors = df_sensors.sample(n=max_samples, random_state=42)
                self._send_detailed_message(f"Sampled {len(df_sensors)} rows from {original_size} for faster training", "info")
            
            # Scale the data
            self._send_progress(25, "Scaling data...")
            self._send_detailed_message("Scaling data using StandardScaler...", "info")
            self.scaler = StandardScaler()
            scaled_data = self.scaler.fit_transform(df_sensors)
            
            # Clean up pandas dataframe to free memory
            del df_sensors
            gc.collect()
            
            self._send_progress(30, f"Preprocessed {len(scaled_data)} samples")
            self._send_detailed_message(f"Data preprocessing completed successfully", "success")
            return scaled_data, available_columns
            
        except Exception as e:
            self._send_detailed_message(f"Error loading data: {str(e)}", "error")
            logger.error(f"Error loading data: {str(e)}")
            raise
    
    def build_simple_model(self, input_shape: int) -> Sequential:
        """Build a very simple neural network with memory optimization."""
        self._send_progress(35, "Building neural network...")
        self._send_detailed_message("Creating autoencoder architecture...", "info")
        
        # Use smaller model to reduce memory usage
        model = Sequential([
            Dense(32, activation='relu', input_shape=(input_shape,)),  # Reduced from 64
            Dropout(0.1),  # Reduced dropout
            Dense(16, activation='relu'),  # Reduced from 32
            Dropout(0.1),
            Dense(8, activation='relu'),   # Reduced from 16
            Dense(input_shape, activation='linear')
        ])
        
        model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        param_count = model.count_params()
        self._send_progress(40, f"Built model with {param_count:,} parameters")
        self._send_detailed_message(f"Built autoencoder with {param_count:,} parameters", "success")
        logger.info(f"Built simple model with {param_count} parameters")
        return model
    
    def train_model(self, X_train: np.ndarray) -> Dict:
        """Train the model with memory optimization and better progress tracking."""
        self._send_progress(45, "Starting model training...")
        self._send_detailed_message("Initializing training process...", "info")
        
        # Build model
        self.model = self.build_simple_model(X_train.shape[1])
        
        # Train model with very simple settings
        epochs = 3
        batch_size = 16  # Reduced batch size to save memory
        self._send_detailed_message(f"Training for {epochs} epochs with batch size {batch_size}", "info")
        
        # Custom training loop for better progress tracking
        history = {'loss': [], 'val_loss': []}
        
        for epoch in range(epochs):
            self._send_progress(50 + (epoch * 15), f"Training epoch {epoch + 1}/{epochs}")
            self._send_detailed_message(f"Starting epoch {epoch + 1}/{epochs}...", "info")
            
            # Train for one epoch
            epoch_history = self.model.fit(
                X_train, X_train,
                epochs=1,
                batch_size=batch_size,
                validation_split=0.2,
                verbose=0
            )
            
            # Record metrics
            history['loss'].extend(epoch_history.history['loss'])
            history['val_loss'].extend(epoch_history.history.get('val_loss', epoch_history.history['loss']))
            
            # Send epoch completion message
            current_loss = history['loss'][-1]
            val_loss = history['val_loss'][-1]
            self._send_detailed_message(f"Epoch {epoch + 1}/{epochs} completed - Loss: {current_loss:.6f}, Val Loss: {val_loss:.6f}", "success")
            
            # Send heartbeat to keep connection alive
            self._send_heartbeat()
            
            # Clean up memory after each epoch
            self._cleanup_memory()
        
        # Calculate training metrics
        train_loss = history['loss'][-1]
        val_loss = history['val_loss'][-1]
        
        metrics = {
            'final_loss': train_loss,
            'final_val_loss': val_loss,
            'epochs_trained': len(history['loss']),
            'training_samples': len(X_train)
        }
        
        self._send_progress(80, f"Training completed. Final loss: {train_loss:.4f}")
        self._send_detailed_message(f"Training completed! Final loss: {train_loss:.6f}, Validation loss: {val_loss:.6f}", "success")
        return metrics
    
    def calculate_threshold(self, X_train: np.ndarray) -> Dict:
        """Calculate anomaly threshold based on reconstruction error."""
        self._send_progress(85, "Calculating anomaly threshold...")
        self._send_detailed_message("Computing reconstruction errors...", "info")
        
        # Get reconstruction errors in batches to save memory
        batch_size = 100
        mse_errors = []
        
        for i in range(0, len(X_train), batch_size):
            batch = X_train[i:i+batch_size]
            predictions = self.model.predict(batch, verbose=0)
            batch_errors = np.mean((batch - predictions) ** 2, axis=1)
            mse_errors.extend(batch_errors)
            
            # Send heartbeat during long computation
            if i % 500 == 0:
                self._send_heartbeat()
        
        mse_errors = np.array(mse_errors)
        
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
        
        self._send_detailed_message(f"Anomaly threshold calculated: {threshold:.6f} (95th percentile)", "success")
        self._send_detailed_message(f"Error statistics - Mean: {stats['mean_error']:.6f}, Std: {stats['std_error']:.6f}", "info")
        logger.info(f"Calculated threshold: {threshold:.6f}")
        return stats
    
    def save_model(self, sensor_columns: List[str], training_stats: Dict):
        """Save the trained model and metadata."""
        self._send_progress(90, "Saving model and metadata...")
        self._send_detailed_message("Saving trained model...", "info")
        
        try:
            # Save model
            model_path = os.path.join(self.model_dir, 'model.h5')
            self.model.save(model_path)
            self._send_detailed_message("Model saved successfully", "success")
            
            # Save scaler
            scaler_path = os.path.join(self.model_dir, 'scaler.pkl')
            joblib.dump(self.scaler, scaler_path)
            self._send_detailed_message("Data scaler saved", "success")
            
            # Save column information
            columns_path = os.path.join(self.model_dir, 'columns.json')
            with open(columns_path, 'w') as f:
                json.dump(sensor_columns, f)
            self._send_detailed_message("Column configuration saved", "success")
            
            # Save training statistics
            stats_path = os.path.join(self.model_dir, 'training_stats.json')
            with open(stats_path, 'w') as f:
                json.dump(training_stats, f)
            self._send_detailed_message("Training statistics saved", "success")
            
            logger.info(f"Model saved to {self.model_dir}")
            self._send_progress(100, "Training completed successfully!")
            self._send_detailed_message("All files saved successfully!", "success")
            
        except Exception as e:
            self._send_detailed_message(f"Error saving model: {str(e)}", "error")
            raise
    
    def train(self, csv_path: str, sensor_columns: List[str]) -> Dict:
        """Complete training pipeline with memory optimization."""
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
            
            # Final cleanup
            self._cleanup_memory()
            
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
        
        # Load sensor columns from environment or use auto-detection
        sensor_columns_str = os.environ.get('SENSOR_COLUMNS', '')
        if sensor_columns_str:
            try:
                sensor_columns = json.loads(sensor_columns_str)
                logger.info(f"Using provided sensor columns: {sensor_columns}")
            except json.JSONDecodeError:
                logger.warning("Invalid SENSOR_COLUMNS environment variable, will auto-detect")
                sensor_columns = []
        else:
            logger.info("No sensor columns provided, will auto-detect from CSV")
            sensor_columns = []
        
        logger.info(f"Starting ultra-simple training for user {user_id}, machine {machine_id}")
        
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
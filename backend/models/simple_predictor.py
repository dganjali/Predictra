#!/usr/bin/env python3
"""
Simple predictor script that uses stored machine parameters for prediction
Optimized for speed and timeout prevention
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import load_model
import tensorflow as tf
import joblib
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SimplePredictor:
    def __init__(self, user_id: str, machine_id: str):
        self.user_id = user_id
        self.machine_id = machine_id
        self.model_dir = self._get_model_directory()
        self.model = None
        self.scaler = None
        self.threshold = None
        self.trained_columns = []
        
    def _get_model_directory(self) -> str:
        """Get the model directory for this user and machine."""
        # Use an environment variable for the base storage path for better flexibility in deployment
        base_path = os.getenv('MODEL_STORAGE_PATH', os.path.dirname(__file__))
        
        # Ensure the path is absolute
        if not os.path.isabs(base_path):
            base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), base_path))

        return os.path.join(
            base_path,
            'user_models',
            f'user_{self.user_id}',
            f'machine_{self.machine_id}'
        )
    
    def load_model_and_params(self):
        """Load the trained model, scaler, and parameters."""
        try:
            logger.info(f"🔍 Looking for model files in: {self.model_dir}")
            
            # Check if model directory exists
            if not os.path.exists(self.model_dir):
                logger.error(f"❌ Model directory does not exist: {self.model_dir}")
                return False
            
            # List files in the model directory for debugging
            try:
                files_in_dir = os.listdir(self.model_dir)
                logger.info(f"📁 Files in model directory: {files_in_dir}")
            except Exception as e:
                logger.error(f"❌ Cannot list files in model directory: {e}")
                return False
            
            # Load model
            model_path = os.path.join(self.model_dir, 'model.h5')
            if os.path.exists(model_path):
                self.model = load_model(model_path)
                logger.info(f"✅ Loaded model from {model_path}")
            else:
                logger.error(f"❌ Model file not found: {model_path}")
                return False
            
            # Load scaler
            scaler_path = os.path.join(self.model_dir, 'scaler.pkl')
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                logger.info(f"✅ Loaded scaler from {scaler_path}")
            else:
                logger.error(f"❌ Scaler file not found: {scaler_path}")
                return False
            
            # Load columns
            columns_path = os.path.join(self.model_dir, 'columns.json')
            if os.path.exists(columns_path):
                with open(columns_path, 'r') as f:
                    self.trained_columns = json.load(f)
                logger.info(f"✅ Loaded columns from {columns_path}: {self.trained_columns}")
            else:
                logger.error(f"❌ Columns file not found: {columns_path}")
                return False
            
            # Load threshold
            threshold_path = os.path.join(self.model_dir, 'threshold.json')
            if os.path.exists(threshold_path):
                with open(threshold_path, 'r') as f:
                    threshold_data = json.load(f)
                    self.threshold = threshold_data.get('threshold', 1.0)
                logger.info(f"✅ Loaded threshold: {self.threshold}")
            else:
                logger.error(f"❌ Threshold file not found: {threshold_path}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error loading model and parameters: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return False
    
    def load_and_preprocess_data(self, csv_path: str) -> np.ndarray:
        """Load and preprocess the prediction data with speed optimizations."""
        try:
            logger.info(f"📊 Loading prediction data from {csv_path}")
            
            # Check file size and apply row limiting for speed (prevent timeouts)
            file_size = os.path.getsize(csv_path)
            max_rows = None
            
            if file_size > 2 * 1024 * 1024:  # 2MB file
                max_rows = 500  # Limit to 500 rows for very large files
                logger.info(f"⚡ Very large file detected ({file_size/1024/1024:.2f}MB), limiting to {max_rows} rows for speed")
            elif file_size > 1024 * 1024:  # 1MB file
                max_rows = 1000  # Limit to 1000 rows for large files
                logger.info(f"⚡ Large file detected ({file_size/1024/1024:.2f}MB), limiting to {max_rows} rows for speed")
            elif file_size > 512 * 1024:  # 512KB file
                max_rows = 2000  # Limit to 2000 rows for medium files
                logger.info(f"⚡ Medium file detected ({file_size/1024:.0f}KB), limiting to {max_rows} rows for speed")
            else:
                logger.info(f"📦 Small file detected ({file_size/1024:.0f}KB), processing all rows")
            
            # Detect delimiter
            with open(csv_path, 'r') as f:
                first_line = f.readline().strip()
            
            comma_count = first_line.count(',')
            semicolon_count = first_line.count(';')
            delimiter = ',' if comma_count > semicolon_count else ';'
            
            logger.info(f"🔍 Detected delimiter: '{delimiter}'")
            
            # Read CSV with optional row limit for speed
            df = pd.read_csv(csv_path, delimiter=delimiter, nrows=max_rows)
            logger.info(f"📊 Loaded {len(df)} rows with {len(df.columns)} columns")
            
            # Check if we have the required columns
            available_columns = [col for col in self.trained_columns if col in df.columns]
            missing_columns = [col for col in self.trained_columns if col not in df.columns]
            
            if missing_columns:
                logger.warning(f"⚠️ Missing columns: {missing_columns}")
                logger.info(f"🔄 Filling missing columns with zeros")
                
                # Fill missing columns with zeros
                for col in missing_columns:
                    df[col] = 0.0
            
            # Select only the trained columns in the correct order
            df_selected = df[self.trained_columns]
            logger.info(f"📊 Selected {len(df_selected.columns)} columns for prediction")
            
            # Handle missing values efficiently
            missing_before = df_selected.isnull().sum().sum()
            if missing_before > 0:
                logger.warning(f"⚠️ Found {missing_before} missing values, filling with forward/backward fill")
                # Use more efficient pandas methods
                df_selected = df_selected.fillna(method='ffill').fillna(method='bfill')
                # If still NaN, fill with zeros
                df_selected = df_selected.fillna(0)
            
            # Scale the data
            logger.info("🔄 Scaling data using stored scaler")
            scaled_data = self.scaler.transform(df_selected)
            logger.info(f"✅ Data scaled successfully: {scaled_data.shape}")
            
            return scaled_data
            
        except Exception as e:
            logger.error(f"❌ Error loading and preprocessing data: {e}")
            raise
    
    def predict(self, scaled_data: np.ndarray) -> dict:
        """Make predictions on the scaled data with batch processing for efficiency."""
        try:
            logger.info(f"🔮 Making predictions on {len(scaled_data)} samples")
            
            # Use batch processing for large datasets to prevent memory issues
            batch_size = min(256, len(scaled_data))  # Adaptive batch size
            if len(scaled_data) > batch_size:
                logger.info(f"📦 Using batch processing with batch size: {batch_size}")
                
                # Process in batches
                predictions = []
                for i in range(0, len(scaled_data), batch_size):
                    batch = scaled_data[i:i+batch_size]
                    batch_pred = self.model.predict(batch, verbose=0)
                    predictions.append(batch_pred)
                
                predictions = np.concatenate(predictions, axis=0)
            else:
                # Process all at once for small datasets
                predictions = self.model.predict(scaled_data, verbose=0)
            
            logger.info(f"✅ Model predictions completed: {predictions.shape}")
            
            # Calculate reconstruction errors
            mse_errors = np.mean((scaled_data - predictions) ** 2, axis=1)
            logger.info(f"📊 MSE errors calculated: min={mse_errors.min():.6f}, max={mse_errors.max():.6f}")
            
            # Determine anomalies
            anomalies = mse_errors > self.threshold
            anomaly_count = np.sum(anomalies)
            anomaly_percentage = (anomaly_count / len(anomalies)) * 100
            
            logger.info(f"🚨 Anomalies detected: {anomaly_count}/{len(anomalies)} ({anomaly_percentage:.1f}%)")
            
            # Calculate overall anomaly score (average MSE)
            overall_anomaly_score = np.mean(mse_errors)
            is_anomaly = overall_anomaly_score > self.threshold
            
            # Calculate confidence based on error distribution
            confidence = max(0.5, min(1.0, 1.0 - (np.std(mse_errors) / np.mean(mse_errors)) if np.mean(mse_errors) > 0 else 0.5))
            
            prediction_result = {
                'anomaly_score': float(overall_anomaly_score),
                'is_anomaly': bool(is_anomaly),
                'confidence': float(confidence),
                'processed_samples': len(scaled_data),
                'anomaly_count': int(anomaly_count),
                'anomaly_percentage': float(anomaly_percentage),
                'threshold_used': float(self.threshold),
                'error_stats': {
                    'mean': float(np.mean(mse_errors)),
                    'std': float(np.std(mse_errors)),
                    'min': float(np.min(mse_errors)),
                    'max': float(np.max(mse_errors))
                },
                'model_info': {
                    'model_type': 'simple_autoencoder',
                    'input_features': scaled_data.shape[1],
                    'trained_columns': self.trained_columns
                }
            }
            
            logger.info(f"✅ Prediction completed successfully")
            logger.info(f"📊 Overall anomaly score: {overall_anomaly_score:.6f}")
            logger.info(f"🚨 Is anomaly: {is_anomaly}")
            logger.info(f"🎯 Confidence: {confidence:.3f}")
            
            return prediction_result
            
        except Exception as e:
            logger.error(f"❌ Error making predictions: {e}")
            raise

def main():
    """Main function for prediction."""
    start_time = datetime.now()
    logger.info("=" * 60)
    logger.info("🔮 SIMPLE PREDICTOR STARTED (OPTIMIZED)")
    logger.info("=" * 60)
    logger.info(f"⏰ Start time: {start_time}")
    
    try:
        # Parse command line arguments
        if len(sys.argv) != 4:
            logger.error(f"❌ Invalid number of arguments. Expected 3, got {len(sys.argv) - 1}")
            logger.error(f"❌ Usage: python simple_predictor.py <user_id> <machine_id> <csv_path>")
            sys.exit(1)
        
        user_id = sys.argv[1]
        machine_id = sys.argv[2]
        csv_path = sys.argv[3]
        
        logger.info(f"📋 Command line arguments:")
        logger.info(f"   - User ID: {user_id}")
        logger.info(f"   - Machine ID: {machine_id}")
        logger.info(f"   - CSV path: {csv_path}")
        
        # Validate inputs
        if not os.path.exists(csv_path):
            logger.error(f"❌ CSV file not found: {csv_path}")
            sys.exit(1)
        
        if not user_id or not machine_id:
            logger.error(f"❌ Invalid user_id or machine_id")
            sys.exit(1)
        
        # Create predictor and run prediction
        logger.info("🏗️ Creating SimplePredictor instance...")
        predictor = SimplePredictor(user_id, machine_id)
        
        # Load model and parameters
        logger.info("📂 Loading model and parameters...")
        if not predictor.load_model_and_params():
            logger.error("❌ Failed to load model and parameters")
            sys.exit(1)
        
        # Load and preprocess data
        logger.info("📊 Loading and preprocessing data...")
        scaled_data = predictor.load_and_preprocess_data(csv_path)
        
        # Make predictions
        logger.info("🔮 Making predictions...")
        prediction_result = predictor.predict(scaled_data)
        
        # Log final success
        end_time = datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        
        logger.info("=" * 60)
        logger.info("✅ PREDICTION COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        logger.info(f"⏱️ Total execution time: {total_duration:.2f} seconds")
        logger.info(f"📊 Samples processed: {prediction_result['processed_samples']}")
        logger.info(f"🎯 Anomaly score: {prediction_result['anomaly_score']:.6f}")
        logger.info(f"🚨 Is anomaly: {prediction_result['is_anomaly']}")
        
        # Send success message to Node.js
        success_data = {
            "type": "success",
            "predictions": prediction_result,
            "timestamp": datetime.now().isoformat()
        }
        print(f"SUCCESS:{json.dumps(success_data)}")
        
        logger.info("🎉 Exiting successfully")
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"❌ Fatal error in main function: {e}")
        logger.error(f"❌ Error details: {str(e)}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        
        # Send error message to Node.js
        error_data = {
            "type": "error",
            "message": str(e),
            "timestamp": datetime.now().isoformat()
        }
        print(f"ERROR:{json.dumps(error_data)}")
        
        logger.error("💥 Exiting with error")
        sys.exit(1)

if __name__ == "__main__":
    main()
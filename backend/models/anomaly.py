"""
This module provides a robust pipeline to train an LSTM autoencoder for anomaly detection.
It is designed to be called from a Node.js process and communicates its progress
and final status (success or failure) via structured JSON printed to stdout.
"""
import os
import json
import sys
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed
from sklearn.preprocessing import StandardScaler
import joblib
from typing import List, Dict

# --- Custom Callback for Keras ---
class ProgressCallback(tf.keras.callbacks.Callback):
    """A Keras callback to print structured JSON progress for each epoch."""
    def __init__(self, total_epochs: int):
        super().__init__()
        self.total_epochs = total_epochs
        self.training_start_progress = 50  # Progress percentage when training starts
        self.training_end_progress = 90    # Progress percentage when training ends

    def on_epoch_end(self, epoch, logs=None):
        # Calculate the progress within the training phase (50% to 90%)
        progress_in_phase = ((epoch + 1) / self.total_epochs)
        current_overall_progress = self.training_start_progress + (progress_in_phase * (self.training_end_progress - self.training_start_progress))
        
        message = f"Epoch {epoch + 1}/{self.total_epochs} completed."
        print(json.dumps({
            "type": "progress",
            "progress": int(current_overall_progress),
            "message": message
        }), flush=True)

# --- Configuration ---
BASE_MODELS_DIR = os.path.join(os.path.dirname(__file__), 'user_models')
SEQUENCE_LEN = 5  # Reduced from 10 for faster training
N_EPOCHS = 3      # Reduced from 5 for faster training
BATCH_SIZE = 64   # Increased from 32 for better GPU utilization
MAX_FEATURES = 10 # Limit number of features to prevent overly complex models

# Configure TensorFlow for better performance
tf.config.threading.set_intra_op_parallelism_threads(0)  # Use all available cores
tf.config.threading.set_inter_op_parallelism_threads(0)  # Use all available cores

# Enable mixed precision for faster training if GPU is available
if tf.config.list_physical_devices('GPU'):
    print("GPU detected, enabling mixed precision training", file=sys.stderr)
    tf.keras.mixed_precision.set_global_policy('mixed_float16')
else:
    print("No GPU detected, using CPU optimization", file=sys.stderr)

def get_model_paths(user_id: str, machine_id: str) -> Dict[str, str]:
    """Generates the full file paths for a machine's model and related artifacts."""
    machine_dir = os.path.join(BASE_MODELS_DIR, f"user_{user_id}", f"machine_{machine_id}")
    try:
        os.makedirs(machine_dir, exist_ok=True)
        print(f"Created directory: {machine_dir}", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"Error creating directory {machine_dir}: {str(e)}", file=sys.stderr, flush=True)
        # Try to create the parent directory structure
        parent_dir = os.path.join(BASE_MODELS_DIR, f"user_{user_id}")
        os.makedirs(parent_dir, exist_ok=True)
        # Then try again with the machine directory
        os.makedirs(machine_dir, exist_ok=True)
        
    return {
        "model_file": os.path.join(machine_dir, 'model.h5'),
        "scaler_file": os.path.join(machine_dir, 'scaler.pkl'),
        "columns_file": os.path.join(machine_dir, 'columns.json'),
        "threshold_file": os.path.join(machine_dir, 'threshold.json'),
    }

def create_sequences(data, sequence_len=SEQUENCE_LEN):
    """Creates time-series sequences from a numpy array using vectorized operations."""
    if len(data) < sequence_len:
        raise ValueError(f"Data length {len(data)} is less than sequence length {sequence_len}")
    
    # Use numpy's advanced indexing for faster sequence creation
    n_sequences = len(data) - sequence_len + 1
    sequences = np.lib.stride_tricks.sliding_window_view(data, (sequence_len, data.shape[1]))
    return sequences.squeeze(axis=1)

def run_training_pipeline(user_id: str, machine_id: str, data_path: str, sensor_columns: List[str], row_limit: int = None):
    """
    Executes the end-to-end training pipeline. It handles its own errors and
    communicates all progress and outcomes via stdout as JSON strings.
    """
    paths = get_model_paths(user_id, machine_id)
    try:
        # STAGE 1: Data Loading & Validation
        progress_msg = "Loading data..."
        if row_limit:
            progress_msg = f"Loading first {row_limit} rows..."
        print(json.dumps({"type": "progress", "progress": 10, "message": progress_msg}), flush=True)
        
        # Determine the CSV delimiter and ensure the timestamp column is loaded
        with open(data_path, 'r', errors='ignore') as f:
            delimiter = ';' if f.readline().count(';') > 1 else ','
        
        # First load the file to see all available columns
        df_all = pd.read_csv(data_path, sep=delimiter, nrows=1)
        available_cols = df_all.columns.tolist()
        
        # Check which sensor columns are actually in the CSV file
        available_sensors = [col for col in sensor_columns if col in available_cols]
        
        if 'time_stamp' not in available_cols:
            # Try to find a timestamp column
            timestamp_synonyms = ['timestamp', 'timestamps', 'time_stamp', 'date']
            for col in available_cols:
                if col.lower() in [ts.lower() for ts in timestamp_synonyms]:
                    # Rename this column to time_stamp in the next read
                    ts_col = col
                    break
            else:
                raise ValueError("No timestamp column found in CSV file.")
        else:
            ts_col = 'time_stamp'
            
        # Load the full data with only the columns we know exist
        required_cols = list(set(available_sensors + [ts_col]))
        df = pd.read_csv(data_path, sep=delimiter, usecols=required_cols, 
                         parse_dates=[ts_col], nrows=row_limit)
        
        # Rename timestamp column if needed
        if ts_col != 'time_stamp':
            df.rename(columns={ts_col: 'time_stamp'}, inplace=True)
        
        # Set the index
        df.set_index('time_stamp', inplace=True)

        # STAGE 2: Data Preprocessing
        print(json.dumps({"type": "progress", "progress": 25, "message": "Preprocessing data..."}), flush=True)
        
        # Only use the sensors that were actually found in the CSV
        # Limit features to prevent overly complex models
        available_sensors_limited = available_sensors[:MAX_FEATURES] if len(available_sensors) > MAX_FEATURES else available_sensors
        if len(available_sensors) > MAX_FEATURES:
            print(f"Warning: Limited to {MAX_FEATURES} features out of {len(available_sensors)} available", file=sys.stderr)
        
        df_features = df[sorted(available_sensors_limited)] # Sort for consistent column order
        df_features.dropna(inplace=True)
        if df_features.empty:
            raise ValueError("No data remains after removing rows with null values.")
        
        # Downsample data if too large for faster training
        max_training_rows = 3000  # Further reduced for faster training
        if len(df_features) > max_training_rows:
            # Use smart sampling: take recent data + some historical samples
            recent_portion = 0.7  # 70% from recent data
            recent_count = int(max_training_rows * recent_portion)
            historical_count = max_training_rows - recent_count
            
            # Take most recent data
            recent_data = df_features.tail(recent_count)
            
            # Sample historical data evenly
            if len(df_features) > recent_count:
                historical_data = df_features.head(len(df_features) - recent_count)
                if len(historical_data) > historical_count:
                    step = len(historical_data) // historical_count
                    historical_sampled = historical_data.iloc[::step][:historical_count]
                else:
                    historical_sampled = historical_data
                
                # Combine and sort by index
                df_features = pd.concat([historical_sampled, recent_data]).sort_index()
            else:
                df_features = recent_data
                
            print(f"Smart sampling: reduced to {len(df_features)} rows for faster training", file=sys.stderr)
        
        with open(paths['columns_file'], 'w') as f:
            json.dump(df_features.columns.tolist(), f)

        scaler = StandardScaler().fit(df_features)
        joblib.dump(scaler, paths['scaler_file'])
        
        X_train = create_sequences(scaler.transform(df_features))
        print(f"Created {X_train.shape[0]} training sequences with shape {X_train.shape}", file=sys.stderr)
        
        if X_train.shape[0] < 1:
            raise ValueError(f"Not enough data for training. At least {SEQUENCE_LEN} rows are required.")

        # Initialize model parameters for later use
        n_features = X_train.shape[2]
        lstm_units = min(32, max(16, n_features * 2))
        batch_size = BATCH_SIZE

        # STAGE 3: Model Training
        print(json.dumps({"type": "progress", "progress": 50, "message": "Training optimized model..."}), flush=True)
        
        try:
            # Adjust batch size based on data size for optimal performance
            if X_train.shape[0] < batch_size:
                batch_size = max(8, X_train.shape[0] // 4)
                print(f"Adjusting batch size to {batch_size} due to small dataset", file=sys.stderr)
            
            print(f"Training data shape: {X_train.shape}, LSTM units: {lstm_units}, batch size: {batch_size}", file=sys.stderr)
            
            # Create optimized model with dropout for regularization
            model = Sequential([
                LSTM(lstm_units, activation='tanh', input_shape=(X_train.shape[1], X_train.shape[2]), 
                     return_sequences=False, dropout=0.1, recurrent_dropout=0.1),
                RepeatVector(X_train.shape[1]),
                LSTM(lstm_units, activation='tanh', return_sequences=True, dropout=0.1, recurrent_dropout=0.1),
                TimeDistributed(Dense(X_train.shape[2], activation='linear'))
            ])
            
            # Use optimized optimizer with custom learning rate
            optimizer = tf.keras.optimizers.Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999)
            model.compile(optimizer=optimizer, loss='mse', metrics=['mae'])
            
            # Enhanced callbacks for better training control
            callbacks = [
                ProgressCallback(total_epochs=N_EPOCHS),
                tf.keras.callbacks.EarlyStopping(
                    monitor='loss', 
                    patience=2, 
                    restore_best_weights=True, 
                    verbose=0
                ),
                tf.keras.callbacks.ReduceLROnPlateau(
                    monitor='loss', 
                    factor=0.5, 
                    patience=1, 
                    min_lr=1e-6,
                    verbose=0
                )
            ]
            
            # Train the model with validation split for better monitoring
            history = model.fit(
                X_train, X_train, 
                epochs=N_EPOCHS, 
                batch_size=batch_size,
                validation_split=0.1,  # Use 10% for validation
                verbose=0, 
                callbacks=callbacks, 
                shuffle=True
            )
            
            # Save model with error handling
            try:
                model.save(paths['model_file'])
                print(f"Model saved successfully to {paths['model_file']}", file=sys.stderr)
            except Exception as save_error:
                print(f"Primary save failed, trying alternative: {save_error}", file=sys.stderr)
                model.save_weights(paths['model_file'].replace('.h5', '_weights.h5'))
                model_config = model.get_config()
                with open(paths['model_file'].replace('.h5', '_config.json'), 'w') as f:
                    json.dump(model_config, f)
                print("Saved model using weights + config method", file=sys.stderr)
                
        except Exception as training_error:
            print(f"Training error: {str(training_error)}", file=sys.stderr)
            raise

        # STAGE 4: Threshold Calculation
        print(json.dumps({"type": "progress", "progress": 90, "message": "Calculating anomaly threshold..."}), flush=True)
        
        try:
            # Use optimized batch prediction for faster threshold calculation
            batch_size_pred = min(256, X_train.shape[0])  # Smaller batches for memory efficiency
            X_train_pred = model.predict(X_train, batch_size=batch_size_pred, verbose=0)
                
            # Calculate loss using MSE to match the training loss
            train_mse_loss = np.mean(np.square(X_train_pred - X_train), axis=(1, 2))
            
            # Also calculate MAE for compatibility
            train_mae_loss = np.mean(np.abs(X_train_pred - X_train), axis=(1, 2))
            
            # Ensure we have valid thresholds (not NaN or Inf)
            if np.isnan(train_mse_loss).any() or np.isinf(train_mse_loss).any():
                print("Warning: NaN or Inf values in MSE loss, using filtering", file=sys.stderr)
                valid_indices = ~np.isnan(train_mse_loss) & ~np.isinf(train_mse_loss)
                train_mse_loss = train_mse_loss[valid_indices]
                train_mae_loss = train_mae_loss[valid_indices]
                
            if len(train_mse_loss) == 0:
                raise ValueError("All loss values are invalid (NaN or Inf)")
                
            # Set threshold as 95th percentile for better balance
            mse_threshold = float(np.percentile(train_mse_loss, 95))
            mae_threshold = float(np.percentile(train_mae_loss, 95))
            
            print(f"Calculated thresholds - MSE: {mse_threshold:.6f}, MAE: {mae_threshold:.6f}", file=sys.stderr)
                
            if len(train_mse_loss) == 0:
                raise ValueError("All loss values are invalid (NaN or Inf)")
                
            # Set threshold as 95th percentile for better balance
            mse_threshold = float(np.percentile(train_mse_loss, 95))
            mae_threshold = float(np.percentile(train_mae_loss, 95))
            
            print(f"Calculated thresholds - MSE: {mse_threshold:.6f}, MAE: {mae_threshold:.6f}", file=sys.stderr)
            
            # Save comprehensive threshold data and model metadata
            threshold_data = {
                'threshold': mse_threshold,  # Primary threshold using MSE
                'mae_threshold': mae_threshold,  # Alternative threshold using MAE
                'mean_loss': float(np.mean(train_mse_loss)),
                'max_loss': float(np.max(train_mse_loss)),
                'min_loss': float(np.min(train_mse_loss)),
                'std_loss': float(np.std(train_mse_loss)),
                'percentile_90': float(np.percentile(train_mse_loss, 90)),
                'percentile_95': float(np.percentile(train_mse_loss, 95)),
                'percentile_99': float(np.percentile(train_mse_loss, 99)),
                'mae_stats': {
                    'mean': float(np.mean(train_mae_loss)),
                    'percentile_95': float(np.percentile(train_mae_loss, 95))
                },
                'model_info': {
                    'lstm_units': lstm_units,
                    'sequence_length': SEQUENCE_LEN,
                    'n_features': X_train.shape[2],
                    'training_samples': X_train.shape[0],
                    'epochs_trained': N_EPOCHS,
                    'batch_size': batch_size,
                    'loss_function': 'mse',
                    'training_time': 'optimized_fast_training'
                }
            }
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(paths['threshold_file']), exist_ok=True)
            
            with open(paths['threshold_file'], 'w') as f:
                json.dump(threshold_data, f, indent=2)
            
            print(f"✅ Threshold data saved to {paths['threshold_file']}", file=sys.stderr)
            print(f"🎯 Training completed: {X_train.shape[0]} samples, MSE threshold: {mse_threshold:.6f}", file=sys.stderr)
            
            # STAGE 5: Success
            print(json.dumps({"type": "progress", "progress": 100, "message": "Training completed successfully!"}), flush=True)
            print(json.dumps({"success": True, "message": "Training completed successfully."}), flush=True)
            
        except Exception as e:
            print(f"Error in threshold calculation: {str(e)}", file=sys.stderr)
            raise

    except Exception as e:
        # Catch any and all exceptions and report them cleanly as a JSON error.
        print(json.dumps({"success": False, "error": f"A critical error occurred: {str(e)}"}), flush=True)
    
def run_prediction(user_id: str, machine_id: str, sensor_data_path: str):
    """
    Runs prediction on a single data point using a trained model.
    """
    paths = get_model_paths(user_id, machine_id)
    
    try:
        # Check if all required files exist
        if not os.path.exists(paths['model_file']):
            raise ValueError("Trained model not found. Please train the model first.")
        if not os.path.exists(paths['scaler_file']):
            raise ValueError("Scaler not found. Please train the model first.")
        if not os.path.exists(paths['columns_file']):
            raise ValueError("Columns configuration not found. Please train the model first.")
        if not os.path.exists(paths['threshold_file']):
            raise ValueError("Threshold configuration not found. Please train the model first.")
        
        # Load the sensor data
        with open(sensor_data_path, 'r') as f:
            sensor_values = json.load(f)
        
        # Load model components
        model = tf.keras.models.load_model(paths['model_file'])
        scaler = joblib.load(paths['scaler_file'])
        
        with open(paths['columns_file'], 'r') as f:
            expected_columns = json.load(f)
        
        with open(paths['threshold_file'], 'r') as f:
            threshold_data = json.load(f)
        
        threshold = threshold_data['threshold']
        
        # Validate input data
        if len(sensor_values) != len(expected_columns):
            raise ValueError(f"Expected {len(expected_columns)} sensor values, got {len(sensor_values)}")
        
        # Create input sequence
        # For prediction, we need to create a sequence of length SEQUENCE_LEN
        # We'll repeat the single reading to create the sequence
        input_data = np.array([sensor_values] * SEQUENCE_LEN)
        
        # Scale the data
        scaled_data = scaler.transform(input_data)
        
        # Reshape for model input (1 sample, SEQUENCE_LEN timesteps, n_features)
        model_input = scaled_data.reshape(1, SEQUENCE_LEN, len(expected_columns))
        
        # Make prediction
        prediction = model.predict(model_input, verbose=0)
        
        # Calculate reconstruction error (MSE)
        reconstruction_error = np.mean(np.square(prediction - model_input))
        
        # Determine if it's an anomaly
        is_anomaly = reconstruction_error > threshold
        
        # Calculate confidence score
        confidence = min(1.0, abs(reconstruction_error - threshold) / threshold)
        
        result = {
            "success": True,
            "data": {
                "reconstruction_error": float(reconstruction_error),
                "threshold": float(threshold),
                "is_anomaly": bool(is_anomaly),
                "confidence": float(confidence),
                "risk_level": "high" if is_anomaly else "normal"
            }
        }
        
        print(json.dumps(result), flush=True)
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Prediction error: {str(e)}"
        }
        print(json.dumps(error_result), flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(f"FATAL: Incorrect number of arguments. Got {len(sys.argv)-1}", file=sys.stderr)
        sys.exit(1)
    
    mode = sys.argv[1]
    
    if mode == 'train':
        if len(sys.argv) not in [6, 7]:
            print(f"FATAL: Train mode requires 5 or 6 arguments. Got {len(sys.argv)-1}", file=sys.stderr)
            sys.exit(1)
            
        row_limit = None
        if len(sys.argv) == 7:
            _, _, user_id, machine_id, file_path, sensor_names_str, row_limit_str = sys.argv
            try:
                row_limit = int(row_limit_str)
            except (ValueError, TypeError):
                row_limit = None
        else:
            _, _, user_id, machine_id, file_path, sensor_names_str = sys.argv

        sensors = [s.strip() for s in sensor_names_str.split(',')]
        run_training_pipeline(user_id, machine_id, file_path, sensors, row_limit)
        
    elif mode == 'predict':
        if len(sys.argv) != 5:
            print(f"FATAL: Predict mode requires 4 arguments. Got {len(sys.argv)-1}", file=sys.stderr)
            sys.exit(1)
            
        _, _, user_id, machine_id, sensor_data_path = sys.argv
        run_prediction(user_id, machine_id, sensor_data_path)
        
    else:
        print(f"FATAL: Unknown mode '{mode}'. Supported modes: train, predict", file=sys.stderr)
        sys.exit(1) 
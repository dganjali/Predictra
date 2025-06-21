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
SEQUENCE_LEN = 10
N_EPOCHS = 5
BATCH_SIZE = 32

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
    """Creates time-series sequences from a numpy array."""
    sequences = []
    for i in range(len(data) - sequence_len + 1):
        sequences.append(data[i : (i + sequence_len)])
    return np.array(sequences)

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
        df_features = df[sorted(available_sensors)] # Sort for consistent column order
        df_features.dropna(inplace=True)
        if df_features.empty:
            raise ValueError("No data remains after removing rows with null values.")
        
        with open(paths['columns_file'], 'w') as f:
            json.dump(df_features.columns.tolist(), f)

        scaler = StandardScaler().fit(df_features)
        joblib.dump(scaler, paths['scaler_file'])
        
        X_train = create_sequences(scaler.transform(df_features))
        if X_train.shape[0] < 1:
            raise ValueError(f"Not enough data for training. At least {SEQUENCE_LEN} rows are required.")

        # STAGE 3: Model Training
        print(json.dumps({"type": "progress", "progress": 50, "message": "Initializing model training..."}), flush=True)
        
        model = Sequential([
            LSTM(32, activation='relu', input_shape=(X_train.shape[1], X_train.shape[2]), return_sequences=False),
            RepeatVector(X_train.shape[1]),
            LSTM(32, activation='relu', return_sequences=True),
            TimeDistributed(Dense(X_train.shape[2]))
        ])
        model.compile(optimizer='adam', loss='mae')
        
        # Add the custom progress callback
        progress_callback = ProgressCallback(total_epochs=N_EPOCHS)
        model.fit(X_train, X_train, epochs=N_EPOCHS, batch_size=BATCH_SIZE, verbose=0, callbacks=[progress_callback])
        
        model.save(paths['model_file'])

        # STAGE 4: Threshold Calculation
        print(json.dumps({"type": "progress", "progress": 90, "message": "Calculating anomaly threshold..."}), flush=True)
        
        try:
            # Use smaller batches for prediction if needed
            if X_train.shape[0] > 1000:
                X_train_pred = np.vstack([model.predict(X_train[i:i+1000]) 
                                         for i in range(0, X_train.shape[0], 1000)])
            else:
                X_train_pred = model.predict(X_train)
                
            # Calculate loss and determine threshold
            train_mae_loss = np.mean(np.abs(X_train_pred - X_train), axis=(1, 2))
            
            # Ensure we have a valid threshold (not NaN or Inf)
            if np.isnan(train_mae_loss).any() or np.isinf(train_mae_loss).any():
                print("Warning: NaN or Inf values in loss, using filtering", file=sys.stderr)
                train_mae_loss = train_mae_loss[~np.isnan(train_mae_loss) & ~np.isinf(train_mae_loss)]
                
            if len(train_mae_loss) == 0:
                raise ValueError("All loss values are invalid (NaN or Inf)")
                
            # Set threshold as 99th percentile to be more robust against outliers
            threshold = float(np.percentile(train_mae_loss, 99))
            
            # Save the threshold and other useful metrics
            threshold_data = {
                'threshold': threshold,
                'mean_loss': float(np.mean(train_mae_loss)),
                'max_loss': float(np.max(train_mae_loss)),
                'min_loss': float(np.min(train_mae_loss)),
                'std_loss': float(np.std(train_mae_loss))
            }
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(paths['threshold_file']), exist_ok=True)
            
            with open(paths['threshold_file'], 'w') as f:
                json.dump(threshold_data, f)
            
            print(f"Saved threshold file to {paths['threshold_file']}", file=sys.stderr)
            
            # STAGE 5: Success
            print(json.dumps({"success": True, "message": "Training completed successfully."}), flush=True)
            
        except Exception as e:
            print(f"Error in threshold calculation: {str(e)}", file=sys.stderr)
            raise

    except Exception as e:
        # Catch any and all exceptions and report them cleanly as a JSON error.
        print(json.dumps({"success": False, "error": f"A critical error occurred: {str(e)}"}), flush=True)
    
    finally:
        # Only remove the file if we were asked to (file cleanup should be handled by caller)
        pass

if __name__ == "__main__":
    if len(sys.argv) not in [6, 7]:
        # This error prints to stderr and will be caught by the Node.js process.
        print(f"FATAL: Incorrect number of arguments. Expected 5 or 6, got {len(sys.argv)-1}", file=sys.stderr)
        sys.exit(1)
        
    row_limit = None
    if len(sys.argv) == 7:
        _, mode, user_id, machine_id, file_path, sensor_names_str, row_limit_str = sys.argv
        try:
            row_limit = int(row_limit_str)
        except (ValueError, TypeError):
            row_limit = None # Ignore if not a valid integer
    else:
        _, mode, user_id, machine_id, file_path, sensor_names_str = sys.argv

    if mode == 'train':
        sensors = [s.strip() for s in sensor_names_str.split(',')]
        run_training_pipeline(user_id, machine_id, file_path, sensors, row_limit)
    else:
        print(f"FATAL: Unknown mode '{mode}'", file=sys.stderr)
        sys.exit(1) 
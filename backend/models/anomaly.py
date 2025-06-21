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

# --- Configuration ---
BASE_MODELS_DIR = os.path.join(os.path.dirname(__file__), 'user_models')
SEQUENCE_LEN = 10
N_EPOCHS = 5
BATCH_SIZE = 32

def get_model_paths(user_id: str, machine_id: str) -> Dict[str, str]:
    """Generates the full file paths for a machine's model and related artifacts."""
    machine_dir = os.path.join(BASE_MODELS_DIR, f"user_{user_id}", f"machine_{machine_id}")
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
        
        required_cols = list(set(sensor_columns + ['time_stamp']))
        df = pd.read_csv(data_path, sep=delimiter, usecols=required_cols, 
                         parse_dates=['time_stamp'], index_col='time_stamp', nrows=row_limit)

        # STAGE 2: Data Preprocessing
        print(json.dumps({"type": "progress", "progress": 25, "message": "Preprocessing data..."}), flush=True)
        
        df_features = df[sorted(sensor_columns)] # Sort for consistent column order
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
        print(json.dumps({"type": "progress", "progress": 50, "message": "Training model..."}), flush=True)
        
        model = Sequential([
            LSTM(32, activation='relu', input_shape=(X_train.shape[1], X_train.shape[2]), return_sequences=False),
            RepeatVector(X_train.shape[1]),
            LSTM(32, activation='relu', return_sequences=True),
            TimeDistributed(Dense(X_train.shape[2]))
        ])
        model.compile(optimizer='adam', loss='mae')
        model.fit(X_train, X_train, epochs=N_EPOCHS, batch_size=BATCH_SIZE, verbose=0)
        model.save(paths['model_file'])

        # STAGE 4: Threshold Calculation
        print(json.dumps({"type": "progress", "progress": 90, "message": "Calculating anomaly threshold..."}), flush=True)
        
        X_train_pred = model.predict(X_train)
        train_mae_loss = np.mean(np.abs(X_train_pred - X_train), axis=1)
        threshold = np.max(train_mae_loss)
        
        with open(paths['threshold_file'], 'w') as f:
            json.dump({'threshold': float(threshold)}, f)
        
        # STAGE 5: Success
        print(json.dumps({"success": True, "message": "Training completed successfully."}), flush=True)

    except Exception as e:
        # Catch any and all exceptions and report them cleanly as a JSON error.
        print(json.dumps({"success": False, "error": f"A critical error occurred: {str(e)}"}), flush=True)
    
    finally:
        # Ensure the temporary data file is always deleted.
        if os.path.exists(data_path):
            os.remove(data_path)

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
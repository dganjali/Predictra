"""
This module provides functions to train an LSTM autoencoder for anomaly detection
on a per-machine basis and to predict anomalies using the trained models.
"""

import os
import json
import time
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed
from tensorflow.keras.regularizers import l1
from sklearn.preprocessing import StandardScaler
import joblib
from typing import List, Dict, Any, Optional, Tuple
import sys

# --- Configuration ---
BASE_MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_models')
SEQUENCE_LEN = 10
N_EPOCHS = 5
BATCH_SIZE = 32

# --- Path Management ---
def get_machine_model_paths(user_id: str, machine_id: str) -> Dict[str, str]:
    """Generates the file paths for a specific machine's model and artifacts."""
    machine_dir = os.path.join(BASE_MODELS_DIR, f"user_{user_id}", f"machine_{machine_id}")
    os.makedirs(machine_dir, exist_ok=True)
    return {
        "model_file": os.path.join(machine_dir, 'lstm_autoencoder_model.h5'),
        "scaler_file": os.path.join(machine_dir, 'scaler.pkl'),
        "threshold_file": os.path.join(machine_dir, 'threshold.json'),
        "columns_file": os.path.join(machine_dir, 'model_columns.json'),
    }

# --- Data Preparation ---
def create_sequences(values, time_steps=SEQUENCE_LEN):
    """Create rolling sequences from the data."""
    output = []
    for i in range(len(values) - time_steps + 1):
        output.append(values[i : (i + time_steps)])
    return np.stack(output)

# --- LSTM Model ---
def build_lstm_autoencoder(timesteps, n_features):
    """Builds the LSTM Autoencoder model."""
    model = Sequential()
    model.add(LSTM(64, input_shape=(timesteps, n_features), activity_regularizer=l1(1e-5)))
    model.add(RepeatVector(timesteps))
    model.add(LSTM(64, return_sequences=True))
    model.add(TimeDistributed(Dense(n_features)))
    model.compile(optimizer='adam', loss='mae')
    return model

# --- Custom Callback for Progress Reporting ---
class ProgressCallback(tf.keras.callbacks.Callback):
    def __init__(self, total_epochs, machine_id):
        super().__init__()
        self.total_epochs = total_epochs
        self.machine_id = machine_id

    def on_epoch_end(self, epoch, logs=None):
        progress_percentage = int(((epoch + 1) / self.total_epochs) * 100)
        progress_data = {
            "type": "progress",
            "machine_id": self.machine_id,
            "progress": progress_percentage,
            "message": f"Epoch {epoch + 1}/{self.total_epochs} complete. Loss: {logs['loss']:.4f}"
        }
        print(json.dumps(progress_data), flush=True)

# --- Training ---
def train_model_for_machine(user_id: str, machine_id: str, data_path: str, sensor_columns: List[str]) -> Dict[str, Any]:
    """Main function to orchestrate the training process for a specific machine."""
    paths = get_machine_model_paths(user_id, machine_id)
    
    try:
        print(f"Loading data from {data_path} for machine {machine_id} of user {user_id}...")

        # Define the maximum size of data to read (5MB)
        MAX_BYTES = 5 * 1024 * 1024

        # Detect delimiter
        with open(data_path, 'r', errors='ignore') as f:
            first_line = f.readline()
            if first_line.count(';') > first_line.count(','):
                delimiter = ';'
            else:
                delimiter = ','
        
        # Read the CSV in chunks to limit memory usage and enforce size limit
        chunk_list = []
        total_bytes_read = 0
        
        # Use an iterator to process the file in chunks
        csv_iterator = pd.read_csv(
            data_path, 
            sep=delimiter, 
            index_col='time_stamp', 
            parse_dates=True,
            chunksize=10000,  # Read 10,000 rows at a time
            low_memory=False,
            on_bad_lines='skip'
        )

        for chunk in csv_iterator:
            chunk_bytes = chunk.memory_usage(deep=True).sum()
            if total_bytes_read + chunk_bytes > MAX_BYTES and total_bytes_read > 0:
                # If adding the next chunk exceeds the limit, stop.
                # Ensure we have at least one chunk to avoid errors.
                break
            chunk_list.append(chunk)
            total_bytes_read += chunk_bytes

        if not chunk_list:
             return {"success": False, "error": "The data file is empty or could not be read."}

        df = pd.concat(chunk_list)
        
        print(f"Successfully loaded {total_bytes_read / (1024*1024):.2f} MB of data.")

        df.dropna(axis=1, how='all', inplace=True)

        # Validate that the user-provided sensor columns exist in the CSV file.
        missing_cols = [col for col in sensor_columns if col not in df.columns]
        if missing_cols:
            return {"success": False, "error": f"The following sensor columns were not found in the uploaded file: {', '.join(missing_cols)}"}
        
        # Use the exact, sorted list of user-provided columns. Sorting is crucial for consistency.
        sensor_cols = sorted(sensor_columns)
        
        with open(paths['columns_file'], 'w') as f:
            json.dump(sensor_cols, f)
            
        df_features = df[sensor_cols].fillna(df[sensor_cols].mean())

        # Scale the features
        scaler = StandardScaler()
        data_normal_scaled = scaler.fit_transform(df_features)
        
        joblib.dump(scaler, paths['scaler_file'])
        
        X_train = create_sequences(data_normal_scaled)
        print(f"Created {X_train.shape[0]} sequences of length {X_train.shape[1]}.")
        
    except Exception as e:
        return {"success": False, "error": f"Data preparation failed: {str(e)}"}

    n_features = X_train.shape[2]
    model = build_lstm_autoencoder(SEQUENCE_LEN, n_features)

    print("\n--- Starting Model Training ---")
    start_time = time.time()
    
    model.fit(
        X_train, X_train,
        epochs=N_EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=0.1,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, mode='min'),
            ProgressCallback(total_epochs=N_EPOCHS, machine_id=machine_id)
        ],
        verbose=0 # Set verbose to 0 to avoid polluting stdout
    )
    
    print(f"--- Training finished in {time.time() - start_time:.2f} seconds. ---")
    model.save(paths['model_file'])
    print(f"Model saved to {paths['model_file']}")

    # Determine anomaly threshold and max error for normalization
    X_train_pred = model.predict(X_train)
    train_mae_loss_per_sequence = np.mean(np.abs(X_train_pred - X_train), axis=(1, 2))
    threshold = np.mean(train_mae_loss_per_sequence) + 3 * np.std(train_mae_loss_per_sequence)
    train_mae_loss_per_timestep = np.mean(np.abs(X_train_pred - X_train), axis=2).flatten()
    max_error = float(np.percentile(train_mae_loss_per_timestep, 99))

    with open(paths['threshold_file'], 'w') as f:
        json.dump({'threshold': threshold, 'max_error': max_error}, f)

    return {"success": True, "message": f"Model for machine {machine_id} trained successfully."}

# --- Prediction ---
def predict_anomalies_smoothed(user_id: str, machine_id: str, df: pd.DataFrame) -> Optional[pd.Series]:
    """
    Takes a dataframe of sensor readings for a specific machine, runs anomaly detection, 
    and returns a smoothed, normalized anomaly score for each timestamp.
    """
    paths = get_machine_model_paths(user_id, machine_id)
    if not os.path.exists(paths['model_file']):
        print(f"Model not found for machine {machine_id}. Cannot run prediction.")
        return None

    print(f"Loading model for machine {machine_id}...")
    model = load_model(paths['model_file'], custom_objects={'mae': tf.keras.losses.mae})
    scaler = joblib.load(paths['scaler_file'])
    with open(paths['threshold_file'], 'r') as f:
        config = json.load(f)
        max_error = config.get('max_error', 1.0)
    with open(paths['columns_file'], 'r') as f:
        model_columns = json.load(f)

    df_pred = df.reindex(columns=model_columns, fill_value=0)
    data_scaled = scaler.transform(df_pred)
    sequences = create_sequences(data_scaled, time_steps=SEQUENCE_LEN)
    
    if len(sequences) == 0:
        return None
    
    predictions = model.predict(sequences)
    errors_per_step = np.mean(np.abs(predictions - sequences), axis=2)
    
    num_records = len(data_scaled)
    sum_of_scores = np.zeros(num_records)
    count_of_scores = np.zeros(num_records)
    
    for i, window_errors in enumerate(errors_per_step):
        for j, step_error in enumerate(window_errors):
            idx = i + j
            if idx < num_records:
                sum_of_scores[idx] += step_error
                count_of_scores[idx] += 1
    
    smoothed_scores = np.divide(sum_of_scores, count_of_scores, out=np.zeros_like(sum_of_scores), where=count_of_scores!=0)
    normalized_scores = np.clip(smoothed_scores / max_error, 0, 1)
    
    return pd.Series(normalized_scores, index=df.index)

def predict_anomaly(user_id: str, machine_id: str, data_values: List[float]) -> Dict[str, Any]:
    """
    Predicts if a single reading (list of values) from a specific machine is an anomaly.
    The order of values in data_values must match the order of columns from training.
    """
    paths = get_machine_model_paths(user_id, machine_id)
    
    # Check for model files
    required_files = [paths['model_file'], paths['scaler_file'], paths['threshold_file'], paths['columns_file']]
    if not all(os.path.exists(f) for f in required_files):
        missing = [os.path.basename(f) for f in required_files if not os.path.exists(f)]
        return {"success": False, "error": f"Model for machine {machine_id} is not fully trained or is missing files: {', '.join(missing)}"}

    try:
        model = load_model(paths['model_file'], custom_objects={'mae': tf.keras.losses.mae})
        scaler = joblib.load(paths['scaler_file'])
        with open(paths['threshold_file'], 'r') as f:
            threshold = json.load(f)['threshold']
        with open(paths['columns_file'], 'r') as f:
            model_columns = json.load(f)

        if len(data_values) != len(model_columns):
            return {
                "success": False, 
                "error": f"Input data has {len(data_values)} features, but model expects {len(model_columns)}."
            }

        # Create a DataFrame for the single reading, repeated to match sequence length
        df_sequence = pd.DataFrame([data_values] * SEQUENCE_LEN, columns=model_columns)
        
        scaled_sequence = scaler.transform(df_sequence)
        reshaped_sequence = np.array([scaled_sequence])
        
        pred_sequence = model.predict(reshaped_sequence)
        mae_loss = np.mean(np.abs(pred_sequence - reshaped_sequence))

        return {
            "success": True,
            "data": {
                "is_anomaly": bool(mae_loss > threshold),
                "reconstruction_error": float(mae_loss),
                "threshold": float(threshold)
            }
        }
    except Exception as e:
        return {"success": False, "error": f"Error during prediction: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Mode (train/predict) not specified."}))
        sys.exit(1)

    mode = sys.argv[1]

    if mode == 'train':
        if len(sys.argv) != 6:
            result = {"success": False, "error": "Incorrect number of arguments for training mode. Expected: user_id, machine_id, data_path, sensor_columns"}
            print(json.dumps(result))
            sys.exit(1)
        user_id_arg, machine_id_arg, data_path_arg, sensors_arg = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        sensor_list = [s.strip() for s in sensors_arg.split(',')]
        result = train_model_for_machine(user_id_arg, machine_id_arg, data_path_arg, sensor_list)
        print(json.dumps(result))
    
    elif mode == 'predict':
        if len(sys.argv) != 5:
            result = {"success": False, "error": "Incorrect number of arguments for prediction mode."}
            print(json.dumps(result))
            sys.exit(1)
        
        user_id_arg, machine_id_arg, data_path_arg = sys.argv[2], sys.argv[3], sys.argv[4]
        
        try:
            with open(data_path_arg, 'r') as f:
                sensor_data = json.load(f)
            
            prediction = predict_anomaly(user_id_arg, machine_id_arg, sensor_data)
            
            if "error" in prediction:
                 print(json.dumps({"success": False, "error": prediction["error"]}))
            else:
                 print(json.dumps(prediction))

        except Exception as e:
            print(json.dumps({"success": False, "error": f"Prediction failed: {str(e)}"}))

    else:
        print(json.dumps({"success": False, "error": f"Unknown mode: {mode}"}))
        sys.exit(1) 
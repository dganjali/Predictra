# Ultra-Simple Training System

This directory contains the new, ultra-simple training system for predictive maintenance.

## Files

- `simple_trainer.py` - The main training script that creates and trains autoencoder models
- `simple_predictor.py` - The prediction script that uses trained models for anomaly detection
- `test_simple_training.py` - Test script to verify the training system works

## How It Works

### Training Process
1. User uploads a CSV file with historical sensor data
2. The system loads and preprocesses the data (handles missing values, scales data)
3. A simple autoencoder neural network is trained on the data
4. The model learns what "normal" sensor readings look like
5. Anomaly thresholds are calculated based on reconstruction errors
6. Model and metadata are saved for future use

### Prediction Process
1. User uploads new CSV data for analysis
2. The system loads the trained model and preprocesses the new data
3. Each data point is run through the autoencoder
4. Reconstruction errors are calculated
5. Anomalies are detected based on the learned threshold
6. Health scores and RUL estimates are calculated

## Model Architecture

The system uses a simple autoencoder:
- Input layer: Dense layer matching the number of sensors
- Hidden layers: 64 → 32 → 16 neurons with ReLU activation
- Output layer: Dense layer reconstructing the input
- Dropout layers for regularization

## Usage

### Training
```bash
python3 simple_trainer.py <user_id> <machine_id> <csv_path>
```

### Prediction
```bash
python3 simple_predictor.py <user_id> <machine_id> <csv_path>
```

## Advantages

- **Simple**: Easy to understand and debug
- **Fast**: Only 3 epochs, limited data size
- **Reliable**: Minimal dependencies, clear error handling
- **Scalable**: Can handle different numbers of sensors
- **Robust**: Handles missing data and various CSV formats

## Testing

Run the test script to verify everything works:
```bash
python3 test_simple_training.py
``` 
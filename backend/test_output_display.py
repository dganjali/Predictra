#!/usr/bin/env python3
"""
Test script to demonstrate the real-time output display functionality.
This simulates what the Python training script would output.
"""

import json
import time
import sys

def send_progress(progress, message):
    """Send progress update."""
    data = {
        "type": "progress",
        "progress": progress,
        "message": message
    }
    print(json.dumps(data), flush=True)

def send_detailed_message(message, message_type="info"):
    """Send detailed message."""
    data = {
        "type": "message",
        "message": message,
        "message_type": message_type
    }
    print(json.dumps(data), flush=True)

def main():
    """Simulate training process with detailed output."""
    print("Starting test of real-time output display...")
    
    # Initial setup
    send_progress(0, "Initializing training environment...")
    send_detailed_message("Starting Python training script...", "info")
    time.sleep(1)
    
    # Data loading
    send_progress(10, "Loading training data...")
    send_detailed_message("Reading CSV file...", "info")
    time.sleep(0.5)
    send_detailed_message("Loaded CSV with 1,500 rows and 8 columns", "info")
    time.sleep(0.5)
    send_detailed_message("Using sensor columns: temperature, vibration, current, speed", "info")
    time.sleep(0.5)
    send_detailed_message("Handled 23 missing values", "warning")
    time.sleep(0.5)
    send_detailed_message("Sampled 1,500 rows from 2,000 for faster training", "info")
    time.sleep(0.5)
    send_detailed_message("Scaling data using StandardScaler...", "info")
    time.sleep(0.5)
    send_progress(30, "Preprocessed 1,500 samples")
    send_detailed_message("Data preprocessing completed successfully", "success")
    time.sleep(1)
    
    # Model building
    send_progress(50, "Building simple neural network...")
    send_detailed_message("Creating autoencoder architecture...", "info")
    time.sleep(0.5)
    send_detailed_message("Built autoencoder with 2,945 parameters", "success")
    time.sleep(1)
    
    # Training
    send_progress(60, "Training neural network...")
    send_detailed_message("Starting model training...", "info")
    send_detailed_message("Training for 3 epochs with batch size 32", "info")
    time.sleep(1)
    
    # Simulate epoch progress
    for epoch in range(1, 4):
        send_detailed_message(f"Epoch {epoch}/3 - Loss: {0.045 - epoch * 0.01:.6f}", "progress")
        time.sleep(0.8)
    
    send_progress(80, "Training completed. Final loss: 0.025")
    send_detailed_message("Training completed! Final loss: 0.025000, Validation loss: 0.027500", "success")
    time.sleep(1)
    
    # Threshold calculation
    send_progress(85, "Calculating anomaly threshold...")
    send_detailed_message("Computing reconstruction errors...", "info")
    time.sleep(0.5)
    send_detailed_message("Anomaly threshold calculated: 0.045000 (95th percentile)", "success")
    send_detailed_message("Error statistics - Mean: 0.025000, Std: 0.012000", "info")
    time.sleep(1)
    
    # Saving
    send_progress(90, "Saving model and metadata...")
    send_detailed_message("Saving trained model...", "info")
    time.sleep(0.5)
    send_detailed_message("Model saved successfully", "success")
    time.sleep(0.3)
    send_detailed_message("Data scaler saved", "success")
    time.sleep(0.3)
    send_detailed_message("Column configuration saved", "success")
    time.sleep(0.3)
    send_detailed_message("Training statistics saved", "success")
    time.sleep(0.5)
    
    # Completion
    send_progress(100, "Training completed successfully!")
    send_detailed_message("All files saved successfully!", "success")
    
    print("Test completed successfully!")

if __name__ == "__main__":
    main() 
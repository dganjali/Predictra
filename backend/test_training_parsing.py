#!/usr/bin/env python3
"""
Test script to verify training output parsing works correctly
"""

import json
import sys

def simulate_training_output():
    """Simulate the exact output format from the training script"""
    
    # Simulate progress updates
    print(json.dumps({"type": "progress", "progress": 5, "message": "Initializing ultra simple training..."}))
    print(json.dumps({"type": "message", "message": "Starting data preprocessing", "message_type": "info"}))
    
    print(json.dumps({"type": "progress", "progress": 10, "message": "Reading CSV file..."}))
    print(json.dumps({"type": "message", "message": "CSV has 65 columns", "message_type": "info"}))
    
    print(json.dumps({"type": "progress", "progress": 20, "message": "Scaling data..."}))
    print(json.dumps({"type": "message", "message": "Data scaled successfully", "message_type": "success"}))
    
    print(json.dumps({"type": "progress", "progress": 50, "message": "Training model..."}))
    print(json.dumps({"type": "message", "message": "Epoch 1/2 - loss: 0.9234", "message_type": "info"}))
    
    print(json.dumps({"type": "progress", "progress": 80, "message": "Calculating threshold..."}))
    print(json.dumps({"type": "message", "message": "Threshold calculated: 1.7514", "message_type": "info"}))
    
    print(json.dumps({"type": "progress", "progress": 100, "message": "Training completed successfully!"}))
    
    # Simulate log messages (plain text)
    print("2025-06-22 05:43:56,682 - INFO - 🎉 Complete training pipeline finished in 24.21s!")
    print("2025-06-22 05:43:56,682 - INFO - ============================================================")
    print("2025-06-22 05:43:56,682 - INFO - ✅ TRAINING COMPLETED SUCCESSFULLY")
    
    # Simulate the final success message
    success_data = {
        "type": "success",
        "stats": {
            "final_loss": 0.9234570860862732,
            "final_val_loss": 0.9658138155937195,
            "epochs_trained": 2,
            "training_samples": 500,
            "training_duration": 14.200567,
            "avg_epoch_time": 7.1002835,
            "threshold": 1.7514913035776623,
            "mean_error": 0.9123177938987153,
            "std_error": 0.5737025293716644,
            "min_error": 0.20995139443803873,
            "max_error": 5.98107923096358,
            "percentile_90": 1.5515560441472998,
            "percentile_95": 1.7514913035776623,
            "percentile_99": 2.5353464615421073,
            "pretrained_threshold": 0.9230364387408997,
            "threshold_improvement": 0.8284548648367626,
            "sensor_columns": ["sensor_0_avg", "sensor_1_avg", "sensor_2_avg"],
            "model_type": "simple_autoencoder"
        },
        "timestamp": "2025-06-22T05:43:56.682620"
    }
    
    print(f"SUCCESS:{json.dumps(success_data)}")
    print("2025-06-22 05:43:56,682 - INFO - 🎉 Exiting successfully")

if __name__ == "__main__":
    simulate_training_output() 
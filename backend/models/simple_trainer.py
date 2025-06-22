#!/usr/bin/env python3
"""
Ultra-simple training system for predictive maintenance.
This is a completely new approach that's easy to debug and reliable.
"""

import os
import sys
import json
import logging
import gc
import numpy as np
import pandas as pd
import joblib
from typing import List, Dict, Tuple
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
import tensorflow as tf

# Set up comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('training.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# Suppress TensorFlow warnings but keep important ones
tf.get_logger().setLevel(logging.ERROR)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

class UltraSimpleTrainer:
    """Ultra-simple autoencoder trainer for anomaly detection with comprehensive logging."""
    
    def __init__(self, user_id: str, machine_id: str):
        self.user_id = user_id
        self.machine_id = machine_id
        self.model = None
        self.scaler = None
        self.model_dir = self._create_model_directory()
        self.pretrained_config = self._load_pretrained_config()
        
        logger.info(f"🚀 Initialized UltraSimpleTrainer for user {user_id}, machine {machine_id}")
        logger.info(f"📁 Model directory: {self.model_dir}")
        
        # Log system info
        logger.info(f"💻 Python version: {sys.version}")
        logger.info(f"🧠 TensorFlow version: {tf.__version__}")
        logger.info(f"📊 NumPy version: {np.__version__}")
        logger.info(f"🐼 Pandas version: {pd.__version__}")
        
        # Log memory usage
        import psutil
        memory = psutil.virtual_memory()
        logger.info(f"💾 System memory: {memory.total // (1024**3)}GB total, {memory.available // (1024**3)}GB available")
        
        # Log CPU info
        logger.info(f"🖥️ CPU cores: {psutil.cpu_count()}")
        
        # Check for GPU
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            logger.info(f"🎮 GPU detected: {len(gpus)} device(s)")
            for i, gpu in enumerate(gpus):
                logger.info(f"   GPU {i}: {gpu.name}")
        else:
            logger.info("🖥️ No GPU detected, using CPU")
        
        # Log pretrained model info
        if self.pretrained_config:
            logger.info(f"🎯 Pretrained model loaded with {len(self.pretrained_config.get('trained_columns', []))} sensors")
            logger.info(f"🎯 Pretrained threshold: {self.pretrained_config.get('threshold', 'N/A')}")
        else:
            logger.info("⚠️ No pretrained model found, will train from scratch")
    
    def _create_model_directory(self) -> str:
        """Create model directory with logging."""
        try:
            model_dir = os.path.join(
                os.path.dirname(__file__),
                'user_models',
                f'user_{self.user_id}',
                f'machine_{self.machine_id}'
            )
            
            if not os.path.exists(model_dir):
                os.makedirs(model_dir, exist_ok=True)
                logger.info(f"📁 Created model directory: {model_dir}")
            else:
                logger.info(f"📁 Using existing model directory: {model_dir}")
            
            return model_dir
        except Exception as e:
            logger.error(f"❌ Error creating model directory: {e}")
            raise
    
    def _send_progress(self, progress: int, message: str):
        """Send progress update with logging."""
        progress_data = {
            "type": "progress",
            "progress": progress,
            "message": message
        }
        print(f"PROGRESS:{json.dumps(progress_data)}")
        logger.info(f"📈 Progress {progress}%: {message}")
    
    def _send_detailed_message(self, message: str, message_type: str = "info"):
        """Send detailed message with logging."""
        detailed_data = {
            "type": "message",
            "message": message,
            "message_type": message_type
        }
        print(f"DETAILED:{json.dumps(detailed_data)}")
        
        # Map message types to log levels
        log_level = {
            "info": logging.INFO,
            "success": logging.INFO,
            "warning": logging.WARNING,
            "error": logging.ERROR
        }.get(message_type, logging.INFO)
        
        logger.log(log_level, f"[{message_type.upper()}] {message}")
    
    def _send_heartbeat(self):
        """Send heartbeat to keep connection alive with logging."""
        heartbeat_data = {
            "type": "heartbeat",
            "timestamp": pd.Timestamp.now().isoformat()
        }
        print(f"HEARTBEAT:{json.dumps(heartbeat_data)}")
        logger.debug("💓 Heartbeat sent")
    
    def _cleanup_memory(self):
        """Clean up memory with logging."""
        try:
            # Force garbage collection
            collected = gc.collect()
            logger.debug(f"🧹 Garbage collection: {collected} objects collected")
            
            # Log memory usage after cleanup
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            logger.debug(f"💾 Memory usage after cleanup: {memory_mb:.1f}MB")
            
        except Exception as e:
            logger.warning(f"⚠️ Error during memory cleanup: {e}")
    
    def load_and_preprocess_data(self, csv_path: str, sensor_columns: List[str]) -> Tuple[np.ndarray, List[str]]:
        """Load and preprocess CSV data with aggressive memory optimization and comprehensive logging."""
        self._send_progress(1, "Starting data preprocessing...")
        self._send_detailed_message("Initializing ultra-fast data preprocessing...", "info")
        
        start_time = pd.Timestamp.now()
        logger.info(f"🔄 Starting data preprocessing at {start_time}")
        logger.info(f"📁 CSV path: {csv_path}")
        logger.info(f"🎯 Requested sensor columns: {sensor_columns}")
        
        try:
            # Check if file exists
            self._send_progress(2, "Checking file...")
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f"CSV file not found: {csv_path}")
            
            file_size = os.path.getsize(csv_path)
            logger.info(f"📄 File found: {csv_path} ({file_size:,} bytes)")
            self._send_detailed_message(f"File found: {csv_path} ({file_size:,} bytes)", "info")
            
            # Read CSV file in chunks to prevent memory issues
            self._send_progress(3, "Reading file header...")
            self._send_detailed_message("Reading CSV file header...", "info")
            
            # First, detect the delimiter by reading a small sample
            try:
                with open(csv_path, 'r') as f:
                    first_line = f.readline().strip()
                logger.info(f"📖 First line preview: {first_line[:100]}...")
                self._send_detailed_message(f"Read first line: {first_line[:100]}...", "info")
            except Exception as e:
                logger.error(f"❌ Error reading file: {e}")
                raise Exception(f"Error reading file: {str(e)}")
            
            # Detect delimiter (comma or semicolon)
            comma_count = first_line.count(',')
            semicolon_count = first_line.count(';')
            delimiter = ';' if semicolon_count > comma_count else ','
            
            logger.info(f"🔍 Detected delimiter: '{delimiter}' (commas: {comma_count}, semicolons: {semicolon_count})")
            self._send_progress(4, f"Detected delimiter: {delimiter}")
            self._send_detailed_message(f"Detected delimiter: '{delimiter}'", "info")
            
            # Read only first few rows to get column info
            self._send_progress(5, "Reading column headers...")
            try:
                df_sample = pd.read_csv(csv_path, nrows=50, delimiter=delimiter)  # Reduced from 100
                logger.info(f"📊 CSV has {len(df_sample.columns)} columns: {list(df_sample.columns)}")
                self._send_detailed_message(f"CSV has {len(df_sample.columns)} columns", "info")
            except Exception as e:
                logger.error(f"❌ Error reading CSV headers: {e}")
                raise Exception(f"Error reading CSV headers: {str(e)}")
            
            # If no sensor columns provided, use all numeric columns
            self._send_progress(6, "Analyzing columns...")
            if not sensor_columns:
                # Filter out non-sensor columns (metadata columns)
                exclude_patterns = ['time', 'timestamp', 'date', 'id', 'asset', 'train', 'test', 'status']
                available_columns = []
                
                for col in df_sample.columns:
                    col_lower = col.lower()
                    # Include if it's not a metadata column and contains sensor-related keywords
                    if not any(pattern in col_lower for pattern in exclude_patterns):
                        available_columns.append(col)
                
                logger.info(f"🔍 Auto-detected {len(available_columns)} sensor columns: {available_columns}")
                self._send_detailed_message(f"Auto-detected {len(available_columns)} sensor columns", "info")
            else:
                # Use provided sensor columns
                available_columns = [col for col in sensor_columns if col in df_sample.columns]
                missing_columns = [col for col in sensor_columns if col not in df_sample.columns]
                
                if missing_columns:
                    logger.warning(f"⚠️ Missing columns: {missing_columns}")
                
                logger.info(f"🎯 Using {len(available_columns)} provided sensor columns: {available_columns}")
                self._send_detailed_message(f"Using {len(available_columns)} provided sensor columns", "info")
            
            if not available_columns:
                # If still no columns, use all numeric columns
                self._send_progress(7, "Falling back to numeric columns...")
                numeric_columns = df_sample.select_dtypes(include=[np.number]).columns.tolist()
                available_columns = numeric_columns[:10]  # Reduced from 20 to 10 for speed
                logger.info(f"🔄 Falling back to first 10 numeric columns: {available_columns}")
                self._send_detailed_message(f"Using first 10 numeric columns: {available_columns[:5]}...", "info")
            
            if not available_columns:
                logger.error(f"❌ No suitable sensor columns found. Available columns: {list(df_sample.columns)}")
                raise ValueError(f"No suitable sensor columns found. Available columns: {list(df_sample.columns)}")
            
            self._send_progress(8, f"Selected {len(available_columns)} columns")
            self._send_detailed_message(f"Using sensor columns: {', '.join(available_columns[:5])}{'...' if len(available_columns) > 5 else ''}", "info")
            
            # Read full dataset with only needed columns
            self._send_progress(9, "Loading full dataset...")
            self._send_detailed_message("Loading full dataset with selected columns...", "info")
            try:
                df_sensors = pd.read_csv(csv_path, usecols=available_columns, delimiter=delimiter)
                logger.info(f"📊 Loaded {len(df_sensors)} rows with {len(available_columns)} sensors")
                logger.info(f"📊 Data shape: {df_sensors.shape}")
                logger.info(f"📊 Data types: {df_sensors.dtypes.to_dict()}")
                self._send_detailed_message(f"Loaded {len(df_sensors)} rows with {len(available_columns)} sensors", "info")
            except Exception as e:
                logger.error(f"❌ Error loading full dataset: {e}")
                raise Exception(f"Error loading full dataset: {str(e)}")
            
            # Handle missing values
            self._send_progress(10, "Processing missing values...")
            self._send_detailed_message("Handling missing values...", "info")
            missing_before = df_sensors.isnull().sum().sum()
            logger.info(f"🔍 Missing values before cleanup: {missing_before}")
            
            df_sensors = df_sensors.ffill().bfill()  # Use newer pandas methods
            missing_after = df_sensors.isnull().sum().sum()
            logger.info(f"🔍 Missing values after cleanup: {missing_after}")
            
            if missing_before > 0:
                logger.warning(f"⚠️ Handled {missing_before - missing_after} missing values")
                self._send_detailed_message(f"Handled {missing_before - missing_after} missing values", "warning")
            
            if df_sensors.empty:
                logger.error("❌ No data remaining after handling missing values")
                raise ValueError("No data remaining after handling missing values")
            
            # Limit data size for faster training and memory efficiency
            self._send_progress(12, "Sampling data...")
            original_size = len(df_sensors)
            max_samples = 500  # Reduced from 1500 to 500 for much faster training
            if len(df_sensors) > max_samples:
                df_sensors = df_sensors.sample(n=max_samples, random_state=42)
                logger.info(f"📊 Sampled {len(df_sensors)} rows from {original_size} for ultra-fast training")
                self._send_detailed_message(f"Sampled {len(df_sensors)} rows from {original_size} for ultra-fast training", "info")
            
            # Scale the data
            self._send_progress(15, "Scaling data...")
            self._send_detailed_message("Scaling data using StandardScaler...", "info")
            try:
                # Try to use pretrained scaler first
                pretrained_scaler = self._load_pretrained_scaler()
                if pretrained_scaler is not None:
                    logger.info(f"🔄 Using pretrained scaler for data scaling")
                    self.scaler = pretrained_scaler
                    
                    # Check if column names match
                    try:
                        scaled_data = self.scaler.transform(df_sensors)  # Use transform instead of fit_transform
                        logger.info(f"✅ Data scaled using pretrained scaler")
                    except ValueError as e:
                        if "feature names should match" in str(e):
                            logger.warning(f"⚠️ Column names don't match pretrained scaler, creating new scaler")
                            logger.warning(f"⚠️ Error: {str(e)}")
                            self.scaler = StandardScaler()
                            scaled_data = self.scaler.fit_transform(df_sensors)
                            logger.info(f"✅ Data scaled using new scaler (column mismatch)")
                        else:
                            raise e
                else:
                    logger.info(f"🔄 Creating new scaler for data scaling")
                    self.scaler = StandardScaler()
                    scaled_data = self.scaler.fit_transform(df_sensors)
                    logger.info(f"✅ Data scaled using new scaler")
                
                # Log scaling statistics
                logger.info(f"📊 Data scaling completed")
                logger.info(f"📊 Scaled data shape: {scaled_data.shape}")
                logger.info(f"📊 Scaled data mean: {np.mean(scaled_data, axis=0)}")
                logger.info(f"📊 Scaled data std: {np.std(scaled_data, axis=0)}")
                
                self._send_detailed_message(f"Data scaled successfully", "success")
            except Exception as e:
                logger.error(f"❌ Error scaling data: {e}")
                raise Exception(f"Error scaling data: {str(e)}")
            
            # Clean up pandas dataframe to free memory
            del df_sensors
            gc.collect()
            
            end_time = pd.Timestamp.now()
            duration = (end_time - start_time).total_seconds()
            logger.info(f"✅ Data preprocessing completed in {duration:.2f} seconds")
            
            self._send_progress(20, f"Preprocessed {len(scaled_data)} samples")
            self._send_detailed_message(f"Data preprocessing completed successfully in {duration:.2f}s", "success")
            return scaled_data, available_columns
            
        except Exception as e:
            logger.error(f"❌ Error loading data: {e}")
            self._send_detailed_message(f"Error loading data: {str(e)}", "error")
            raise
    
    def build_simple_model(self, input_shape: int) -> Sequential:
        """Build a very simple neural network with aggressive memory optimization and logging."""
        self._send_detailed_message("Creating ultra-simple autoencoder architecture...", "info")
        
        start_time = pd.Timestamp.now()
        logger.info(f"🏗️ Building model with input shape: {input_shape}")
        
        # Try to load pretrained model first
        pretrained_model = self._load_pretrained_model(input_shape)
        if pretrained_model is not None:
            logger.info(f"🔄 Using pretrained model as starting point")
            self._send_detailed_message("Using pretrained model as starting point for faster training", "info")
            
            # Compile the pretrained model
            pretrained_model.compile(
                optimizer='adam',
                loss='mse',
                metrics=['mae']
            )
            
            param_count = pretrained_model.count_params()
            end_time = pd.Timestamp.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"🏗️ Pretrained model loaded successfully in {duration:.2f}s")
            logger.info(f"🏗️ Total parameters: {param_count:,}")
            logger.info(f"🏗️ Model summary:")
            
            # Log model summary
            pretrained_model.summary(print_fn=logger.info)
            
            self._send_detailed_message(f"Loaded pretrained model with {param_count:,} parameters in {duration:.2f}s", "success")
            return pretrained_model
        
        # If no pretrained model available, build new one
        logger.info(f"🔄 Building new model from scratch")
        self._send_detailed_message("Building new model from scratch", "info")
        
        # Use much smaller model for speed
        model = Sequential([
            Dense(16, activation='relu', input_shape=(input_shape,)),  # Reduced from 32
            Dense(8, activation='relu'),   # Reduced from 16
            Dense(4, activation='relu'),   # New bottleneck layer
            Dense(8, activation='relu'),   # Decoder
            Dense(16, activation='relu'),  # Decoder
            Dense(input_shape, activation='linear')
        ])
        
        logger.info(f"🏗️ Model architecture created with {len(model.layers)} layers")
        
        model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        param_count = model.count_params()
        end_time = pd.Timestamp.now()
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"🏗️ Model compiled successfully in {duration:.2f}s")
        logger.info(f"🏗️ Total parameters: {param_count:,}")
        logger.info(f"🏗️ Model summary:")
        
        # Log model summary
        model.summary(print_fn=logger.info)
        
        self._send_detailed_message(f"Built ultra-simple autoencoder with {param_count:,} parameters in {duration:.2f}s", "success")
        return model
    
    def train_model(self, X_train: np.ndarray) -> Dict:
        """Train the model with aggressive memory optimization and comprehensive logging."""
        self._send_progress(25, "Starting model training...")
        self._send_detailed_message("Initializing ultra-fast training process...", "info")
        
        start_time = pd.Timestamp.now()
        logger.info(f"🚀 Starting model training at {start_time}")
        logger.info(f"📊 Training data shape: {X_train.shape}")
        logger.info(f"📊 Training data type: {X_train.dtype}")
        logger.info(f"📊 Training data memory usage: {X_train.nbytes / 1024 / 1024:.1f}MB")
        
        # Send initial heartbeat to establish connection
        self._send_heartbeat()
        
        # Build model
        self._send_progress(30, "Building neural network...")
        self.model = self.build_simple_model(X_train.shape[1])
        
        # Train model with very simple settings for speed
        is_pretrained = hasattr(self.model, '_is_pretrained') or (self.pretrained_config and len(self.pretrained_config.get('trained_columns', [])) == X_train.shape[1])
        
        if is_pretrained:
            epochs = 1  # Just fine-tune for 1 epoch when using pretrained model
            logger.info(f"🎯 Using pretrained model - fine-tuning for {epochs} epoch")
            self._send_detailed_message(f"Fine-tuning pretrained model for {epochs} epoch", "info")
        else:
            epochs = 2  # Reduced from 3 to 2 for speed when training from scratch
            logger.info(f"🎯 Training from scratch - using {epochs} epochs")
            self._send_detailed_message(f"Training new model for {epochs} epochs", "info")
        
        batch_size = 32  # Increased from 16 to 32 for speed
        validation_split = 0.2
        
        logger.info(f"🎯 Training configuration:")
        logger.info(f"   - Epochs: {epochs}")
        logger.info(f"   - Batch size: {batch_size}")
        logger.info(f"   - Validation split: {validation_split}")
        logger.info(f"   - Training samples: {len(X_train)}")
        logger.info(f"   - Steps per epoch: {len(X_train) // batch_size}")
        logger.info(f"   - Using pretrained model: {is_pretrained}")
        
        self._send_detailed_message(f"Training for {epochs} epochs with batch size {batch_size} for speed", "info")
        
        # Custom training loop for better progress tracking
        history = {'loss': [], 'val_loss': []}
        
        for epoch in range(epochs):
            epoch_start_time = pd.Timestamp.now()
            epoch_start_progress = 35 + (epoch * 20)  # More progress per epoch
            self._send_progress(epoch_start_progress, f"Training epoch {epoch + 1}/{epochs}")
            self._send_detailed_message(f"Starting epoch {epoch + 1}/{epochs}...", "info")
            
            logger.info(f"🔄 Starting epoch {epoch + 1}/{epochs} at {epoch_start_time}")
            
            # Train for one epoch
            epoch_history = self.model.fit(
                X_train, X_train,
                epochs=1,
                batch_size=batch_size,
                validation_split=validation_split,
                verbose=1
            )
            
            # Send heartbeat during training to keep connection alive
            self._send_heartbeat()
            
            # Record metrics
            history['loss'].extend(epoch_history.history['loss'])
            history['val_loss'].extend(epoch_history.history.get('val_loss', epoch_history.history['loss']))
            
            # Send epoch completion message
            current_loss = history['loss'][-1]
            val_loss = history['val_loss'][-1]
            epoch_end_progress = epoch_start_progress + 15
            epoch_end_time = pd.Timestamp.now()
            epoch_duration = (epoch_end_time - epoch_start_time).total_seconds()
            
            logger.info(f"✅ Epoch {epoch + 1}/{epochs} completed in {epoch_duration:.2f}s")
            logger.info(f"   - Training loss: {current_loss:.6f}")
            logger.info(f"   - Validation loss: {val_loss:.6f}")
            logger.info(f"   - Loss improvement: {history['loss'][-2] - current_loss:.6f}" if len(history['loss']) > 1 else "   - First epoch")
            
            self._send_progress(epoch_end_progress, f"Epoch {epoch + 1}/{epochs} completed")
            self._send_detailed_message(f"Epoch {epoch + 1}/{epochs} completed in {epoch_duration:.2f}s - Loss: {current_loss:.6f}, Val Loss: {val_loss:.6f}", "success")
            
            # Clean up memory after each epoch
            self._cleanup_memory()
        
        # Calculate training metrics
        train_loss = history['loss'][-1]
        val_loss = history['val_loss'][-1]
        total_duration = (pd.Timestamp.now() - start_time).total_seconds()
        
        logger.info(f"🎉 Training completed in {total_duration:.2f} seconds")
        logger.info(f"📊 Final metrics:")
        logger.info(f"   - Final training loss: {train_loss:.6f}")
        logger.info(f"   - Final validation loss: {val_loss:.6f}")
        logger.info(f"   - Training samples: {len(X_train)}")
        logger.info(f"   - Epochs trained: {len(history['loss'])}")
        logger.info(f"   - Average epoch time: {total_duration / epochs:.2f}s")
        
        metrics = {
            'final_loss': train_loss,
            'final_val_loss': val_loss,
            'epochs_trained': len(history['loss']),
            'training_samples': len(X_train),
            'training_duration': total_duration,
            'avg_epoch_time': total_duration / epochs
        }
        
        self._send_progress(80, f"Training completed. Final loss: {train_loss:.4f}")
        self._send_detailed_message(f"Training completed in {total_duration:.2f}s! Final loss: {train_loss:.6f}, Validation loss: {val_loss:.6f}", "success")
        return metrics
    
    def calculate_threshold(self, X_train: np.ndarray) -> Dict:
        """Calculate anomaly threshold based on reconstruction error with optimization and logging."""
        self._send_progress(85, "Calculating anomaly threshold...")
        self._send_detailed_message("Computing reconstruction errors...", "info")
        
        start_time = pd.Timestamp.now()
        logger.info(f"🔍 Starting threshold calculation at {start_time}")
        logger.info(f"📊 Input data shape: {X_train.shape}")
        
        # Get reconstruction errors in larger batches for speed
        batch_size = 200  # Increased from 100 for speed
        mse_errors = []
        total_batches = (len(X_train) + batch_size - 1) // batch_size
        
        logger.info(f"🔍 Processing {total_batches} batches with batch size {batch_size}")
        
        for i in range(0, len(X_train), batch_size):
            batch_start = i
            batch_end = min(i + batch_size, len(X_train))
            batch = X_train[batch_start:batch_end]
            
            logger.debug(f"🔍 Processing batch {i//batch_size + 1}/{total_batches} (samples {batch_start}-{batch_end-1})")
            
            predictions = self.model.predict(batch, verbose=0)
            batch_errors = np.mean((batch - predictions) ** 2, axis=1)
            mse_errors.extend(batch_errors)
            
            # Send heartbeat during long computation
            if i % 1000 == 0:  # Reduced frequency
                self._send_heartbeat()
                logger.debug(f"💓 Heartbeat sent at batch {i//batch_size + 1}")
        
        mse_errors = np.array(mse_errors)
        
        logger.info(f"🔍 Reconstruction errors calculated for {len(mse_errors)} samples")
        logger.info(f"🔍 Error statistics:")
        logger.info(f"   - Mean: {np.mean(mse_errors):.6f}")
        logger.info(f"   - Std: {np.std(mse_errors):.6f}")
        logger.info(f"   - Min: {np.min(mse_errors):.6f}")
        logger.info(f"   - Max: {np.max(mse_errors):.6f}")
        
        # Calculate threshold as 95th percentile of errors
        threshold = np.percentile(mse_errors, 95)
        
        # If we have a pretrained threshold, use it as a reference
        pretrained_threshold = self.pretrained_config.get('threshold') if self.pretrained_config else None
        if pretrained_threshold:
            logger.info(f"🎯 Pretrained threshold reference: {pretrained_threshold:.6f}")
            logger.info(f"🎯 New calculated threshold: {threshold:.6f}")
            logger.info(f"🎯 Threshold difference: {abs(threshold - pretrained_threshold):.6f}")
            
            # Use a weighted average if the difference is reasonable
            if abs(threshold - pretrained_threshold) < pretrained_threshold * 0.5:  # Within 50% of pretrained
                weighted_threshold = 0.7 * pretrained_threshold + 0.3 * threshold
                logger.info(f"🎯 Using weighted threshold: {weighted_threshold:.6f} (70% pretrained + 30% new)")
                threshold = weighted_threshold
            else:
                logger.info(f"🎯 Using new threshold due to significant difference from pretrained")
        
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
        
        # Add pretrained reference if available
        if pretrained_threshold:
            stats['pretrained_threshold'] = float(pretrained_threshold)
            stats['threshold_improvement'] = float(threshold - pretrained_threshold)
        
        end_time = pd.Timestamp.now()
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"✅ Threshold calculation completed in {duration:.2f}s")
        logger.info(f"🎯 Anomaly threshold: {threshold:.6f} (95th percentile)")
        logger.info(f"📊 Percentile breakdown:")
        logger.info(f"   - 90th percentile: {stats['percentile_90']:.6f}")
        logger.info(f"   - 95th percentile: {stats['percentile_95']:.6f}")
        logger.info(f"   - 99th percentile: {stats['percentile_99']:.6f}")
        
        self._send_detailed_message(f"Anomaly threshold calculated: {threshold:.6f} (95th percentile) in {duration:.2f}s", "success")
        self._send_detailed_message(f"Error statistics - Mean: {stats['mean_error']:.6f}, Std: {stats['std_error']:.6f}", "info")
        return stats
    
    def save_model(self, sensor_columns: List[str], training_stats: Dict):
        """Save the trained model and metadata with comprehensive logging."""
        self._send_progress(90, "Saving model and metadata...")
        self._send_detailed_message("Saving trained model...", "info")
        
        start_time = pd.Timestamp.now()
        logger.info(f"💾 Starting model save at {start_time}")
        logger.info(f"📁 Save directory: {self.model_dir}")
        
        try:
            # Save the trained model
            model_path = os.path.join(self.model_dir, 'model.h5')
            logger.info(f"💾 Saving model to: {model_path}")
            self.model.save(model_path)
            logger.info(f"✅ Model saved successfully: {os.path.getsize(model_path):,} bytes")
            self._send_detailed_message("Model saved successfully", "success")
            
            # Save the scaler
            scaler_path = os.path.join(self.model_dir, 'scaler.pkl')
            logger.info(f"💾 Saving scaler to: {scaler_path}")
            joblib.dump(self.scaler, scaler_path)
            logger.info(f"✅ Scaler saved successfully: {os.path.getsize(scaler_path):,} bytes")
            self._send_detailed_message("Data scaler saved", "success")
            
            # Save column configuration
            columns_path = os.path.join(self.model_dir, 'columns.json')
            logger.info(f"💾 Saving column config to: {columns_path}")
            with open(columns_path, 'w') as f:
                json.dump(sensor_columns, f, indent=2)
            logger.info(f"✅ Column config saved successfully: {os.path.getsize(columns_path):,} bytes")
            self._send_detailed_message("Column configuration saved", "success")
            
            # Save threshold configuration
            threshold_path = os.path.join(self.model_dir, 'threshold.json')
            logger.info(f"💾 Saving threshold config to: {threshold_path}")
            with open(threshold_path, 'w') as f:
                json.dump(training_stats, f, indent=2)
            logger.info(f"✅ Threshold config saved successfully: {os.path.getsize(threshold_path):,} bytes")
            
            # Save training statistics
            training_stats_path = os.path.join(self.model_dir, 'training_stats.json')
            logger.info(f"💾 Saving training stats to: {training_stats_path}")
            
            # Add metadata to training stats
            full_stats = {
                **training_stats,
                'sensor_columns': sensor_columns,
                'model_type': 'simple_autoencoder',
                'training_timestamp': pd.Timestamp.now().isoformat(),
                'model_path': model_path,
                'scaler_path': scaler_path,
                'columns_path': columns_path,
                'threshold_path': threshold_path
            }
            
            with open(training_stats_path, 'w') as f:
                json.dump(full_stats, f, indent=2)
            logger.info(f"✅ Training stats saved successfully: {os.path.getsize(training_stats_path):,} bytes")
            self._send_detailed_message("Training statistics saved", "success")
            
            end_time = pd.Timestamp.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"✅ All files saved successfully in {duration:.2f}s")
            logger.info(f"📁 Model directory contents:")
            for file in os.listdir(self.model_dir):
                file_path = os.path.join(self.model_dir, file)
                file_size = os.path.getsize(file_path)
                logger.info(f"   - {file}: {file_size:,} bytes")
            
            self._send_detailed_message("All files saved successfully!", "success")
            
        except Exception as e:
            logger.error(f"❌ Error saving model: {e}")
            self._send_detailed_message(f"Error saving model: {str(e)}", "error")
            raise
    
    def train(self, csv_path: str, sensor_columns: List[str]) -> Dict:
        """Complete training pipeline with comprehensive logging."""
        start_time = pd.Timestamp.now()
        logger.info(f"🚀 Starting complete training pipeline at {start_time}")
        logger.info(f"👤 User ID: {self.user_id}")
        logger.info(f"🔧 Machine ID: {self.machine_id}")
        logger.info(f"📁 CSV path: {csv_path}")
        logger.info(f"🎯 Sensor columns: {sensor_columns}")
        
        try:
            # Step 1: Load and preprocess data
            logger.info("=" * 50)
            logger.info("STEP 1: DATA PREPROCESSING")
            logger.info("=" * 50)
            X_train, final_sensor_columns = self.load_and_preprocess_data(csv_path, sensor_columns)
            
            # Step 2: Train the model
            logger.info("=" * 50)
            logger.info("STEP 2: MODEL TRAINING")
            logger.info("=" * 50)
            training_metrics = self.train_model(X_train)
            
            # Step 3: Calculate threshold
            logger.info("=" * 50)
            logger.info("STEP 3: THRESHOLD CALCULATION")
            logger.info("=" * 50)
            threshold_stats = self.calculate_threshold(X_train)
            
            # Step 4: Save everything
            logger.info("=" * 50)
            logger.info("STEP 4: SAVE MODEL AND METADATA")
            logger.info("=" * 50)
            self.save_model(final_sensor_columns, threshold_stats)
            
            # Combine all results
            final_result = {
                **training_metrics,
                **threshold_stats,
                'sensor_columns': final_sensor_columns,
                'model_type': 'simple_autoencoder'
            }
            
            end_time = pd.Timestamp.now()
            total_duration = (end_time - start_time).total_seconds()
            
            logger.info("=" * 50)
            logger.info("🎉 TRAINING PIPELINE COMPLETED SUCCESSFULLY")
            logger.info("=" * 50)
            logger.info(f"⏱️ Total training time: {total_duration:.2f} seconds")
            logger.info(f"📊 Final model metrics:")
            logger.info(f"   - Training loss: {final_result['final_loss']:.6f}")
            logger.info(f"   - Validation loss: {final_result['final_val_loss']:.6f}")
            logger.info(f"   - Anomaly threshold: {final_result['threshold']:.6f}")
            logger.info(f"   - Training samples: {final_result['training_samples']}")
            logger.info(f"   - Sensor columns: {len(final_result['sensor_columns'])}")
            logger.info(f"📁 Model saved to: {self.model_dir}")
            
            self._send_progress(100, "Training completed successfully!")
            self._send_detailed_message(f"🎉 Complete training pipeline finished in {total_duration:.2f}s!", "success")
            
            return final_result
            
        except Exception as e:
            logger.error(f"❌ Training pipeline failed: {e}")
            logger.error(f"❌ Error details: {str(e)}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            self._send_detailed_message(f"Training pipeline failed: {str(e)}", "error")
            raise
    
    def _load_pretrained_config(self) -> Dict:
        """Load pretrained model configuration."""
        try:
            config_path = os.path.join(os.path.dirname(__file__), 'pretrained_config.json')
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    config = json.load(f)
                logger.info(f"✅ Loaded pretrained config from {config_path}")
                return config.get('pretrained_model', {})
            else:
                logger.warning(f"⚠️ Pretrained config not found at {config_path}")
                return {}
        except Exception as e:
            logger.error(f"❌ Error loading pretrained config: {e}")
            return {}
    
    def _load_pretrained_model(self, input_shape: int) -> Sequential:
        """Load pretrained model weights if available and compatible."""
        try:
            if not self.pretrained_config:
                logger.info("🔄 No pretrained config available, building new model")
                return None
            
            # Check if we have a compatible pretrained model
            pretrained_columns = self.pretrained_config.get('trained_columns', [])
            if len(pretrained_columns) != input_shape:
                logger.info(f"🔄 Pretrained model has {len(pretrained_columns)} sensors, current data has {input_shape} sensors")
                logger.info("🔄 Building new model due to sensor count mismatch")
                return None
            
            # Try to load the pretrained model
            pretrained_model_path = os.path.join(os.path.dirname(__file__), self.pretrained_config.get('model_path', ''))
            if os.path.exists(pretrained_model_path):
                logger.info(f"🔄 Loading pretrained model from {pretrained_model_path}")
                pretrained_model = tf.keras.models.load_model(pretrained_model_path)
                
                # Verify the model architecture is compatible
                if pretrained_model.layers[0].input_shape[1] == input_shape:
                    logger.info(f"✅ Pretrained model loaded successfully with {input_shape} input features")
                    return pretrained_model
                else:
                    logger.warning(f"⚠️ Pretrained model input shape mismatch: expected {input_shape}, got {pretrained_model.layers[0].input_shape[1]}")
            else:
                logger.warning(f"⚠️ Pretrained model file not found at {pretrained_model_path}")
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error loading pretrained model: {e}")
            return None
    
    def _load_pretrained_scaler(self) -> StandardScaler:
        """Load pretrained scaler if available."""
        try:
            if not self.pretrained_config:
                return None
            
            pretrained_scaler_path = os.path.join(os.path.dirname(__file__), self.pretrained_config.get('scaler_path', ''))
            if os.path.exists(pretrained_scaler_path):
                logger.info(f"🔄 Loading pretrained scaler from {pretrained_scaler_path}")
                scaler = joblib.load(pretrained_scaler_path)
                logger.info(f"✅ Pretrained scaler loaded successfully")
                return scaler
            else:
                logger.warning(f"⚠️ Pretrained scaler file not found at {pretrained_scaler_path}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error loading pretrained scaler: {e}")
            return None

def main():
    """Main function with comprehensive logging and error handling."""
    start_time = pd.Timestamp.now()
    logger.info("=" * 60)
    logger.info("🚀 ULTRA-SIMPLE TRAINER STARTED")
    logger.info("=" * 60)
    logger.info(f"⏰ Start time: {start_time}")
    logger.info(f"📁 Working directory: {os.getcwd()}")
    logger.info(f"🐍 Python executable: {sys.executable}")
    
    try:
        # Parse command line arguments
        if len(sys.argv) != 4:
            logger.error(f"❌ Invalid number of arguments. Expected 3, got {len(sys.argv) - 1}")
            logger.error(f"❌ Usage: python simple_trainer.py <user_id> <machine_id> <csv_path>")
            logger.error(f"❌ Arguments received: {sys.argv[1:]}")
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
        
        # Create trainer and run training
        logger.info("🏗️ Creating UltraSimpleTrainer instance...")
        trainer = UltraSimpleTrainer(user_id, machine_id)
        
        logger.info("🎯 Starting training process...")
        result = trainer.train(csv_path, [])  # Empty list for auto-detection
        
        # Log final success
        end_time = pd.Timestamp.now()
        total_duration = (end_time - start_time).total_seconds()
        
        logger.info("=" * 60)
        logger.info("✅ TRAINING COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        logger.info(f"⏱️ Total execution time: {total_duration:.2f} seconds")
        logger.info(f"📊 Training result: {result}")
        
        # Send success message to Node.js
        success_data = {
            "type": "success",
            "stats": result,
            "timestamp": pd.Timestamp.now().isoformat()
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
            "timestamp": pd.Timestamp.now().isoformat()
        }
        print(f"ERROR:{json.dumps(error_data)}")
        
        logger.error("💥 Exiting with error")
        sys.exit(1)

if __name__ == "__main__":
    main() 
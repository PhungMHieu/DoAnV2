"""Configuration for ML Service"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR.parent.parent.parent / "data"
MODEL_DIR = BASE_DIR / "models"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

# Model files
VECTORIZER_PATH = MODEL_DIR / "tfidf_vectorizer.joblib"
MODEL_PATH = MODEL_DIR / "svm_classifier.joblib"
LABEL_ENCODER_PATH = MODEL_DIR / "label_encoder.joblib"

# Training data
TRAINING_DATA_PATH = BASE_DIR / "data" / "training_data.json"

# Categories (must match NestJS)
CATEGORIES = [
    "income",
    "food",
    "transportation",
    "entertainment",
    "shopping",
    "health",
    "education",
    "utilities",
    "home",
    "personal",
    "travel",
    "investment",
    "family",
    "houseware",
    "donation",
    "charity",
    "other",
]

# Model parameters
TFIDF_PARAMS = {
    "max_features": 5000,
    "ngram_range": (1, 3),  # Unigrams, bigrams, trigrams
    "min_df": 2,
    "max_df": 0.95,
    "sublinear_tf": True,
}

SVM_PARAMS = {
    "C": 1.0,
    "kernel": "linear",
    "probability": True,
    "class_weight": "balanced",
}

# Minimum samples required to train
MIN_SAMPLES_TO_TRAIN = 50
MIN_SAMPLES_PER_CATEGORY = 3

# API Config
API_HOST = os.getenv("ML_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("ML_API_PORT", "5000"))

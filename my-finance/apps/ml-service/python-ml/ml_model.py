"""ML Model for category classification using TF-IDF + SVM"""
import json
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score

from config import (
    VECTORIZER_PATH,
    MODEL_PATH,
    LABEL_ENCODER_PATH,
    TRAINING_DATA_PATH,
    TFIDF_PARAMS,
    SVM_PARAMS,
    MIN_SAMPLES_TO_TRAIN,
    MIN_SAMPLES_PER_CATEGORY,
    CATEGORIES,
)
from text_processor import preprocess_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CategoryClassifier:
    """TF-IDF + SVM classifier for transaction categories"""

    def __init__(self):
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.model: Optional[SVC] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.is_trained = False

        # Try to load existing model
        self._load_model()

    def _load_model(self) -> bool:
        """Load pre-trained model if exists"""
        try:
            if (
                VECTORIZER_PATH.exists()
                and MODEL_PATH.exists()
                and LABEL_ENCODER_PATH.exists()
            ):
                self.vectorizer = joblib.load(VECTORIZER_PATH)
                self.model = joblib.load(MODEL_PATH)
                self.label_encoder = joblib.load(LABEL_ENCODER_PATH)
                self.is_trained = True
                logger.info("Loaded pre-trained model successfully")
                return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")

        return False

    def _save_model(self):
        """Save trained model to disk"""
        try:
            joblib.dump(self.vectorizer, VECTORIZER_PATH)
            joblib.dump(self.model, MODEL_PATH)
            joblib.dump(self.label_encoder, LABEL_ENCODER_PATH)
            logger.info("Model saved successfully")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")

    def load_training_data(self) -> tuple[list[str], list[str]]:
        """Load training data from JSON file"""
        if not TRAINING_DATA_PATH.exists():
            logger.warning(f"Training data not found at {TRAINING_DATA_PATH}")
            return [], []

        try:
            with open(TRAINING_DATA_PATH, "r", encoding="utf-8") as f:
                records = json.load(f)

            texts = []
            labels = []

            for record in records:
                text = record.get("text", "")
                # Use corrected category as the label
                category = record.get("correctedCategory", record.get("category", ""))

                if text and category and category in CATEGORIES:
                    texts.append(preprocess_text(text))
                    labels.append(category)

            logger.info(f"Loaded {len(texts)} training samples")
            return texts, labels

        except Exception as e:
            logger.error(f"Failed to load training data: {e}")
            return [], []

    def train(self, texts: list[str] = None, labels: list[str] = None) -> dict:
        """
        Train the model

        Args:
            texts: List of preprocessed texts (optional, will load from file if not provided)
            labels: List of category labels

        Returns:
            Training metrics
        """
        # Load data if not provided
        if texts is None or labels is None:
            texts, labels = self.load_training_data()

        if len(texts) < MIN_SAMPLES_TO_TRAIN:
            return {
                "success": False,
                "error": f"Not enough training data. Need at least {MIN_SAMPLES_TO_TRAIN} samples, got {len(texts)}",
            }

        # Check samples per category
        from collections import Counter
        category_counts = Counter(labels)
        low_count_categories = [
            cat for cat, count in category_counts.items()
            if count < MIN_SAMPLES_PER_CATEGORY
        ]

        if low_count_categories:
            logger.warning(
                f"Categories with low sample count: {low_count_categories}"
            )

        # Initialize components
        self.vectorizer = TfidfVectorizer(**TFIDF_PARAMS)
        self.label_encoder = LabelEncoder()
        self.model = SVC(**SVM_PARAMS)

        # Encode labels
        encoded_labels = self.label_encoder.fit_transform(labels)

        # Vectorize text
        X = self.vectorizer.fit_transform(texts)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, encoded_labels, test_size=0.2, random_state=42, stratify=encoded_labels
        )

        # Train model
        logger.info("Training SVM model...")
        self.model.fit(X_train, y_train)

        # Evaluate
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)

        # Cross-validation
        cv_scores = cross_val_score(self.model, X, encoded_labels, cv=5)

        # Classification report
        report = classification_report(
            y_test,
            y_pred,
            target_names=self.label_encoder.classes_,
            output_dict=True,
        )

        self.is_trained = True
        self._save_model()

        metrics = {
            "success": True,
            "accuracy": float(accuracy),
            "cv_mean": float(cv_scores.mean()),
            "cv_std": float(cv_scores.std()),
            "samples": len(texts),
            "categories": len(self.label_encoder.classes_),
            "classification_report": report,
        }

        logger.info(
            f"Training complete. Accuracy: {accuracy:.2%}, CV: {cv_scores.mean():.2%} (+/- {cv_scores.std():.2%})"
        )

        return metrics

    def predict(
        self, text: str, top_k: int = 5
    ) -> dict:
        """
        Predict category for a single text

        Args:
            text: Transaction text
            top_k: Number of top predictions to return

        Returns:
            Prediction with confidence and suggestions
        """
        if not self.is_trained:
            return {
                "category": "other",
                "confidence": 0.0,
                "suggestions": [],
                "model": "ml-svm-v1",
                "error": "Model not trained",
            }

        # Preprocess
        processed = preprocess_text(text)

        # Vectorize
        X = self.vectorizer.transform([processed])

        # Predict with probabilities
        proba = self.model.predict_proba(X)[0]

        # Get top predictions
        top_indices = np.argsort(proba)[::-1][:top_k]
        top_categories = self.label_encoder.inverse_transform(top_indices)
        top_confidences = proba[top_indices]

        suggestions = [
            {"category": cat, "confidence": float(conf)}
            for cat, conf in zip(top_categories, top_confidences)
        ]

        return {
            "category": suggestions[0]["category"],
            "confidence": suggestions[0]["confidence"],
            "suggestions": suggestions,
            "model": "ml-svm-v1",
        }

    def batch_predict(
        self, texts: list[str], top_k: int = 5
    ) -> list[dict]:
        """Predict categories for multiple texts"""
        return [self.predict(text, top_k) for text in texts]

    def get_model_info(self) -> dict:
        """Get information about the current model"""
        if not self.is_trained:
            return {
                "is_trained": False,
                "message": "Model not trained yet",
            }

        return {
            "is_trained": True,
            "categories": list(self.label_encoder.classes_),
            "n_categories": len(self.label_encoder.classes_),
            "vectorizer_features": len(self.vectorizer.get_feature_names_out()),
            "model_type": "SVM",
            "kernel": SVM_PARAMS["kernel"],
        }


# Singleton instance
_classifier: Optional[CategoryClassifier] = None


def get_classifier() -> CategoryClassifier:
    """Get or create classifier instance"""
    global _classifier
    if _classifier is None:
        _classifier = CategoryClassifier()
    return _classifier


if __name__ == "__main__":
    # Test the classifier
    classifier = get_classifier()

    # If model exists, test prediction
    if classifier.is_trained:
        test_texts = [
            "ăn phở sáng",
            "đi grab về nhà",
            "mua quần áo shopee",
            "tiền điện tháng 12",
        ]

        print("\nPrediction tests:")
        for text in test_texts:
            result = classifier.predict(text)
            print(f"  {text!r}")
            print(f"    -> {result['category']} ({result['confidence']:.2%})")
    else:
        print("Model not trained. Run training first.")
        print(f"Training data path: {TRAINING_DATA_PATH}")

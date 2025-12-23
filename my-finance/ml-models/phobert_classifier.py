"""
PhoBERT Classifier for Vietnamese Transaction Categorization
Using vinai/phobert-base pre-trained model
"""

import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer
from typing import List, Dict, Tuple
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PhoBERTTransactionClassifier(nn.Module):
    """
    PhoBERT-based classifier for transaction categorization
    """

    def __init__(self, num_classes: int = 11, dropout: float = 0.3):
        super().__init__()

        # Load pre-trained PhoBERT
        self.phobert = AutoModel.from_pretrained("vinai/phobert-base")
        self.tokenizer = AutoTokenizer.from_pretrained("vinai/phobert-base")

        # Freeze PhoBERT layers initially (for transfer learning)
        for param in self.phobert.parameters():
            param.requires_grad = False

        # Classification head
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Sequential(
            nn.Linear(768, 256),  # PhoBERT hidden size = 768
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_classes),
        )

    def unfreeze_phobert(self, num_layers: int = 2):
        """
        Unfreeze last N layers of PhoBERT for fine-tuning
        """
        # Unfreeze last num_layers encoder layers
        for i, layer in enumerate(reversed(list(self.phobert.encoder.layer))):
            if i < num_layers:
                for param in layer.parameters():
                    param.requires_grad = True
                logger.info(f"Unfroze PhoBERT layer {len(self.phobert.encoder.layer) - i - 1}")

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        """
        Forward pass
        Args:
            input_ids: Token IDs [batch_size, seq_len]
            attention_mask: Attention mask [batch_size, seq_len]
        Returns:
            logits: [batch_size, num_classes]
        """
        # Get PhoBERT embeddings
        outputs = self.phobert(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )

        # Use [CLS] token embedding
        cls_embedding = outputs.last_hidden_state[:, 0, :]  # [batch_size, 768]

        # Classification
        cls_embedding = self.dropout(cls_embedding)
        logits = self.classifier(cls_embedding)  # [batch_size, num_classes]

        return logits

    def predict(
        self,
        texts: List[str],
        batch_size: int = 32,
        device: str = "cpu",
    ) -> Tuple[List[int], List[float], List[List[float]]]:
        """
        Predict categories for a batch of texts
        Args:
            texts: List of transaction notes
            batch_size: Batch size for inference
            device: 'cpu' or 'cuda'
        Returns:
            predictions: List of predicted class indices
            confidences: List of confidence scores (max probability)
            probabilities: List of probability distributions
        """
        self.eval()
        self.to(device)

        all_predictions = []
        all_confidences = []
        all_probabilities = []

        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i : i + batch_size]

                # Tokenize
                encoded = self.tokenizer(
                    batch_texts,
                    padding=True,
                    truncation=True,
                    max_length=128,
                    return_tensors="pt",
                )

                input_ids = encoded["input_ids"].to(device)
                attention_mask = encoded["attention_mask"].to(device)

                # Forward pass
                logits = self.forward(input_ids, attention_mask)

                # Get probabilities
                probs = torch.softmax(logits, dim=-1)

                # Get predictions
                confidences, predictions = torch.max(probs, dim=-1)

                all_predictions.extend(predictions.cpu().tolist())
                all_confidences.extend(confidences.cpu().tolist())
                all_probabilities.extend(probs.cpu().tolist())

        return all_predictions, all_confidences, all_probabilities


class CategoryMapper:
    """
    Maps between category names and indices
    """

    # Must match the categories in category.constants.ts
    CATEGORIES = [
        "income",
        "food",
        "transport",
        "entertainment",
        "shopping",
        "healthcare",
        "education",
        "bills",
        "housing",
        "personal",
        "other",
    ]

    @classmethod
    def to_index(cls, category: str) -> int:
        """Convert category name to index"""
        return cls.CATEGORIES.index(category)

    @classmethod
    def to_category(cls, index: int) -> str:
        """Convert index to category name"""
        return cls.CATEGORIES[index]

    @classmethod
    def num_classes(cls) -> int:
        """Number of categories"""
        return len(cls.CATEGORIES)


# Example usage
if __name__ == "__main__":
    # Initialize model
    model = PhoBERTTransactionClassifier(num_classes=CategoryMapper.num_classes())

    # Example predictions
    texts = [
        "Mua cơm trưa quán Phở 24",
        "Grab về nhà",
        "Netflix subscription",
        "Tiền lương tháng 12",
    ]

    predictions, confidences, probabilities = model.predict(texts)

    for text, pred_idx, conf, probs in zip(texts, predictions, confidences, probabilities):
        category = CategoryMapper.to_category(pred_idx)
        print(f"\nText: {text}")
        print(f"Predicted: {category} (confidence: {conf:.2%})")
        print("Top 3 predictions:")
        top3_indices = np.argsort(probs)[-3:][::-1]
        for idx in top3_indices:
            print(f"  - {CategoryMapper.to_category(idx)}: {probs[idx]:.2%}")

"""
Training script for PhoBERT Transaction Classifier
"""

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from transformers import get_linear_schedule_with_warmup
import json
from pathlib import Path
from typing import List, Dict, Tuple
import logging
from tqdm import tqdm
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns

from phobert_classifier import PhoBERTTransactionClassifier, CategoryMapper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TransactionDataset(Dataset):
    """
    PyTorch Dataset for transaction categorization
    """

    def __init__(self, data_path: str, tokenizer, max_length: int = 128):
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.samples = []

        # Load data
        with open(data_path, "r", encoding="utf-8") as f:
            for line in f:
                sample = json.loads(line)
                self.samples.append(sample)

        logger.info(f"Loaded {len(self.samples)} samples from {data_path}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        sample = self.samples[idx]
        text = sample["text"]
        label = CategoryMapper.to_index(sample["label"])

        # Tokenize
        encoded = self.tokenizer(
            text,
            padding="max_length",
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )

        return {
            "input_ids": encoded["input_ids"].squeeze(0),
            "attention_mask": encoded["attention_mask"].squeeze(0),
            "label": torch.tensor(label, dtype=torch.long),
        }


class PhoBERTTrainer:
    """
    Trainer for PhoBERT model
    """

    def __init__(
        self,
        model: PhoBERTTransactionClassifier,
        train_dataloader: DataLoader,
        val_dataloader: DataLoader,
        device: str = "cpu",
        learning_rate: float = 2e-5,
        num_epochs: int = 5,
    ):
        self.model = model.to(device)
        self.train_dataloader = train_dataloader
        self.val_dataloader = val_dataloader
        self.device = device
        self.num_epochs = num_epochs

        # Optimizer
        self.optimizer = AdamW(model.parameters(), lr=learning_rate)

        # Learning rate scheduler
        total_steps = len(train_dataloader) * num_epochs
        self.scheduler = get_linear_schedule_with_warmup(
            self.optimizer,
            num_warmup_steps=int(0.1 * total_steps),
            num_training_steps=total_steps,
        )

        # Loss function
        self.criterion = nn.CrossEntropyLoss()

        # Metrics
        self.train_losses = []
        self.val_losses = []
        self.val_accuracies = []

    def train_epoch(self) -> float:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0
        progress_bar = tqdm(self.train_dataloader, desc="Training")

        for batch in progress_bar:
            # Move to device
            input_ids = batch["input_ids"].to(self.device)
            attention_mask = batch["attention_mask"].to(self.device)
            labels = batch["label"].to(self.device)

            # Forward pass
            logits = self.model(input_ids, attention_mask)
            loss = self.criterion(logits, labels)

            # Backward pass
            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()
            self.scheduler.step()

            total_loss += loss.item()
            progress_bar.set_postfix({"loss": f"{loss.item():.4f}"})

        avg_loss = total_loss / len(self.train_dataloader)
        return avg_loss

    def validate(self) -> Tuple[float, float]:
        """Validate model"""
        self.model.eval()
        total_loss = 0
        correct = 0
        total = 0

        all_preds = []
        all_labels = []

        with torch.no_grad():
            for batch in tqdm(self.val_dataloader, desc="Validation"):
                input_ids = batch["input_ids"].to(self.device)
                attention_mask = batch["attention_mask"].to(self.device)
                labels = batch["label"].to(self.device)

                logits = self.model(input_ids, attention_mask)
                loss = self.criterion(logits, labels)

                total_loss += loss.item()

                _, predicted = torch.max(logits, dim=-1)
                correct += (predicted == labels).sum().item()
                total += labels.size(0)

                all_preds.extend(predicted.cpu().tolist())
                all_labels.extend(labels.cpu().tolist())

        avg_loss = total_loss / len(self.val_dataloader)
        accuracy = correct / total

        return avg_loss, accuracy, all_preds, all_labels

    def train(self):
        """Full training loop"""
        logger.info("🚀 Starting training...")

        best_accuracy = 0
        best_model_path = "models/phobert_best.pt"
        Path("models").mkdir(exist_ok=True)

        for epoch in range(self.num_epochs):
            logger.info(f"\n📍 Epoch {epoch + 1}/{self.num_epochs}")

            # Train
            train_loss = self.train_epoch()
            self.train_losses.append(train_loss)

            # Validate
            val_loss, val_accuracy, all_preds, all_labels = self.validate()
            self.val_losses.append(val_loss)
            self.val_accuracies.append(val_accuracy)

            logger.info(
                f"Train Loss: {train_loss:.4f} | "
                f"Val Loss: {val_loss:.4f} | "
                f"Val Accuracy: {val_accuracy:.4f}"
            )

            # Save best model
            if val_accuracy > best_accuracy:
                best_accuracy = val_accuracy
                torch.save(self.model.state_dict(), best_model_path)
                logger.info(f"✅ Saved best model (accuracy: {best_accuracy:.4f})")

        logger.info(f"\n🎉 Training completed!")
        logger.info(f"📊 Best Validation Accuracy: {best_accuracy:.4f}")

        # Print classification report
        logger.info("\n📋 Classification Report:")
        print(
            classification_report(
                all_labels,
                all_preds,
                target_names=CategoryMapper.CATEGORIES,
                digits=4,
            )
        )

        # Plot confusion matrix
        self.plot_confusion_matrix(all_labels, all_preds)

        # Plot training curves
        self.plot_training_curves()

    def plot_confusion_matrix(self, true_labels, predicted_labels):
        """Plot confusion matrix"""
        cm = confusion_matrix(true_labels, predicted_labels)

        plt.figure(figsize=(12, 10))
        sns.heatmap(
            cm,
            annot=True,
            fmt="d",
            cmap="Blues",
            xticklabels=CategoryMapper.CATEGORIES,
            yticklabels=CategoryMapper.CATEGORIES,
        )
        plt.title("Confusion Matrix")
        plt.ylabel("True Label")
        plt.xlabel("Predicted Label")
        plt.xticks(rotation=45, ha="right")
        plt.yticks(rotation=0)
        plt.tight_layout()
        plt.savefig("models/confusion_matrix.png")
        logger.info("📊 Confusion matrix saved to models/confusion_matrix.png")
        plt.close()

    def plot_training_curves(self):
        """Plot training curves"""
        epochs = range(1, len(self.train_losses) + 1)

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 5))

        # Loss curve
        ax1.plot(epochs, self.train_losses, "b-", label="Train Loss")
        ax1.plot(epochs, self.val_losses, "r-", label="Val Loss")
        ax1.set_title("Loss Curve")
        ax1.set_xlabel("Epoch")
        ax1.set_ylabel("Loss")
        ax1.legend()
        ax1.grid(True)

        # Accuracy curve
        ax2.plot(epochs, self.val_accuracies, "g-", label="Val Accuracy")
        ax2.set_title("Validation Accuracy")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Accuracy")
        ax2.legend()
        ax2.grid(True)

        plt.tight_layout()
        plt.savefig("models/training_curves.png")
        logger.info("📈 Training curves saved to models/training_curves.png")
        plt.close()


def main():
    """Main training function"""

    # Hyperparameters
    BATCH_SIZE = 32
    LEARNING_RATE = 2e-5
    NUM_EPOCHS = 5
    MAX_LENGTH = 128
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

    logger.info(f"🖥️  Using device: {DEVICE}")

    # Initialize model
    model = PhoBERTTransactionClassifier(
        num_classes=CategoryMapper.num_classes(),
        dropout=0.3,
    )

    # Optionally unfreeze last layers for fine-tuning
    model.unfreeze_phobert(num_layers=2)

    # Load datasets
    train_dataset = TransactionDataset(
        "data/training_data.jsonl",
        model.tokenizer,
        max_length=MAX_LENGTH,
    )

    # Split into train/val (80/20)
    train_size = int(0.8 * len(train_dataset))
    val_size = len(train_dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(
        train_dataset, [train_size, val_size]
    )

    logger.info(f"📊 Train size: {train_size}, Val size: {val_size}")

    # Create dataloaders
    train_dataloader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=0,  # Set to 0 for Windows compatibility
    )

    val_dataloader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0,
    )

    # Train
    trainer = PhoBERTTrainer(
        model=model,
        train_dataloader=train_dataloader,
        val_dataloader=val_dataloader,
        device=DEVICE,
        learning_rate=LEARNING_RATE,
        num_epochs=NUM_EPOCHS,
    )

    trainer.train()

    logger.info("✨ Training complete!")


if __name__ == "__main__":
    main()

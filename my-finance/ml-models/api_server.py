"""
FastAPI server for PhoBERT model inference
Serves ML predictions via REST API
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import torch
import logging
from pathlib import Path

from phobert_classifier import PhoBERTTransactionClassifier, CategoryMapper

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PhoBERT Transaction Classifier API",
    description="ML API for transaction categorization using PhoBERT",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model = None
device = "cuda" if torch.cuda.is_available() else "cpu"


# Request/Response Models
class PredictRequest(BaseModel):
    note: str = Field(..., description="Transaction description", example="Mua cơm trưa quán Phở 24")
    amount: Optional[float] = Field(None, description="Transaction amount", example=50000)


class CategoryPrediction(BaseModel):
    category: str = Field(..., description="Predicted category", example="food")
    confidence: float = Field(..., description="Confidence score (0-1)", example=0.92)


class PredictResponse(BaseModel):
    category: str = Field(..., description="Top predicted category")
    confidence: float = Field(..., description="Confidence for top prediction")
    suggestions: List[CategoryPrediction] = Field(
        ..., description="Top 5 category suggestions"
    )
    model: str = Field(..., description="Model identifier")


class BatchPredictRequest(BaseModel):
    items: List[PredictRequest]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    num_classes: int


# Load model on startup
@app.on_event("startup")
async def load_model():
    """Load PhoBERT model on startup"""
    global model

    try:
        logger.info("🚀 Loading PhoBERT model...")

        # Initialize model
        model = PhoBERTTransactionClassifier(
            num_classes=CategoryMapper.num_classes(),
            dropout=0.3,
        )

        # Load trained weights if available
        model_path = Path("models/phobert_best.pt")
        if model_path.exists():
            model.load_state_dict(
                torch.load(model_path, map_location=device)
            )
            logger.info(f"✅ Loaded trained model from {model_path}")
        else:
            logger.warning(
                "⚠️  No trained model found. Using pre-trained PhoBERT only."
            )

        model.to(device)
        model.eval()

        logger.info(f"✨ Model loaded successfully on {device}")

    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        raise


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": device,
        "num_classes": CategoryMapper.num_classes(),
    }


@app.post("/predict", response_model=PredictResponse)
async def predict_category(request: PredictRequest):
    """
    Predict transaction category using PhoBERT

    Args:
        request: PredictRequest with note and optional amount

    Returns:
        PredictResponse with predicted category and confidence
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Predict
        texts = [request.note]
        predictions, confidences, probabilities = model.predict(
            texts, batch_size=1, device=device
        )

        pred_idx = predictions[0]
        confidence = confidences[0]
        probs = probabilities[0]

        # Get top 5 suggestions
        top5_indices = sorted(
            range(len(probs)), key=lambda i: probs[i], reverse=True
        )[:5]

        suggestions = [
            CategoryPrediction(
                category=CategoryMapper.to_category(idx),
                confidence=float(probs[idx]),
            )
            for idx in top5_indices
        ]

        return PredictResponse(
            category=CategoryMapper.to_category(pred_idx),
            confidence=float(confidence),
            suggestions=suggestions,
            model="phobert-base-v1",
        )

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-predict", response_model=List[PredictResponse])
async def batch_predict_categories(request: BatchPredictRequest):
    """
    Batch predict transaction categories

    Args:
        request: BatchPredictRequest with list of items

    Returns:
        List of PredictResponse
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        texts = [item.note for item in request.items]

        # Batch prediction
        predictions, confidences, probabilities = model.predict(
            texts, batch_size=32, device=device
        )

        responses = []
        for pred_idx, confidence, probs in zip(
            predictions, confidences, probabilities
        ):
            # Get top 5 suggestions
            top5_indices = sorted(
                range(len(probs)), key=lambda i: probs[i], reverse=True
            )[:5]

            suggestions = [
                CategoryPrediction(
                    category=CategoryMapper.to_category(idx),
                    confidence=float(probs[idx]),
                )
                for idx in top5_indices
            ]

            responses.append(
                PredictResponse(
                    category=CategoryMapper.to_category(pred_idx),
                    confidence=float(confidence),
                    suggestions=suggestions,
                    model="phobert-base-v1",
                )
            )

        return responses

    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/categories")
async def get_categories():
    """Get list of supported categories"""
    return {
        "categories": CategoryMapper.CATEGORIES,
        "count": CategoryMapper.num_classes(),
    }


# Main entry point
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )

"""FastAPI server for ML predictions"""
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import API_HOST, API_PORT
from ml_model import get_classifier

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Category Classifier ML API",
    description="TF-IDF + SVM based category classification for transactions",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class PredictRequest(BaseModel):
    text: str = Field(..., description="Transaction text to classify")
    amount: Optional[float] = Field(None, description="Transaction amount (optional)")


class PredictResponse(BaseModel):
    category: str
    confidence: float
    suggestions: list[dict]
    model: str


class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(..., description="List of transaction texts")


class BatchPredictResponse(BaseModel):
    predictions: list[PredictResponse]


class TrainRequest(BaseModel):
    force: bool = Field(False, description="Force retrain even if model exists")


class TrainResponse(BaseModel):
    success: bool
    accuracy: Optional[float] = None
    cv_mean: Optional[float] = None
    cv_std: Optional[float] = None
    samples: Optional[int] = None
    categories: Optional[int] = None
    error: Optional[str] = None


class ModelInfoResponse(BaseModel):
    is_trained: bool
    categories: Optional[list[str]] = None
    n_categories: Optional[int] = None
    vectorizer_features: Optional[int] = None
    model_type: Optional[str] = None
    kernel: Optional[str] = None
    message: Optional[str] = None


# Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    classifier = get_classifier()
    return {
        "status": "healthy",
        "model_loaded": classifier.is_trained,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """Predict category for a single transaction"""
    classifier = get_classifier()

    if not classifier.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Model not trained. Please train the model first.",
        )

    result = classifier.predict(request.text)
    return PredictResponse(**result)


@app.post("/batch-predict", response_model=BatchPredictResponse)
async def batch_predict(request: BatchPredictRequest):
    """Predict categories for multiple transactions"""
    classifier = get_classifier()

    if not classifier.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Model not trained. Please train the model first.",
        )

    results = classifier.batch_predict(request.texts)
    return BatchPredcictResponse(
        predictions=[PredictResponse(**r) for r in results]
    )


@app.post("/train", response_model=TrainResponse)
async def train_model(request: TrainRequest):
    """Train or retrain the model"""
    classifier = get_classifier()

    if classifier.is_trained and not request.force:
        return TrainResponse(
            success=True,
            error="Model already trained. Use force=true to retrain.",
        )

    result = classifier.train()

    if result.get("success"):
        return TrainResponse(
            success=True,
            accuracy=result.get("accuracy"),
            cv_mean=result.get("cv_mean"),
            cv_std=result.get("cv_std"),
            samples=result.get("samples"),
            categories=result.get("categories"),
        )
    else:
        return TrainResponse(
            success=False,
            error=result.get("error"),
        )


@app.get("/model-info", response_model=ModelInfoResponse)
async def get_model_info():
    """Get information about the current model"""
    classifier = get_classifier()
    info = classifier.get_model_info()
    return ModelInfoResponse(**info)


@app.post("/reload")
async def reload_model():
    """Reload model from disk"""
    classifier = get_classifier()
    success = classifier._load_model()
    return {
        "success": success,
        "is_trained": classifier.is_trained,
    }


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting ML API server on {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT)

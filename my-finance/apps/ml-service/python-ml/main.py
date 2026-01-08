"""Main entry point - runs both HTTP (health check) and gRPC servers"""
import logging
import threading
import signal
import sys
from concurrent import futures

import grpc
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import API_HOST, API_PORT
from ml_model import get_classifier
import ml_service_pb2
import ml_service_pb2_grpc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# gRPC port
GRPC_PORT = 50051

# ============== gRPC Server ==============

class MlClassifierServicer(ml_service_pb2_grpc.MlClassifierServicer):
    """gRPC service implementation for ML Classifier"""

    def Predict(self, request, context):
        """Predict category for a single transaction"""
        classifier = get_classifier()

        if not classifier.is_trained:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Model not trained. Please train the model first.")
            return ml_service_pb2.PredictResponse()

        result = classifier.predict(request.text)

        suggestions = [
            ml_service_pb2.Suggestion(
                category=s["category"],
                confidence=s["confidence"]
            )
            for s in result.get("suggestions", [])
        ]

        return ml_service_pb2.PredictResponse(
            category=result["category"],
            confidence=result["confidence"],
            suggestions=suggestions,
            model=result.get("model", "ml-svm-v1")
        )

    def BatchPredict(self, request, context):
        """Predict categories for multiple transactions"""
        classifier = get_classifier()

        if not classifier.is_trained:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Model not trained. Please train the model first.")
            return ml_service_pb2.BatchPredictResponse()

        results = classifier.batch_predict(list(request.texts))

        predictions = []
        for result in results:
            suggestions = [
                ml_service_pb2.Suggestion(
                    category=s["category"],
                    confidence=s["confidence"]
                )
                for s in result.get("suggestions", [])
            ]

            predictions.append(
                ml_service_pb2.PredictResponse(
                    category=result["category"],
                    confidence=result["confidence"],
                    suggestions=suggestions,
                    model=result.get("model", "ml-svm-v1")
                )
            )

        return ml_service_pb2.BatchPredictResponse(predictions=predictions)

    def Train(self, request, context):
        """Train or retrain the model"""
        classifier = get_classifier()

        if classifier.is_trained and not request.force:
            return ml_service_pb2.TrainResponse(
                success=True,
                error="Model already trained. Use force=true to retrain."
            )

        result = classifier.train()

        if result.get("success"):
            return ml_service_pb2.TrainResponse(
                success=True,
                accuracy=result.get("accuracy"),
                cv_mean=result.get("cv_mean"),
                cv_std=result.get("cv_std"),
                samples=result.get("samples"),
                categories=result.get("categories")
            )
        else:
            return ml_service_pb2.TrainResponse(
                success=False,
                error=result.get("error")
            )

    def CheckHealth(self, request, context):
        """Health check endpoint"""
        classifier = get_classifier()
        return ml_service_pb2.HealthResponse(
            status="healthy",
            model_loaded=classifier.is_trained
        )

    def GetModelInfo(self, request, context):
        """Get information about the current model"""
        classifier = get_classifier()
        info = classifier.get_model_info()

        return ml_service_pb2.ModelInfoResponse(
            is_trained=info.get("is_trained", False),
            categories=info.get("categories", []),
            n_categories=info.get("n_categories"),
            vectorizer_features=info.get("vectorizer_features"),
            model_type=info.get("model_type"),
            kernel=info.get("kernel"),
            message=info.get("message")
        )

    def ReloadModel(self, request, context):
        """Reload model from disk"""
        classifier = get_classifier()
        success = classifier._load_model()
        return ml_service_pb2.ReloadResponse(
            success=success,
            is_trained=classifier.is_trained
        )


# ============== HTTP Server (Health Check) ==============

app = FastAPI(title="ML Health Check", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker"""
    classifier = get_classifier()
    return {
        "status": "healthy",
        "model_loaded": classifier.is_trained,
        "grpc_port": GRPC_PORT,
    }


# ============== Main ==============

grpc_server = None


def run_grpc_server():
    """Run gRPC server in a thread"""
    global grpc_server
    grpc_server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_send_message_length", 50 * 1024 * 1024),
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
        ]
    )

    ml_service_pb2_grpc.add_MlClassifierServicer_to_server(
        MlClassifierServicer(), grpc_server
    )

    server_address = f"{API_HOST}:{GRPC_PORT}"
    grpc_server.add_insecure_port(server_address)

    logger.info(f"Starting gRPC ML server on {server_address}")
    grpc_server.start()
    grpc_server.wait_for_termination()


def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logger.info("Shutting down servers...")
    if grpc_server:
        grpc_server.stop(grace=5)
    sys.exit(0)


if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start gRPC server in a thread
    grpc_thread = threading.Thread(target=run_grpc_server, daemon=True)
    grpc_thread.start()
    logger.info(f"gRPC server started on port {GRPC_PORT}")

    # Run HTTP server for health checks (blocking)
    logger.info(f"Starting HTTP health check server on {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT, log_level="info")

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto files and generate Python code
COPY protos/ ./protos/
RUN python -m grpc_tools.protoc -I./protos --python_out=. --grpc_python_out=. ./protos/ml_service.proto

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Expose ports (HTTP for health check, gRPC for predictions)
EXPOSE 5000 50051

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Run the main server (HTTP + gRPC)
CMD ["python", "main.py"]

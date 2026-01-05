#!/bin/bash
# Script to generate Python gRPC code from proto files

# Navigate to the python-ml directory
cd "$(dirname "$0")"

# Create output directory if it doesn't exist
mkdir -p .

# Generate Python code from proto file
python -m grpc_tools.protoc \
    -I./protos \
    --python_out=. \
    --grpc_python_out=. \
    ./protos/ml_service.proto

echo "Proto files generated successfully!"

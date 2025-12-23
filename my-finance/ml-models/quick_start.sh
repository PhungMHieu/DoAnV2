#!/bin/bash

# Quick Start Script for PhoBERT ML Models
# This script sets up and runs the complete ML pipeline

set -e

echo "🚀 PhoBERT Transaction Classifier - Quick Start"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check Python version
echo "1. Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✓${NC} Python $python_version"
echo ""

# Step 2: Create virtual environment (if not exists)
if [ ! -d "venv" ]; then
    echo "2. Creating virtual environment..."
    python3 -m venv venv
    echo -e "${GREEN}✓${NC} Virtual environment created"
else
    echo "2. Virtual environment already exists"
    echo -e "${GREEN}✓${NC} Skipping creation"
fi
echo ""

# Step 3: Activate virtual environment
echo "3. Activating virtual environment..."
source venv/bin/activate
echo -e "${GREEN}✓${NC} Virtual environment activated"
echo ""

# Step 4: Install dependencies
echo "4. Installing dependencies..."
pip install -q -r requirements.txt
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Step 5: Generate training data
if [ ! -f "data/training_data.jsonl" ]; then
    echo "5. Generating training data..."
    python training_data_generator.py
    echo -e "${GREEN}✓${NC} Training data generated (5,500 samples)"
else
    echo "5. Training data already exists"
    echo -e "${GREEN}✓${NC} Skipping generation"
fi
echo ""

# Step 6: Train model (optional, skip if model exists)
if [ ! -f "models/phobert_best.pt" ]; then
    echo "6. Training PhoBERT model..."
    echo -e "${YELLOW}⚠️  This will take ~5 minutes on GPU, ~30 minutes on CPU${NC}"
    read -p "Do you want to train now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python train_phobert.py
        echo -e "${GREEN}✓${NC} Model trained successfully"
    else
        echo -e "${YELLOW}⚠️  Skipping training. Server will use pre-trained PhoBERT only.${NC}"
    fi
else
    echo "6. Trained model already exists"
    echo -e "${GREEN}✓${NC} Using existing model: models/phobert_best.pt"
fi
echo ""

# Step 7: Start API server
echo "7. Starting FastAPI server..."
echo -e "${YELLOW}Server will run on http://localhost:8000${NC}"
echo -e "${YELLOW}Swagger docs: http://localhost:8000/docs${NC}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python api_server.py

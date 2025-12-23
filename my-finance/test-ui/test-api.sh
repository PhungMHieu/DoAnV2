#!/bin/bash

# AI Auto-Categorization API Test Script
# Usage: ./test-api.sh

set -e

ML_SERVICE_URL="${ML_SERVICE_URL:-http://localhost:3005}"

echo "🧪 Testing AI Auto-Categorization API"
echo "======================================"
echo "ML Service URL: $ML_SERVICE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test prediction
test_prediction() {
    local note="$1"
    local expected="$2"
    local test_name="$3"

    echo -n "Testing: $test_name ... "

    response=$(curl -s -X POST "$ML_SERVICE_URL/predict-category" \
        -H "Content-Type: application/json" \
        -d "{\"note\":\"$note\"}")

    category=$(echo "$response" | grep -o '"category":"[^"]*"' | cut -d'"' -f4)
    confidence=$(echo "$response" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)

    if [ "$category" == "$expected" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($category, ${confidence}% confidence)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected, Got: $category)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Health check first
echo "1. Health Check"
echo "---------------"
if curl -s "$ML_SERVICE_URL/api" > /dev/null; then
    echo -e "${GREEN}✓${NC} ML Service is running"
else
    echo -e "${RED}✗${NC} ML Service is not accessible!"
    echo "Please start ML Service first: npm run start:dev ml-service"
    exit 1
fi
echo ""

# Run tests
echo "2. Running Test Cases"
echo "---------------------"

# Food tests
test_prediction "grabfood lunch" "food" "GrabFood delivery"
test_prediction "highlands coffee" "food" "Highlands Coffee"
test_prediction "pizza hut dinner" "food" "Pizza Hut"
test_prediction "com tam" "other" "Vietnamese rice (no match expected)"

# Transport tests
test_prediction "grab taxi" "transport" "Grab taxi"
test_prediction "taxi airport" "transport" "Taxi to airport"
test_prediction "bus ticket" "transport" "Bus ticket"

# Entertainment tests
test_prediction "netflix subscription" "entertainment" "Netflix"
test_prediction "cgv cinema" "entertainment" "CGV Cinema"
test_prediction "spotify premium" "entertainment" "Spotify"

# Shopping tests
test_prediction "shopee purchase" "shopping" "Shopee shopping"
test_prediction "lazada order" "shopping" "Lazada order"
test_prediction "buy clothes" "shopping" "Buy clothes"

# Income tests
test_prediction "salary december" "income" "Monthly salary"
test_prediction "bonus payment" "income" "Bonus payment"

# Bills tests
test_prediction "electricity bill" "bills" "Electricity bill"
test_prediction "internet payment" "bills" "Internet payment"

echo ""
echo "3. Batch Prediction Test"
echo "------------------------"

batch_response=$(curl -s -X POST "$ML_SERVICE_URL/batch-predict-category" \
    -H "Content-Type: application/json" \
    -d '[
        {"note":"grabfood lunch","amount":50000},
        {"note":"taxi home","amount":30000},
        {"note":"netflix","amount":260000}
    ]')

if [ ! -z "$batch_response" ]; then
    echo -e "${GREEN}✓${NC} Batch prediction successful"
    echo "$batch_response" | python3 -m json.tool 2>/dev/null || echo "$batch_response"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Batch prediction failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Summary
echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Check logs above.${NC}"
    exit 1
fi

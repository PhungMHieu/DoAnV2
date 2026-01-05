# ML Service - AI/ML Predictions cho My Finance

## Giới thiệu

ML Service là microservice chuyên xử lý các tác vụ AI/ML trong hệ thống My Finance, bao gồm:
- **Auto-categorization**: Tự động phân loại giao dịch dựa trên mô tả
- **Amount extraction**: Trích xuất số tiền từ text tiếng Việt
- **Training data collection**: Thu thập dữ liệu để train ML model

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                     CategoryPredictionService                    │
│                      (Orchestrator chính)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Enhanced    │   │   ML Model      │   │    Ensemble     │
│   Keyword     │   │  (TF-IDF+SVM)   │   │   (PhoBERT)     │
│  Classifier   │   │   Classifier    │   │   Classifier    │
└───────────────┘   └─────────────────┘   └─────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  - N-gram     │   │  Python ML API  │   │  - Keyword 30%  │
│  - Weighting  │   │  (FastAPI)      │   │  - PhoBERT 70%  │
│  - Normalize  │   │                 │   │                 │
│  - Neg. keys  │   │                 │   │                 │
│  - Amount     │   │                 │   │                 │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## Quick Start

### Development
```bash
# Start ML service standalone
npm run start:dev ml-service

# Access Swagger docs
open http://localhost:3005/api
```

### Docker
```bash
# Build và start
docker-compose up -d ml-service

# View logs
docker logs -f my-finance-ml
```

## Prediction Modes

| Mode | Env Variable | Mô tả | Accuracy |
|------|-------------|-------|----------|
| `basic` | `USE_ENHANCED_KEYWORD=false` | Keyword matching đơn giản | 60-70% |
| `enhanced` | (default) | N-gram, weighting, normalization | 75-85% |
| `ml` | `USE_ML_MODEL=true` | TF-IDF + SVM với fallback | 85-90% |
| `ensemble` | `USE_PHOBERT=true` | Keyword + PhoBERT | 90-95% |

## Categories (17 loại)

| Category | Mô tả | Ví dụ keywords |
|----------|-------|----------------|
| `income` | Thu nhập | lương, thưởng, hoàn tiền |
| `food` | Ăn uống | phở, cafe, grabfood |
| `transportation` | Di chuyển | grab, taxi, xăng |
| `entertainment` | Giải trí | phim, game, netflix |
| `shopping` | Mua sắm | quần áo, shopee |
| `health` | Sức khỏe | bệnh viện, thuốc |
| `education` | Giáo dục | học phí, udemy |
| `utilities` | Hóa đơn | tiền điện, internet |
| `home` | Nhà ở | tiền nhà, nội thất |
| `personal` | Cá nhân | gym, cắt tóc |
| `travel` | Du lịch | khách sạn, vé máy bay |
| `investment` | Đầu tư | cổ phiếu, bitcoin |
| `family` | Gia đình | bỉm, sữa bột |
| `houseware` | Đồ gia dụng | điện thoại, laptop |
| `donation` | Quyên góp | ủng hộ, cứu trợ |
| `charity` | Từ thiện | từ thiện, thiện nguyện |
| `other` | Khác | - |

## API Endpoints

### Prediction

```bash
# Single prediction
POST /predict-category
{
  "note": "ăn phở 50k",
  "amount": 50000
}

# Response
{
  "category": "food",
  "confidence": 0.92,
  "suggestions": [
    { "category": "food", "confidence": 0.92 },
    { "category": "entertainment", "confidence": 0.05 }
  ],
  "model": "enhanced-keyword-v1-ngram"
}
```

```bash
# Batch prediction
POST /batch-predict-category
[
  { "note": "đi grab", "amount": 30000 },
  { "note": "tiền điện", "amount": 500000 }
]
```

```bash
# Analyze transaction (extract amount + predict)
POST /analyze-transaction
{
  "text": "ăn phở 50k"
}

# Response
{
  "amount": 50000,
  "amountConfidence": 1.0,
  "matchedText": "50k",
  "extractionMethod": "k-notation",
  "category": "food",
  "categoryConfidence": 0.92,
  "suggestions": [...],
  "model": "enhanced-keyword-v1"
}
```

```bash
# Analyze multiple transactions
POST /analyze-multi-transactions
{
  "text": "ăn phở 50k. đi grab 30k. mua sách 100k"
}
```

### Training Data Collection

```bash
# Log khi user sửa category
POST /training-data/log-correction
{
  "text": "cf với bạn 50k",
  "amount": 50000,
  "predictedCategory": "other",
  "predictedConfidence": 0.3,
  "correctedCategory": "food"
}

# Log khi user xác nhận đúng
POST /training-data/log-confirmed
{
  "text": "đi grab 30k",
  "amount": 30000,
  "confirmedCategory": "transportation",
  "predictedConfidence": 0.92
}

# Xem thống kê
GET /training-data/stats

# Export data cho ML training
GET /training-data/export?minRecordsPerCategory=10

# Đếm số records
GET /training-data/count
```

## Enhanced Keyword Features

### 1. N-gram Matching
Ưu tiên match cụm từ thay vì từ đơn:
```
"grab food" → food (không phải transportation)
"tiền nhà" → home (không phải income)
"ăn mặc" → shopping (không phải food)
```

### 2. Keyword Weighting
```javascript
// High weight (specific)
"grabfood": 1.5
"shopeefood": 1.5
"netflix": 1.3

// Low weight (generic)
"mua": 0.5
"tiền": 0.4
"đi": 0.3
```

### 3. Vietnamese Normalization
```
"cf" → "cafe"
"đc" → "được"
"grap" → "grab"
"shoppee" → "shopee"
```

### 4. Negative Keywords
```
"grab food" → excludes transportation
"ăn mặc" → excludes food
"bánh xe" → excludes food
```

### 5. Amount Hints
```
< 50k → likely food, transportation
50k - 200k → likely food, entertainment
1tr - 5tr → likely home, education, travel
> 5tr → likely home, investment
```

## ML Model (Python)

### Setup

```bash
cd apps/ml-service/python-ml

# Install dependencies
pip install -r requirements.txt

# Run API server
python api.py
```

### Docker

```bash
cd apps/ml-service/python-ml
docker build -t ml-classifier .
docker run -p 5000:5000 ml-classifier
```

### Endpoints

```bash
# Health check
GET http://localhost:5000/health

# Predict
POST http://localhost:5000/predict
{ "text": "ăn phở 50k" }

# Train model
POST http://localhost:5000/train
{ "force": true }

# Model info
GET http://localhost:5000/model-info
```

### Requirements
- Python 3.11+
- scikit-learn >= 1.3.0
- FastAPI >= 0.104.0
- underthesea >= 6.8.0 (Vietnamese NLP)

## Environment Variables

```env
# Service port
ML_SERVICE_PORT=3005

# Prediction mode
USE_ENHANCED_KEYWORD=true   # Default: true
USE_ML_MODEL=false          # Default: false
USE_PHOBERT=false           # Default: false

# ML API (Python service)
ML_API_URL=http://localhost:5000

# PhoBERT service (optional)
PHOBERT_SERVICE_URL=http://localhost:8001
```

## Project Structure

```
apps/ml-service/
├── src/
│   ├── categories/
│   │   ├── category.constants.ts              # Categories & keywords (17 types)
│   │   ├── enhanced-keywords.constants.ts     # N-gram, weights, negative keys
│   │   ├── category-prediction.service.ts     # Main orchestrator
│   │   ├── classifiers/
│   │   │   ├── keyword-classifier.service.ts         # Basic keyword
│   │   │   ├── enhanced-keyword-classifier.service.ts # Enhanced features
│   │   │   ├── ml-classifier.service.ts              # ML model client
│   │   │   └── ensemble-classifier.service.ts        # PhoBERT ensemble
│   │   └── dto/
│   │       └── predict-category.dto.ts
│   ├── amount-extraction/
│   │   ├── amount-extractor.service.ts        # Extract amount from text
│   │   └── dto/
│   ├── training-data/
│   │   ├── training-data.service.ts           # Data collection
│   │   ├── training-data.controller.ts        # API endpoints
│   │   └── dto/
│   ├── ml-service.controller.ts
│   ├── ml-service.module.ts
│   └── main.ts
├── python-ml/                                 # Python ML service
│   ├── api.py                                 # FastAPI server
│   ├── ml_model.py                            # TF-IDF + SVM
│   ├── text_processor.py                      # Vietnamese preprocessing
│   ├── config.py
│   ├── requirements.txt
│   └── Dockerfile
└── README.md
```

## Performance

| Mode | Latency | Throughput |
|------|---------|------------|
| Basic Keyword | < 1ms | ~1000 req/s |
| Enhanced Keyword | < 5ms | ~500 req/s |
| ML Model | 10-50ms | ~100 req/s |
| Ensemble | 100-500ms | ~20 req/s |

## Troubleshooting

### Issue: Low prediction accuracy
**Solution:**
1. Review keywords trong `enhanced-keywords.constants.ts`
2. Thêm N-gram cho các case thường gặp
3. Kiểm tra negative keywords

### Issue: Wrong category
**Solution:**
1. Thêm keyword specific hơn
2. Kiểm tra keyword conflicts giữa categories
3. Thêm negative keyword để loại trừ

### Issue: ML API not available
**Solution:**
1. Kiểm tra Python service đang chạy: `curl http://localhost:8000/health`
2. Kiểm tra logs: `docker logs ml-classifier`
3. Service sẽ tự fallback về enhanced keyword

## Roadmap

- [x] Phase 1: Enhanced Keyword Classifier
  - [x] N-gram matching
  - [x] Keyword weighting
  - [x] Vietnamese normalization
  - [x] Negative keywords
  - [x] Amount hints

- [x] Phase 2: Training Data Collection
  - [x] Log corrections
  - [x] Log confirmations
  - [x] Export for training

- [x] Phase 3: ML Model (TF-IDF + SVM)
  - [x] Python FastAPI service
  - [x] Text preprocessing
  - [x] Model training
  - [x] NestJS integration

- [ ] Phase 4: PhoBERT (Optional)
  - [ ] PhoBERT service
  - [ ] Ensemble voting

- [ ] Phase 5: User Personalization
  - [ ] Per-user keyword learning
  - [ ] Custom category mapping

---

**Version**: 2.0.0
**Last Updated**: 2024-12-27

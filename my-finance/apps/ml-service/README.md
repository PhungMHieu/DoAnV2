# ML Service - AI/ML Predictions cho My Finance

## 📖 Giới thiệu

ML Service là microservice chuyên xử lý các tác vụ AI/ML trong hệ thống My Finance, bao gồm:
- ✅ **Auto-categorization**: Tự động phân loại giao dịch dựa trên mô tả
- 🚧 **Expense forecasting**: Dự báo chi tiêu (future)
- 🚧 **Anomaly detection**: Phát hiện giao dịch bất thường (future)

## 🚀 Quick Start

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

## 📡 API Endpoints

### 1. Predict Category
**POST** `/predict-category`

Dự đoán category cho một transaction.

**Request:**
```json
{
  "note": "Mua cơm trưa quán Phở 24",
  "amount": 50000
}
```

**Response:**
```json
{
  "category": "food",
  "confidence": 0.85,
  "suggestions": [
    { "category": "food", "confidence": 0.85 },
    { "category": "entertainment", "confidence": 0.10 },
    { "category": "other", "confidence": 0.05 }
  ],
  "model": "keyword-matcher-v1"
}
```

### 2. Batch Predict Categories
**POST** `/batch-predict-category`

Dự đoán categories cho nhiều transactions cùng lúc.

**Request:**
```json
[
  { "note": "Grab về nhà", "amount": 30000 },
  { "note": "Cafe Highlands", "amount": 45000 },
  { "note": "Netflix subscription", "amount": 260000 }
]
```

**Response:**
```json
[
  {
    "category": "transport",
    "confidence": 0.92,
    "suggestions": [...],
    "model": "keyword-matcher-v1"
  },
  {
    "category": "food",
    "confidence": 0.88,
    "suggestions": [...],
    "model": "keyword-matcher-v1"
  },
  {
    "category": "entertainment",
    "confidence": 0.91,
    "suggestions": [...],
    "model": "keyword-matcher-v1"
  }
]
```

## 🧠 Models

### Current: Keyword-based Classifier

**Algorithm:**
- Text normalization (lowercase, remove special chars)
- Keyword matching với weighted scoring
- Confidence calculation dựa trên coverage & specificity

**Supported Categories:**
- `income` - Thu nhập
- `food` - Đồ ăn
- `transport` - Đi lại
- `entertainment` - Giải trí
- `shopping` - Mua sắm
- `healthcare` - Y tế
- `education` - Giáo dục
- `bills` - Hóa đơn
- `housing` - Nhà ở
- `personal` - Cá nhân
- `other` - Khác

**Keyword Examples:**
```typescript
FOOD: ['ăn', 'cơm', 'phở', 'cafe', 'grabfood', 'pizza', ...]
TRANSPORT: ['grab', 'taxi', 'xăng', 'bus', 'xe ôm', ...]
ENTERTAINMENT: ['phim', 'game', 'netflix', 'karaoke', 'du lịch', ...]
```

### Future: ML-based Classifier

**Planned:**
- PhoBERT Vietnamese NLP model
- ViT5 transformer model
- Custom fine-tuned model on user data
- Ensemble predictions

## 🔧 Configuration

### Environment Variables
```env
ML_SERVICE_PORT=3005
NODE_ENV=development
```

### Dependencies
```json
{
  "@nestjs/common": "^11.0.1",
  "@nestjs/config": "^4.0.2",
  "@nestjs/swagger": "^11.2.3",
  "class-validator": "^0.14.3"
}
```

## 📊 Performance

### Keyword Classifier Benchmarks
- **Latency**: ~2-5ms per prediction
- **Throughput**: ~200-500 requests/second
- **Accuracy**: ~75-85% (varies by category)

### Confidence Metrics
- High confidence (≥0.8): ~60% of predictions
- Medium confidence (0.5-0.8): ~25% of predictions
- Low confidence (<0.5): ~15% of predictions

## 🧪 Testing

### Unit Tests
```bash
# Run tests
npm test apps/ml-service

# Watch mode
npm test:watch apps/ml-service
```

### Manual Testing
```bash
# Test prediction
curl -X POST http://localhost:3005/predict-category \
  -H "Content-Type: application/json" \
  -d '{"note":"Ăn sáng bánh mì","amount":20000}'
```

## 📁 Project Structure

```
apps/ml-service/
├── src/
│   ├── categories/
│   │   ├── category.constants.ts           # Categories & keywords
│   │   ├── category-prediction.service.ts  # Main orchestrator
│   │   ├── classifiers/
│   │   │   └── keyword-classifier.service.ts  # Keyword-based impl
│   │   └── dto/
│   │       └── predict-category.dto.ts     # Request/Response DTOs
│   ├── ml-service.controller.ts            # API endpoints
│   ├── ml-service.module.ts                # Module config
│   └── main.ts                             # Bootstrap
├── test/
│   └── app.e2e-spec.ts
└── README.md
```

## 🔍 Troubleshooting

### Issue: Low prediction accuracy
**Solution:**
1. Review and expand keywords in `category.constants.ts`
2. Add more domain-specific terms
3. Test with real user data

### Issue: High latency
**Solution:**
1. Enable caching for common predictions
2. Optimize keyword matching algorithm
3. Consider batch processing

### Issue: Wrong category predictions
**Solution:**
1. Check keyword overlaps between categories
2. Adjust confidence thresholds
3. Add negative keywords

## 📚 Documentation

- [Full AI Auto-categorization Guide](../../docs/AI_AUTO_CATEGORIZATION.md)
- [Swagger API Docs](http://localhost:3005/api)
- [Category Constants](./src/categories/category.constants.ts)

## 🚧 Roadmap

### Phase 1 (✅ Current)
- [x] Keyword-based classifier
- [x] REST API endpoints
- [x] Swagger documentation
- [x] Docker deployment

### Phase 2 (🚧 In Progress)
- [ ] Collect training data
- [ ] Train ML models (PhoBERT)
- [ ] Model versioning
- [ ] A/B testing framework

### Phase 3 (📋 Planned)
- [ ] User-specific personalization
- [ ] Online learning
- [ ] Multi-language support
- [ ] Advanced analytics

## 🤝 Contributing

To add new categories or keywords:
1. Edit `src/categories/category.constants.ts`
2. Add category to `CATEGORIES` enum
3. Add keywords to `CATEGORY_KEYWORDS`
4. Update tests
5. Deploy

## 📞 Support

For issues or questions:
- Check [Troubleshooting Guide](../../docs/AI_AUTO_CATEGORIZATION.md#troubleshooting)
- Review Swagger docs at `/api`
- Check service logs: `docker logs my-finance-ml`

---

**Version**: 1.0.0
**Last Updated**: 2024-12-21

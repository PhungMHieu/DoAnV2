# AI Auto-Categorization Feature

## 📖 Tổng quan

Feature **Tự động phân loại giao dịch** sử dụng AI/ML để tự động dự đoán category của transaction dựa trên mô tả (note) mà người dùng nhập vào.

### Lợi ích:
- ✅ Tiết kiệm thời gian cho user (không cần chọn category thủ công)
- ✅ Tăng độ chính xác trong việc phân loại chi tiêu
- ✅ Học hỏi từ patterns của user theo thời gian (future)

---

## 🏗️ Kiến trúc

### Services
```
┌─────────────────┐
│  Transaction    │
│    Service      │──────┐
│  (Port 3001)    │      │
└─────────────────┘      │
                         │ HTTP Request
                         ▼
                  ┌─────────────────┐
                  │   ML Service    │
                  │   (Port 3005)   │
                  │                 │
                  │ - Keyword-based │
                  │   Classifier    │
                  │ - (Future: ML)  │
                  └─────────────────┘
```

### Components

#### 1. ML Service (`apps/ml-service/`)
- **Port**: 3005
- **Endpoints**:
  - `POST /predict-category` - Dự đoán category cho 1 transaction
  - `POST /batch-predict-category` - Dự đoán cho nhiều transactions

**Structure:**
```
apps/ml-service/
├── src/
│   ├── categories/
│   │   ├── category.constants.ts          # Danh sách categories & keywords
│   │   ├── category-prediction.service.ts # Orchestrator service
│   │   ├── classifiers/
│   │   │   └── keyword-classifier.service.ts  # Keyword-based classifier
│   │   └── dto/
│   │       └── predict-category.dto.ts    # Request/Response DTOs
│   ├── ml-service.controller.ts
│   ├── ml-service.module.ts
│   └── main.ts
```

#### 2. Transaction Service Integration
- **ML Client**: `apps/transaction-service/src/ml-client/ml-client.service.ts`
- **Auto-suggest Logic**: Trong `POST /transactions` endpoint

---

## 🎯 Categories được hỗ trợ

| Category | Mô tả | Keywords ví dụ |
|----------|-------|----------------|
| `income` | Thu nhập | lương, thưởng, salary, bonus |
| `food` | Đồ ăn | ăn, cơm, phở, cafe, grabfood |
| `transport` | Đi lại | grab, taxi, xăng, bus |
| `entertainment` | Giải trí | phim, game, netflix, karaoke |
| `shopping` | Mua sắm | mua, quần áo, giày, lazada |
| `healthcare` | Y tế | bác sĩ, thuốc, bệnh viện |
| `education` | Giáo dục | học, khóa học, sách |
| `bills` | Hóa đơn | điện, nước, internet, wifi |
| `housing` | Nhà ở | thuê nhà, sửa chữa, nội thất |
| `personal` | Cá nhân | cắt tóc, gym, quà tặng |
| `other` | Khác | Fallback category |

---

## 🔧 Cách sử dụng

### 1. Prediction API trực tiếp (ML Service)

**Endpoint**: `POST http://localhost:3005/predict-category`

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
    { "category": "other", "confidence": 0.15 }
  ],
  "model": "keyword-matcher-v1"
}
```

---

### 2. Auto-suggest khi tạo transaction (Transaction Service)

**Endpoint**: `POST http://localhost:3001/transactions`

**Cách 1: Không cung cấp category (AI sẽ tự động predict)**
```json
{
  "amount": 50000,
  "note": "Grab về nhà",
  "dateTime": "2024-12-21T18:00:00Z"
}
```

**Response:**
```json
{
  "id": "uuid-123",
  "amount": 50000,
  "category": "transport",  // ✅ AI predicted
  "note": "Grab về nhà",
  "dateTime": "2024-12-21T18:00:00Z",
  "userId": "user-uuid"
}
```

**Cách 2: Cung cấp category (AI bỏ qua)**
```json
{
  "amount": 50000,
  "category": "food",  // Manual selection
  "note": "Grab về nhà",
  "dateTime": "2024-12-21T18:00:00Z"
}
```

---

## ⚙️ Cấu hình

### Environment Variables

**ML Service** (`.env`):
```env
ML_SERVICE_PORT=3005
```

**Transaction Service** (`.env`):
```env
ML_SERVICE_URL=http://ml-service:3005
```

### Docker Compose

ML Service đã được thêm vào `docker-compose.yml`:
```yaml
ml-service:
  container_name: my-finance-ml
  ports:
    - "3005:3005"
  environment:
    - ML_SERVICE_PORT=3005
```

---

## 🧠 Thuật toán Phân loại

### Phase 1: Keyword-based Classifier (Hiện tại)

**Cách hoạt động:**
1. Normalize text (lowercase, loại bỏ ký tự đặc biệt)
2. Match keywords với từng category
3. Tính điểm cho mỗi category:
   - Keyword length bonus (keyword dài = specific hơn)
   - Exact match bonus (whole word match)
   - Coverage bonus (match nhiều keywords)
4. Normalize scores về [0, 1]
5. Trả về top category + confidence

**Code:**
```typescript
// apps/ml-service/src/categories/classifiers/keyword-classifier.service.ts
predict(note: string, amount?: number) {
  const scores = ALL_CATEGORIES.map(category => ({
    category,
    confidence: this.calculateCategoryScore(note, category)
  }));

  return scores.sort((a, b) => b.confidence - a.confidence)[0];
}
```

**Ưu điểm:**
- ✅ Nhanh, không cần training
- ✅ Dễ debug và customize
- ✅ Hỗ trợ tiếng Việt tốt

**Nhược điểm:**
- ❌ Không học được patterns phức tạp
- ❌ Phụ thuộc vào keywords được định nghĩa sẵn

---

### Phase 2: ML-based Classifier (Tương lai)

**Công nghệ đề xuất:**
- **PhoBERT**: Vietnamese pre-trained BERT model
- **ViT5**: Vietnamese T5 model
- **Custom trained model** trên transaction data của users

**Cách triển khai:**
1. Thu thập training data từ user transactions
2. Fine-tune PhoBERT trên labeled data
3. Deploy model với TensorFlow Serving hoặc FastAPI
4. Ensemble với keyword classifier

**File chuẩn bị sẵn:**
```typescript
// apps/ml-service/src/categories/category-prediction.service.ts
// TODO Phase 2: Ensemble với ML model
// if (this.phoBertClassifier && prediction.confidence < 0.8) {
//   const mlPrediction = await this.phoBertClassifier.predict(dto.note);
//   // Combine predictions với weighted average
// }
```

---

## 📊 Confidence Thresholds

**Auto-fill logic** trong Transaction Service:
```typescript
if (prediction.confidence >= 0.5) {
  body.category = prediction.category;  // High confidence
} else {
  body.category = 'other';  // Low confidence, dùng fallback
}
```

**Recommended thresholds:**
- `≥ 0.8`: Very high confidence (có thể skip user confirmation)
- `0.5 - 0.8`: Medium confidence (auto-fill nhưng nên highlight)
- `< 0.5`: Low confidence (suggest nhưng không auto-fill)

---

## 🧪 Testing

### 1. Test Keyword Classifier

**Test cases:**
```typescript
// apps/ml-service/src/categories/classifiers/keyword-classifier.service.spec.ts

describe('KeywordClassifierService', () => {
  it('should predict "food" for Vietnamese food-related note', () => {
    const result = classifier.predict('Mua cơm trưa quán Phở 24');
    expect(result.category).toBe('food');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should predict "transport" for Grab/taxi', () => {
    const result = classifier.predict('Grab về nhà');
    expect(result.category).toBe('transport');
  });

  it('should fallback to "other" for empty note', () => {
    const result = classifier.predict('');
    expect(result.category).toBe('other');
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

### 2. Integration Test

**Manual testing:**
```bash
# Start ML Service
npm run start:dev ml-service

# Test prediction endpoint
curl -X POST http://localhost:3005/predict-category \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Starbucks cafe sữa đá",
    "amount": 75000
  }'

# Expected response:
# {
#   "category": "food",
#   "confidence": 0.82,
#   "suggestions": [...],
#   "model": "keyword-matcher-v1"
# }
```

### 3. E2E Test with Transaction Service

```bash
# Create transaction without category
curl -X POST http://localhost:3001/transactions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "note": "Ăn tối lẩu Thái",
    "dateTime": "2024-12-21T19:00:00Z"
  }'

# Check response - category should be auto-filled as "food"
```

---

## 🚀 Deployment

### Development
```bash
# Start ML Service standalone
npm run start:dev ml-service

# Or start all services
docker-compose up -d
```

### Production
```bash
# Build all services
docker-compose build

# Start with ML Service
docker-compose up -d ml-service transaction-service
```

**Verify ML Service:**
```bash
# Health check
curl http://localhost:3005/api

# Should return Swagger documentation page
```

---

## 📈 Future Enhancements

### Phase 2: ML Models
- [ ] Collect training data từ user transactions
- [ ] Train PhoBERT classifier
- [ ] A/B testing keyword vs ML model
- [ ] Ensemble predictions

### Phase 3: Personalization
- [ ] User-specific models (học từ history của từng user)
- [ ] Collaborative filtering (học từ users tương tự)
- [ ] Active learning (ask user để improve model)

### Phase 4: Advanced Features
- [ ] Multi-label classification (1 transaction có thể thuộc nhiều categories)
- [ ] Merchant detection (trích xuất tên merchant từ note)
- [ ] Amount-based prediction (predict dựa trên amount patterns)
- [ ] Time-based patterns (predict theo ngày/giờ)

---

## 🐛 Troubleshooting

### Issue 1: ML Service không kết nối được
**Triệu chứng:**
```
[AI Auto-categorization] Failed: connect ECONNREFUSED 127.0.0.1:3005
```

**Giải pháp:**
1. Check ML Service có đang chạy không:
   ```bash
   docker ps | grep ml-service
   ```
2. Check environment variable `ML_SERVICE_URL` trong Transaction Service
3. Check network connectivity giữa containers

### Issue 2: Confidence luôn thấp
**Triệu chứng:**
```
[AI Auto-categorization] Low confidence (0.12%), using fallback category "other"
```

**Giải pháp:**
1. Check keywords trong `category.constants.ts` có đủ phong phú không
2. Thêm keywords cho category đó
3. Normalize text có đúng không (dấu tiếng Việt, special chars)

### Issue 3: Wrong predictions
**Triệu chứng:**
```
Note: "Xăng xe"
Predicted: "food" (expected: "transport")
```

**Giải pháp:**
1. Review keywords trong `CATEGORY_KEYWORDS`
2. Thêm "xăng" vào `transport` keywords
3. Hoặc xóa "xăng" khỏi `food` keywords (nếu có)

---

## 📚 References

- **Keyword Classifier**: `apps/ml-service/src/categories/classifiers/keyword-classifier.service.ts`
- **Category Constants**: `apps/ml-service/src/categories/category.constants.ts`
- **ML Client**: `apps/transaction-service/src/ml-client/ml-client.service.ts`
- **Swagger Docs**: http://localhost:3005/api

---

## 👥 Contributors

- AI Auto-categorization feature developed for My Finance v1.0
- Phase 1 (Keyword-based) implemented: 2024-12-21

---

**Happy Auto-categorizing! 🤖✨**

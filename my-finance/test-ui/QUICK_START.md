# 🚀 Quick Start - Test AI Auto-Categorization

## ✅ Bước 1: Start Services

```bash
# Trong terminal 1: Start ML Service
npm run start:dev ml-service

# Chờ đến khi thấy:
# 🤖 ML Service is running on: http://localhost:3005
# 📚 Swagger docs available at: http://localhost:3005/api
```

## ✅ Bước 2: Mở Test UI

**Option A: Mở trực tiếp file HTML**
```bash
# MacOS
open test-ui/index.html

# Windows
start test-ui/index.html

# Linux
xdg-open test-ui/index.html
```

**Option B: Dùng HTTP Server (recommended)**
```bash
# Trong terminal 2: Start HTTP server
cd test-ui
python3 -m http.server 8080

# Mở browser
open http://localhost:8080
```

## ✅ Bước 3: Test các tính năng

### 🔮 Test 1: Prediction API

1. Click vào các example chips:
   - 🍜 Phở 24
   - 🚗 Grab
   - ☕ Highlands
   - 🎬 Netflix

2. Hoặc nhập thủ công:
   ```
   Mô tả: grabfood lunch
   Số tiền: 50000
   ```

3. Click "Dự đoán Category"

4. Xem kết quả:
   - Category: FOOD
   - Confidence: ~77%
   - Suggestions: food (77%), transport (22%)

### ✨ Test 2: Auto-Suggest

1. Nhập mô tả transaction:
   ```
   netflix subscription
   ```

2. Nhập số tiền: `260000`

3. Click "Auto-Suggest Category"

4. Xem AI predict: **ENTERTAINMENT** (~50% confidence)

### 📊 Test 3: Batch Prediction

1. Nhập JSON array (hoặc dùng mẫu có sẵn):
   ```json
   [
     {"note": "grabfood lunch", "amount": 50000},
     {"note": "netflix subscription", "amount": 260000},
     {"note": "highlands coffee", "amount": 45000}
   ]
   ```

2. Click "Batch Predict"

3. Xem kết quả cho 3 transactions

## 📝 Test Cases đề xuất

### High Confidence Cases (>70%)

```
✅ "grabfood lunch" → food (77%)
✅ "netflix subscription" → entertainment/bills (50%/50%)
✅ "highlands coffee" → food (~75%)
✅ "taxi airport" → transport (~80%)
✅ "salary december" → income (~90%)
```

### Medium Confidence Cases (50-70%)

```
⚠️ "shopping online" → shopping (~60%)
⚠️ "gym membership" → personal (~55%)
⚠️ "doctor appointment" → healthcare (~50%)
```

### Cách improve accuracy:

1. **Thêm keywords cụ thể hơn** trong mô tả:
   - ❌ "lunch" → other (low confidence)
   - ✅ "grabfood lunch" → food (high confidence)

2. **Dùng brand names**:
   - ✅ "highlands coffee"
   - ✅ "cgv cinema"
   - ✅ "shopee purchase"

3. **Combine keywords**:
   - ✅ "taxi grab airport"
   - ✅ "netflix monthly subscription"

## 🐛 Troubleshooting

### Issue: "Failed to fetch"

**Check ML Service:**
```bash
curl http://localhost:3005/api
# Should return Swagger page
```

**Check logs:**
```bash
# Xem console trong browser (F12)
# Hoặc xem terminal ML Service
```

### Issue: Low confidence

**Giải pháp:**
1. Thêm keywords vào `apps/ml-service/src/categories/category.constants.ts`
2. Restart ML Service
3. Test lại

### Issue: CORS error

**Giải pháp:**
- ML Service đã enable CORS sẵn
- Nếu vẫn lỗi, dùng HTTP server thay vì mở file trực tiếp

## 📊 Kiểm tra kết quả

### API Response format:
```json
{
  "category": "food",           // Predicted category
  "confidence": 0.77,           // 0-1 score
  "suggestions": [              // Alternative predictions
    {"category": "food", "confidence": 0.77},
    {"category": "transport", "confidence": 0.23}
  ],
  "model": "keyword-matcher-v1" // Model version
}
```

### Confidence thresholds:
- **≥ 0.8**: Very high confidence ✅
- **0.5 - 0.8**: Medium confidence ⚠️
- **< 0.5**: Low confidence ❌

## 🎯 Next Steps

Sau khi test thành công:

1. **Test với Transaction Service** (cần JWT token):
   ```bash
   # Login để lấy token
   curl -X POST http://localhost:3002/auth/login \
     -d '{"username":"test","password":"test"}'

   # Dùng token để create transaction
   ```

2. **Test trong Production**:
   ```bash
   docker-compose up -d
   ```

3. **Integrate vào Frontend** của My Finance

4. **Monitor accuracy** và improve keywords

## 📚 Documentation

- [Full Documentation](../docs/AI_AUTO_CATEGORIZATION.md)
- [ML Service README](../apps/ml-service/README.md)
- [Swagger API](http://localhost:3005/api)

---

**Happy Testing! 🧪✨**

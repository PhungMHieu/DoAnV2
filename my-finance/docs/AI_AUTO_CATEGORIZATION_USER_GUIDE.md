# 🤖 AI Auto-Categorization - Hướng dẫn Người dùng

## Tổng quan

AI Auto-categorization giúp **tự động phân loại giao dịch** dựa trên mô tả (`note`), giúp bạn tiết kiệm thời gian khi tạo transaction.

---

## 🎯 Nguyên tắc hoạt động

### **AI CHỈ gợi ý - KHÔNG bao giờ ghi đè lựa chọn của bạn!**

AI tuân theo nguyên tắc:
1. ✅ **Nếu BẠN chọn category** → Hệ thống dùng lựa chọn của bạn (AI không can thiệp)
2. 🤖 **Nếu bạn KHÔNG chọn category nhưng có `note`** → AI tự động dự đoán
3. 📦 **Nếu không có cả category lẫn note** → Mặc định là "other"

---

## 📝 Các trường hợp sử dụng

### Trường hợp 1: Bạn tự chọn category (Khuyến nghị)

**Request:**
```json
{
  "amount": 50000,
  "category": "food",
  "note": "Ăn trưa",
  "dateTime": "2024-12-21T12:00:00Z"
}
```

**Kết quả:**
- ✅ Category: `"food"` (dùng lựa chọn của bạn)
- 🤖 AI: **KHÔNG** được gọi
- 📝 Log: `[User choice] 👤 User manually selected category: "food"`

**→ Bạn có quyền kiểm soát hoàn toàn!**

---

### Trường hợp 2: Chỉ có note, không có category (AI dự đoán)

**Request:**
```json
{
  "amount": 50000,
  "note": "Mua cơm trưa Phở 24",
  "dateTime": "2024-12-21T12:00:00Z"
}
```

**Kết quả:**
- 🤖 AI dự đoán: `"food"` (confidence: 85%)
- ✅ Category: `"food"` (AI tự động điền)
- 📝 Log: `[AI Auto-categorization] ✅ Predicted "food" with 85.0% confidence`

**→ AI giúp bạn tiết kiệm thời gian!**

---

### Trường hợp 3: Note mơ hồ (confidence thấp)

**Request:**
```json
{
  "amount": 100000,
  "note": "Thanh toán",
  "dateTime": "2024-12-21T12:00:00Z"
}
```

**Kết quả:**
- 🤖 AI dự đoán: `"bills"` (confidence: 35%)
- ⚠️ Confidence quá thấp (< 50%)
- ✅ Category: `"other"` (fallback an toàn)
- 📝 Log: `[AI Auto-categorization] ⚠️ Low confidence (35.0%), using fallback "other"`

**→ AI không chắc chắn, dùng "other" an toàn!**

---

### Trường hợp 4: Không có category và không có note

**Request:**
```json
{
  "amount": 200000,
  "dateTime": "2024-12-21T12:00:00Z"
}
```

**Kết quả:**
- 🤖 AI: **KHÔNG** được gọi (vì không có note)
- ✅ Category: `"other"` (mặc định)
- 📝 Log: `[Default fallback] Using "other" category`

**→ Không có thông tin → mặc định "other"**

---

### Trường hợp 5: Bạn chọn sai nhưng muốn AI gợi ý

**Bước 1: Gọi API dự đoán trước**
```bash
POST /transactions/predict-category
{
  "note": "Mua vé xem phim CGV",
  "amount": 150000
}

Response:
{
  "category": "entertainment",
  "confidence": 0.92,
  "suggestions": [
    { "category": "entertainment", "confidence": 0.92 },
    { "category": "shopping", "confidence": 0.05 },
    { "category": "other", "confidence": 0.03 }
  ],
  "model": "keyword-matcher-v1"
}
```

**Bước 2: Xem gợi ý, quyết định có dùng không**
```bash
# Option A: Dùng gợi ý của AI
POST /transactions
{
  "amount": 150000,
  "category": "entertainment",  # ← Lấy từ AI suggestion
  "note": "Mua vé xem phim CGV",
  "dateTime": "2024-12-21T18:00:00Z"
}

# Option B: Tự chọn category khác
POST /transactions
{
  "amount": 150000,
  "category": "shopping",  # ← Bạn quyết định
  "note": "Mua vé xem phim CGV",
  "dateTime": "2024-12-21T18:00:00Z"
}
```

**→ Bạn có thể XEM gợi ý trước khi quyết định!**

---

## 🎨 So sánh 2 cách tạo transaction

| Đặc điểm | Tự chọn category | Để AI dự đoán |
|----------|------------------|---------------|
| **Tốc độ** | Nhanh nếu biết rõ | Rất nhanh (không cần suy nghĩ) |
| **Độ chính xác** | 100% (bạn quyết định) | ~90-95% (AI Phase 2) |
| **Khi nào dùng** | Biết chắc category | Note rõ ràng, muốn nhanh |
| **API call** | 1 request | 1 request (AI auto) |
| **Tính linh hoạt** | Hoàn toàn kiểm soát | Tiện lợi nhưng có thể sai |

---

## 📊 11 Categories hỗ trợ

| Category | Tiếng Việt | Ví dụ note | AI confidence |
|----------|------------|------------|---------------|
| `income` | Thu nhập | "Lương tháng 12" | Cao |
| `food` | Đồ ăn | "Cơm trưa Phở 24" | Rất cao |
| `transport` | Di chuyển | "Grab về nhà" | Cao |
| `entertainment` | Giải trí | "Vé xem phim" | Cao |
| `shopping` | Mua sắm | "Áo Uniqlo" | Trung bình |
| `healthcare` | Y tế | "Khám bệnh" | Cao |
| `education` | Giáo dục | "Học phí" | Cao |
| `bills` | Hóa đơn | "Điện nước tháng 12" | Cao |
| `housing` | Nhà ở | "Tiền thuê nhà" | Cao |
| `personal` | Cá nhân | "Cắt tóc" | Trung bình |
| `other` | Khác | "Khác" | Fallback |

---

## 🔧 Tùy chỉnh Confidence Threshold

Hiện tại threshold mặc định: **0.5 (50%)**

### Cách hoạt động:
- **Confidence ≥ 50%**: Dùng AI prediction
- **Confidence < 50%**: Dùng "other" (an toàn)

### Ví dụ:

| Note | AI Prediction | Confidence | Kết quả |
|------|---------------|------------|---------|
| "Cơm Phở 24" | food | 0.87 | ✅ food |
| "Grab về nhà" | transport | 0.72 | ✅ transport |
| "Thanh toán" | bills | 0.35 | ⚠️ other (low) |
| "Mua đồ" | shopping | 0.48 | ⚠️ other (low) |

**→ Threshold cao = An toàn hơn nhưng ít auto-fill hơn**
**→ Threshold thấp = Auto-fill nhiều hơn nhưng có thể sai**

---

## 🚀 Workflow khuyến nghị

### Workflow 1: Tạo nhanh (Để AI làm)

```bash
# 1. Tạo transaction chỉ với note
POST /transactions
{
  "amount": 45000,
  "note": "Highlands coffee sáng",
  "dateTime": "2024-12-21T08:00:00Z"
}

# 2. Hệ thống tự động điền category = "food"
# 3. Done! 🎉
```

**→ Phù hợp khi:** Note rõ ràng, muốn tạo nhanh

---

### Workflow 2: Kiểm tra trước (Xem gợi ý AI)

```bash
# 1. Gọi predict API để xem gợi ý
POST /transactions/predict-category
{
  "note": "Mua đồ online Shopee",
  "amount": 250000
}

# Response:
# {
#   "category": "shopping",
#   "confidence": 0.78,
#   "suggestions": [...]
# }

# 2. Quyết định có dùng "shopping" không
# 3a. Đồng ý → Tạo với category = "shopping"
# 3b. Không đồng ý → Tự chọn category khác
```

**→ Phù hợp khi:** Muốn xem gợi ý trước khi quyết định

---

### Workflow 3: Tự chọn (Hoàn toàn kiểm soát)

```bash
# Tạo transaction với category rõ ràng
POST /transactions
{
  "amount": 500000,
  "category": "housing",
  "note": "Tiền thuê nhà tháng 12",
  "dateTime": "2024-12-01T00:00:00Z"
}

# AI không được gọi, dùng lựa chọn của bạn
```

**→ Phù hợp khi:** Biết chắc category, muốn 100% chính xác

---

## 📈 Cải thiện độ chính xác AI

### Tips để AI dự đoán chính xác hơn:

#### ✅ GOOD - Note rõ ràng
```
✅ "Cơm trưa Phở 24"         → food (95%)
✅ "Grab bike về nhà"        → transport (88%)
✅ "Vé xem phim CGV"         → entertainment (92%)
✅ "Khám bệnh tại BV"        → healthcare (91%)
```

#### ❌ BAD - Note mơ hồ
```
❌ "Thanh toán"              → other (35%)
❌ "Mua đồ"                  → other (42%)
❌ "abc xyz"                 → other (10%)
❌ ""                        → other (default)
```

### Nguyên tắc viết note tốt:
1. **Có từ khóa rõ ràng**: "Phở", "Grab", "Netflix", "Khám bệnh"
2. **Có tên thương hiệu**: "Highlands", "CGV", "Shopee"
3. **Tránh quá ngắn gọn**: "Ăn" → Nên viết "Ăn trưa"
4. **Có ngữ cảnh**: "Grab" → Nên viết "Grab về nhà" hoặc "Grabfood"

---

## 🔮 Phase 2 vs Phase 1

### Phase 1 (Keyword-based) - Hiện tại
- **Accuracy**: 75-85%
- **Cách hoạt động**: Tìm từ khóa trong note
- **Ưu điểm**: Nhanh (~2ms), không cần training
- **Nhược điểm**: Không hiểu ngữ cảnh, không xử lý typo

### Phase 2 (PhoBERT Ensemble) - Nâng cấp
- **Accuracy**: 90-95%
- **Cách hoạt động**: Deep learning model + Keyword ensemble
- **Ưu điểm**: Hiểu ngữ cảnh, xử lý typo, slang
- **Nhược điểm**: Chậm hơn (~50ms), cần Python service

**→ Xem [AI_PHASE_2_COMPLETE.md](../AI_PHASE_2_COMPLETE.md) để bật Phase 2**

---

## 🐛 FAQs

### Q1: AI có ghi đè category tôi chọn không?
**A:** KHÔNG! Nếu bạn cung cấp `category`, AI sẽ KHÔNG được gọi. Lựa chọn của bạn luôn được tôn trọng.

### Q2: AI sai thì làm sao?
**A:**
- **Option 1**: Update transaction sau (PATCH /transactions/:id)
- **Option 2**: Lần sau tự chọn category thay vì để AI
- **Option 3**: Gọi `/predict-category` trước để xem gợi ý

### Q3: Làm sao biết AI đã dự đoán hay tôi tự chọn?
**A:** Kiểm tra logs:
- `[AI Auto-categorization] ✅` → AI đã dự đoán
- `[User choice] 👤` → Bạn tự chọn
- `[Default fallback]` → Mặc định "other"

### Q4: Tôi muốn AI học từ dữ liệu của tôi?
**A:** Phase 3 sẽ có tính năng này! AI sẽ học từ:
- Transactions bạn tạo
- Các lần bạn override AI prediction
- Patterns cá nhân của bạn

### Q5: Có thể tắt AI không?
**A:** Có! Chỉ cần luôn cung cấp `category` khi tạo transaction. AI sẽ KHÔNG được gọi.

### Q6: Tại sao AI chọn "other"?
**A:** 3 lý do:
1. Note quá mơ hồ → Confidence < 50%
2. Không có note
3. ML Service lỗi (fallback an toàn)

---

## 🎯 Best Practices

### 1. Khi nào nên TỰ CHỌN category:
- ✅ Giao dịch quan trọng (tiền lớn)
- ✅ Category đặc biệt (housing, education)
- ✅ Muốn 100% chính xác

### 2. Khi nào nên ĐỂ AI:
- ✅ Giao dịch thường ngày (ăn uống, di chuyển)
- ✅ Note rõ ràng
- ✅ Muốn tạo nhanh

### 3. Khi nào nên XEM GỢI Ý TRƯỚC:
- ✅ Không chắc category nào phù hợp
- ✅ Giao dịch mơ hồ
- ✅ Muốn học cách AI phân loại

---

## 📞 Hỗ trợ

- **API Documentation**: http://localhost:3001/api (Swagger)
- **Test UI**: [test-ui/](../test-ui/)
- **Technical Docs**: [AI_AUTO_CATEGORIZATION.md](AI_AUTO_CATEGORIZATION.md)

---

**🎉 Chúc bạn sử dụng AI Auto-categorization hiệu quả!**

---

**Version**: 2.0.0
**Date**: 2024-12-21
**Accuracy**: 90-95% (Phase 2)
**Respects user choice**: ✅ Always

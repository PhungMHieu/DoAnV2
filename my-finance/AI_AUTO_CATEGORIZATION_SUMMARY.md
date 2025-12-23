# 🤖 AI Auto-Categorization - Tóm tắt

## Nguyên tắc vàng

> **AI CHỈ gợi ý khi bạn KHÔNG tự chọn category!**

---

## 3 Trường hợp

### 1. ✅ Bạn TỰ CHỌN category
```json
{
  "amount": 50000,
  "category": "food",  ← Bạn chọn
  "note": "Ăn trưa"
}
```
**→ AI KHÔNG được gọi, dùng lựa chọn của bạn**

---

### 2. 🤖 Bạn KHÔNG chọn, có note
```json
{
  "amount": 50000,
  "note": "Cơm trưa Phở 24"  ← AI phân tích
}
```
**→ AI dự đoán: `category = "food"` (85% confidence)**

---

### 3. 📦 Không có cả category lẫn note
```json
{
  "amount": 50000
}
```
**→ Mặc định: `category = "other"`**

---

## Logic hoạt động

```typescript
if (user_provided_category) {
  // ✅ Dùng lựa chọn của user
  category = user_provided_category;

} else if (note_exists) {
  // 🤖 Gọi AI dự đoán
  ai_prediction = predictCategory(note);

  if (ai_prediction.confidence >= 0.5) {
    category = ai_prediction.category;
  } else {
    category = "other"; // Confidence thấp
  }

} else {
  // 📦 Fallback mặc định
  category = "other";
}
```

---

## API Endpoints

### Tạo transaction (auto-categorization)
```bash
POST /transactions
{
  "amount": 50000,
  "category": "food",  # Optional - AI dự đoán nếu không có
  "note": "Lunch",
  "dateTime": "2024-12-21T12:00:00Z"
}
```

### Xem gợi ý AI trước khi tạo
```bash
POST /transactions/predict-category
{
  "note": "Grab về nhà",
  "amount": 35000
}

# Response:
{
  "category": "transport",
  "confidence": 0.88,
  "suggestions": [
    {"category": "transport", "confidence": 0.88},
    {"category": "food", "confidence": 0.09},
    {"category": "other", "confidence": 0.03}
  ],
  "model": "keyword-matcher-v1"
}
```

---

## Logs giải thích

```bash
# User tự chọn category
[User choice] 👤 User manually selected category: "food"

# AI dự đoán thành công
[AI Auto-categorization] ✅ Predicted "food" with 85.0% confidence

# AI confidence thấp → fallback
[AI Auto-categorization] ⚠️ Low confidence (35.0%), using fallback "other"

# AI lỗi → fallback
[AI Auto-categorization] ❌ Failed: Connection timeout

# Không có category + note → fallback
[Default fallback] Using "other" category
```

---

## 11 Categories

| Category | Tiếng Việt | Example |
|----------|------------|---------|
| `income` | Thu nhập | Lương tháng 12 |
| `food` | Đồ ăn | Cơm trưa Phở 24 |
| `transport` | Di chuyển | Grab về nhà |
| `entertainment` | Giải trí | Vé xem phim |
| `shopping` | Mua sắm | Áo Uniqlo |
| `healthcare` | Y tế | Khám bệnh |
| `education` | Giáo dục | Học phí |
| `bills` | Hóa đơn | Điện nước |
| `housing` | Nhà ở | Tiền thuê nhà |
| `personal` | Cá nhân | Cắt tóc |
| `other` | Khác | Khác |

---

## Performance

| Metric | Phase 1 | Phase 2 |
|--------|---------|---------|
| Accuracy | 75-85% | 90-95% |
| Latency | ~2ms | ~50ms |
| Semantic understanding | ❌ | ✅ |
| Handles typos | ❌ | ✅ |

---

## Tips để AI dự đoán chính xác

### ✅ GOOD - Note rõ ràng
```
"Cơm trưa Phở 24"        → food (95%)
"Grab bike về nhà"       → transport (88%)
"Vé xem phim CGV"        → entertainment (92%)
```

### ❌ BAD - Note mơ hồ
```
"Thanh toán"             → other (35%)
"Mua đồ"                 → other (42%)
""                       → other (default)
```

---

## FAQs

**Q: AI có ghi đè category tôi chọn không?**
A: **KHÔNG!** Lựa chọn của bạn luôn được tôn trọng.

**Q: AI sai thì sao?**
A: Update transaction sau hoặc lần sau tự chọn category.

**Q: Làm sao tắt AI?**
A: Luôn cung cấp `category` khi tạo transaction.

---

## Documentation

- **User Guide**: [docs/AI_AUTO_CATEGORIZATION_USER_GUIDE.md](docs/AI_AUTO_CATEGORIZATION_USER_GUIDE.md)
- **Technical**: [docs/AI_AUTO_CATEGORIZATION.md](docs/AI_AUTO_CATEGORIZATION.md)
- **Phase 2**: [AI_PHASE_2_COMPLETE.md](AI_PHASE_2_COMPLETE.md)

---

**🎯 Tóm lại: AI giúp bạn nhanh hơn, nhưng BẠN luôn là người quyết định!**

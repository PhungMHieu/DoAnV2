# 🧪 AI Auto-Categorization Test UI

Giao diện web đơn giản để test tính năng AI Auto-categorization của My Finance.

## 📋 Tính năng

### 1. Test Prediction API
- Test trực tiếp ML Service endpoint `/predict-category`
- Nhập mô tả giao dịch và số tiền
- Xem kết quả dự đoán với confidence score
- Hiển thị các gợi ý category khác

### 2. Test Create Transaction với AI
- Test Transaction Service endpoint `/transactions`
- Auto-suggest category trước khi tạo transaction
- Tạo transaction với category được AI predict tự động

### 3. Test Batch Prediction
- Test endpoint `/batch-predict-category`
- Predict nhiều transactions cùng lúc
- Input JSON array

## 🚀 Cách sử dụng

### Bước 1: Start Services

```bash
# Start ML Service
npm run start:dev ml-service

# Hoặc start all services
docker-compose up -d
```

### Bước 2: Mở Test UI

**Option A: Trực tiếp từ file**
```bash
# Mở file HTML trong browser
open test-ui/index.html

# Hoặc trên Windows
start test-ui/index.html
```

**Option B: Dùng simple HTTP server**
```bash
# Python 3
cd test-ui
python3 -m http.server 8080

# Hoặc dùng npx
npx http-server test-ui -p 8080

# Mở browser
open http://localhost:8080
```

### Bước 3: Test các tính năng

#### A. Test Prediction API

1. Chọn ví dụ nhanh hoặc nhập mô tả giao dịch
2. Nhập số tiền (optional)
3. Click "Dự đoán Category"
4. Xem kết quả với confidence score

**Ví dụ:**
- Mô tả: "Mua cơm trưa quán Phở 24"
- Số tiền: 50000
- Kết quả: `food` (85% confidence)

#### B. Test Auto-Suggest

1. Nhập mô tả giao dịch
2. Click "Auto-Suggest Category"
3. Xem category được predict
4. Click "Tạo Transaction" (cần JWT token)

**Lưu ý:** Endpoint tạo transaction cần authentication. Để test:
1. Đăng nhập qua Auth Service để lấy JWT token
2. Sửa code trong `script.js` để thêm token vào header:
```javascript
headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
}
```

#### C. Test Batch Prediction

1. Nhập JSON array với danh sách transactions
2. Click "Batch Predict"
3. Xem kết quả cho tất cả transactions

**Ví dụ JSON:**
```json
[
  {"note": "Mua cơm trưa", "amount": 50000},
  {"note": "Grab về nhà", "amount": 30000},
  {"note": "Netflix tháng này", "amount": 260000}
]
```

## ⚙️ Cấu hình

### Service URLs

Mặc định:
- **ML Service**: `http://localhost:3005`
- **Transaction Service**: `http://localhost:3001`

Có thể thay đổi trong phần "Cấu hình" của UI.

### CORS

Nếu gặp lỗi CORS, đảm bảo services đã enable CORS:

**ML Service** (`apps/ml-service/src/main.ts`):
```typescript
app.enableCors({
  origin: true,
  credentials: true,
});
```

**Transaction Service** - Đã được enable sẵn.

## 🎨 Screenshots mô tả

### Test Prediction
- Nhập mô tả: "Cafe Highlands Coffee"
- Kết quả: `food` với 88% confidence
- Suggestions: `entertainment` (10%), `other` (2%)

### Test Auto-Suggest
- Nhập: "Grab đi làm"
- AI suggest: `transport` (92%)
- Create transaction với category tự động

### Batch Prediction
- Input 10 transactions
- Kết quả hiển thị category cho từng transaction
- Tốc độ xử lý: ~50ms cho 10 items

## 🐛 Troubleshooting

### Lỗi: "Failed to fetch"
**Nguyên nhân:** ML Service chưa chạy hoặc sai URL

**Giải pháp:**
1. Check ML Service đang chạy:
```bash
curl http://localhost:3005/api
```

2. Check console log trong browser để xem error chi tiết

### Lỗi: "CORS policy"
**Nguyên nhân:** CORS chưa được enable

**Giải pháp:**
1. Đảm bảo `app.enableCors()` trong `main.ts`
2. Restart service

### Lỗi: "401 Unauthorized" khi tạo transaction
**Nguyên nhân:** Chưa có JWT token

**Giải pháp:**
1. Đăng nhập qua Auth Service để lấy token
2. Sửa code thêm token vào header (xem hướng dẫn trên)

### Confidence luôn thấp
**Nguyên nhân:** Keywords chưa đủ

**Giải pháp:**
1. Thêm keywords vào `category.constants.ts`
2. Restart ML Service

## 📊 Test Cases gợi ý

### Food
```
"Mua cơm trưa quán Phở 24" → food (85%)
"Cafe Highlands Coffee sữa đá" → food (88%)
"GrabFood ship đồ ăn" → food (92%)
"Ăn tối buffet lẩu" → food (90%)
```

### Transport
```
"Grab về nhà" → transport (95%)
"Đổ xăng xe" → transport (90%)
"Vé xe buýt" → transport (88%)
"Taxi đi sân bay" → transport (93%)
```

### Entertainment
```
"Xem phim CGV" → entertainment (87%)
"Netflix subscription" → entertainment (91%)
"Du lịch Đà Lạt" → entertainment (82%)
"Karaoke với bạn" → entertainment (89%)
```

### Shopping
```
"Shopee mua quần áo" → shopping (90%)
"Lazada order điện thoại" → shopping (92%)
"Mua giày Nike" → shopping (88%)
```

### Income
```
"Tiền lương tháng 12" → income (95%)
"Thưởng cuối năm" → income (93%)
"Nhận tiền freelance" → income (89%)
```

## 🔧 Customization

### Thêm category mới

1. Sửa `category.constants.ts` thêm category
2. Thêm emoji trong `script.js`:
```javascript
const emojiMap = {
    'new_category': '🆕',
    // ...
};
```
3. Restart ML Service

### Thay đổi theme màu

Sửa CSS trong `index.html`:
```css
/* Primary color */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Thay bằng màu khác */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

## 📁 File Structure

```
test-ui/
├── index.html      # Main UI
├── script.js       # JavaScript logic
└── README.md       # This file
```

## 🚀 Next Steps

Sau khi test thành công:
1. Tích hợp vào frontend chính của My Finance
2. Thêm authentication flow đầy đủ
3. Deploy lên production
4. Monitor accuracy và improve keywords

## 📞 Support

Nếu gặp vấn đề:
1. Check service logs: `docker logs my-finance-ml`
2. Review [AI_AUTO_CATEGORIZATION.md](../docs/AI_AUTO_CATEGORIZATION.md)
3. Check ML Service Swagger: http://localhost:3005/api

---

**Happy Testing! 🧪✨**

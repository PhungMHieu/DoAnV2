# Phase 1: ML Transaction Classification System

## Tổng quan

Phase 1 tập trung xây dựng hệ thống phân loại giao dịch tự động cho ứng dụng My Finance, sử dụng kết hợp Machine Learning và Rule-based approach để đạt độ chính xác cao nhất.

---

## Cơ sở lý thuyết

> **Lưu ý về thứ tự phát triển:** Trong dự án này, hệ thống phân loại được xây dựng theo thứ tự:
> 1. **Rule-based Keyword Matching** (cơ bản) - Nhanh, dễ hiểu
> 2. **Enhanced Keyword Matching** - Cải tiến với N-gram, weighting, negative keywords
> 3. **Machine Learning (TF-IDF + SVM)** - Học từ dữ liệu, độ chính xác cao
>
> Phần lý thuyết dưới đây được trình bày theo đúng thứ tự này.

### 1. Bài toán phân loại văn bản (Text Classification)

#### 1.1 Định nghĩa

Phân loại văn bản (Text Classification) là bài toán trong Xử lý Ngôn ngữ Tự nhiên (NLP) nhằm gán nhãn (label/category) cho một đoạn văn bản dựa trên nội dung của nó.

**Công thức toán học:**

Cho tập văn bản $D = \{d_1, d_2, ..., d_n\}$ và tập nhãn $C = \{c_1, c_2, ..., c_k\}$

Mục tiêu: Tìm hàm phân loại $f: D \rightarrow C$ sao cho $f(d_i) = c_j$ với $c_j$ là nhãn chính xác của văn bản $d_i$

#### 1.2 Ứng dụng trong My Finance

| Yếu tố | Áp dụng |
|--------|---------|
| Văn bản đầu vào | Mô tả giao dịch tiếng Việt ("ăn phở 50k", "grab đi làm") |
| Tập nhãn | 17 categories (food, transportation, shopping, ...) |
| Mục tiêu | Tự động phân loại giao dịch để quản lý chi tiêu |

#### 1.3 Hai hướng tiếp cận chính

| Hướng tiếp cận | Mô tả | Ưu điểm | Nhược điểm |
|----------------|-------|---------|------------|
| **Rule-based** | Dựa trên quy tắc do chuyên gia định nghĩa | Nhanh, dễ hiểu, không cần training data | Khó mở rộng, cần maintain thủ công |
| **Machine Learning** | Học từ dữ liệu training | Tự động học pattern, dễ mở rộng | Cần nhiều data, "black box" |

**Chiến lược Hybrid trong My Finance:**
- Bắt đầu với Rule-based để có kết quả ngay
- Cải tiến với Enhanced Keyword
- Bổ sung ML để nâng cao accuracy
- Kết hợp cả hai để có kết quả tốt nhất

---

## PHẦN I: RULE-BASED CLASSIFICATION

### 2. Keyword Matching cơ bản

#### 2.1 Khái niệm

Rule-based Classification là phương pháp phân loại dựa trên các quy tắc (rules) được định nghĩa trước bởi chuyên gia, không cần training từ dữ liệu.

**So sánh với Machine Learning:**

| Tiêu chí | Rule-based | Machine Learning |
|----------|------------|------------------|
| Cần dữ liệu training | Không | Có |
| Dễ giải thích | Cao | Thấp |
| Khả năng mở rộng | Thủ công | Tự động |
| Xử lý edge cases | Tốt | Phụ thuộc data |
| Thời gian phát triển | Nhanh ban đầu | Cần thu thập data |

#### 2.2 Thuật toán Basic Keyword Matching

```
Algorithm: Basic Keyword Matching
Input: text T, keyword_map K = {category: [keywords]}
Output: category C

1. Normalize text: T' = lowercase(T)
2. For each category c in K:
      score[c] = 0
      For each keyword k in K[c]:
          If k in T':
              score[c] += 1
3. Return argmax(score)
```

**Ví dụ:**

```
Input: "đi grab về nhà 30k"
Keywords:
  - transportation: ["grab", "taxi", "xe", "đi"]
  - food: ["ăn", "phở", "cơm"]
  - home: ["nhà", "thuê"]

Matching:
  - transportation: "grab" ✓, "đi" ✓ → score = 2
  - food: (không match) → score = 0
  - home: "nhà" ✓ → score = 1

Output: transportation (score cao nhất)
```

#### 2.3 Vấn đề với Basic Keyword Matching

| Vấn đề | Ví dụ | Kết quả sai |
|--------|-------|-------------|
| Keyword chung chung | "đi ăn phở" | transportation (vì "đi") |
| Từ ghép | "grab food" | transportation (vì "grab") |
| Đồng âm | "bánh xe" vs "bánh mì" | food (vì "bánh") |
| Teencode | "cf vs bn" | other (không nhận ra) |

### 3. Enhanced Keyword Matching

Cải tiến từ basic matching để giải quyết các vấn đề trên:

#### 3.1 N-gram Priority (Ưu tiên cụm từ)

**Nguyên lý:** Cụm từ dài hơn → specific hơn → ưu tiên cao hơn

**Định nghĩa N-gram:**

N-gram là chuỗi liên tiếp gồm $n$ phần tử (từ, ký tự) được trích xuất từ văn bản.

| Loại | N | Ví dụ từ "ăn phở buổi sáng" |
|------|---|----------------------------|
| Unigram | 1 | "ăn", "phở", "buổi", "sáng" |
| Bigram | 2 | "ăn phở", "phở buổi", "buổi sáng" |
| Trigram | 3 | "ăn phở buổi", "phở buổi sáng" |

**Công thức priority:**

$$Priority(phrase) = length(phrase) \times base\_weight$$

**Thuật toán:**

```
Algorithm: N-gram Priority Matching
Input: text T, ngram_rules R sorted by length DESC

1. matched_phrases = []
2. For each rule r in R (longest first):
      If r.phrase in T AND not overlapping with matched_phrases:
          matched_phrases.append(r)
          score[r.category] += r.weight
3. Return argmax(score)
```

**Ví dụ giải quyết vấn đề "grab food":**

```
Input: "đặt grab food về nhà"

Với Basic (Unigram only):
  - "grab" → transportation ✓
  - "food" → food ✓
  → Kết quả không rõ ràng

Với N-gram Priority:
  N-gram rules (sorted by length):
    - "grab food" → food (weight=1.5, length=2)
    - "grab" → transportation (weight=1.0, length=1)
    - "food" → food (weight=0.8, length=1)

  Matching process:
    1. Check "grab food" (length=2) → MATCH → food +1.5
    2. Check "grab" (length=1) → SKIP (đã match trong "grab food")
    3. Check "food" (length=1) → SKIP (đã match)

Output: food (không bị nhầm với transportation)
```

#### 3.2 Keyword Weighting (Trọng số từ khóa)

**Nguyên lý:** Từ khóa specific → weight cao, từ khóa chung → weight thấp

**Công thức tính score:**

$$Score(c) = \sum_{k \in matched\_keywords} weight(k) \times category\_match(k, c)$$

**Phân loại weight:**

| Weight Range | Loại từ khóa | Ví dụ |
|--------------|--------------|-------|
| 1.3 - 1.5 | Brand names, very specific | grabfood, shopeefood, netflix |
| 1.0 | Specific keywords | phở, taxi, shopee |
| 0.7 - 0.9 | Semi-specific | ăn, mua, đi |
| 0.3 - 0.5 | Generic keywords | tiền, cái, này |

**Ví dụ:**

```
Input: "mua đồ trên shopee"
Matching:
  - "mua" → shopping (weight=0.5)
  - "shopee" → shopping (weight=1.3)

Score(shopping) = 0.5 + 1.3 = 1.8

Nếu không có weighting:
  Score(shopping) = 1 + 1 = 2 (không phân biệt được importance)
```

#### 3.3 Negative Keywords (Từ khóa loại trừ)

**Nguyên lý:** Một số từ khóa khi xuất hiện cùng nhau sẽ loại trừ category thường gặp

**Công thức:**

$$Score_{final}(c) = Score(c) - \sum_{nk \in negative\_keywords} penalty(nk, c)$$

**Ví dụ negative rules:**

| Phrase | Loại trừ category | Lý do |
|--------|-------------------|-------|
| "grab food" | transportation | "grab food" là dịch vụ đồ ăn |
| "bánh xe" | food | "bánh" ở đây là phụ tùng xe |
| "ăn mặc" | food | "ăn mặc" là quần áo |
| "tiền nhà" | income | "tiền nhà" là chi phí, không phải thu nhập |

**Thuật toán:**

```
Algorithm: Negative Keyword Filtering
Input: text T, category C, negative_rules N

1. For each rule n in N:
      If n.phrase in T AND n.excludes == C:
          Return True (exclude this category)
2. Return False
```

#### 3.4 Text Normalization cho tiếng Việt

**Các thách thức với tiếng Việt:**

| Thách thức | Ví dụ | Giải pháp |
|------------|-------|-----------|
| Dấu thanh | "phở" vs "pho" | Hỗ trợ cả hai dạng |
| Teencode | "cf", "k", "đc" | Mapping sang tiếng Việt chuẩn |
| Typo | "grap", "shoppee" | Sửa lỗi chính tả |
| Unicode | Nhiều dạng encode | Chuẩn hóa NFC |

**Pipeline xử lý:**

```
Pipeline: Vietnamese Text Normalization

1. Unicode Normalization (NFC)
   "cafe\u0301" → "café" → "cafe"

2. Lowercase
   "GRAB ĐI LÀM" → "grab đi làm"

3. Teencode Expansion
   "cf vs bn 25k" → "cafe với bạn 25k"

4. Typo Correction
   "grap đi làm" → "grab đi làm"
   "shoppee" → "shopee"

5. Diacritics Handling
   Keep both: "phở" and "pho" đều match
```

**Bảng Teencode phổ biến:**

| Teencode | Mở rộng | Category liên quan |
|----------|---------|-------------------|
| cf, cofe | cafe | food |
| k, ko, k0 | không | - |
| dc, đc | được | - |
| vs | với | - |
| bn, b | bạn | - |
| a | anh | - |
| e | em | - |
| j | gì | - |
| r | rồi | - |

#### 3.5 Amount-based Hints (Gợi ý theo số tiền)

**Nguyên lý:** Số tiền giao dịch có thể gợi ý category

**Bảng amount hints:**

| Khoảng tiền | Categories khả năng cao | Lý do |
|-------------|-------------------------|-------|
| < 50,000 | food, transportation | Bữa ăn nhỏ, xe ôm |
| 50,000 - 200,000 | food, entertainment | Ăn nhà hàng, xem phim |
| 200,000 - 1,000,000 | shopping, health | Mua đồ, khám bệnh |
| 1,000,000 - 5,000,000 | education, travel, home | Học phí, du lịch |
| > 5,000,000 | home, investment | Tiền nhà, đầu tư |

**Công thức điều chỉnh:**

$$Score_{adjusted}(c) = Score(c) \times (1 + \alpha \times amount\_hint(c, amount))$$

Với $\alpha$ là hệ số điều chỉnh (thường = 0.1-0.2)

#### 3.6 Confidence Score Calculation

**Công thức tính confidence:**

$$Confidence(c) = \frac{Score(c)}{\sum_{c' \in C} Score(c')}$$

Nếu chỉ có 1 category match:

$$Confidence(c) = min(1.0, base\_confidence + bonus)$$

Với:
- $base\_confidence = 0.7$
- $bonus$ phụ thuộc vào số keywords match và weight

#### 3.7 So sánh Basic vs Enhanced Keyword

| Test Case | Basic Result | Enhanced Result | Correct |
|-----------|--------------|-----------------|---------|
| "grab food 50k" | transportation | food | food ✓ |
| "đi ăn phở" | transportation | food | food ✓ |
| "cf vs bn" | other | food | food ✓ |
| "mua bánh xe" | food | transportation | transportation ✓ |
| "tiền nhà tháng 5" | income | home | home ✓ |

#### 3.8 Ưu điểm của Rule-based trong My Finance

1. **Interpretability**: Dễ giải thích tại sao phân loại như vậy
2. **No Training Required**: Hoạt động ngay lập tức
3. **Edge Case Handling**: Xử lý tốt các trường hợp đặc biệt
4. **Fallback Mechanism**: Backup cho ML khi confidence thấp
5. **Domain Knowledge**: Tận dụng kiến thức chuyên gia về tài chính cá nhân

### 4. Sentence Segmentation (Tách câu)

#### 4.1 Khái niệm

Sentence Segmentation là quá trình chia một đoạn văn bản dài thành các câu/cụm từ riêng biệt, mỗi câu đại diện cho một giao dịch.

**Tại sao cần tách câu?**

Người dùng thường nhập nhiều giao dịch cùng lúc:
```
"ăn phở 50k. đi grab 30k. mua sách 100k"
"hôm nay mua cà phê 25k và ăn trưa 45k rồi đổ xăng 80k"
```

#### 4.2 Thuật toán tách câu

```
Algorithm: Vietnamese Sentence Segmentation
Input: text T
Output: sentences[] S

1. Split by line breaks: lines = T.split(/\r?\n/)

2. For each line in lines:
      segments = line.split(delimiter_pattern)
      S.append(segments)

3. Clean and filter:
      S = S.map(trim).filter(not_empty)

4. Return S
```

**Delimiter Pattern:**

```javascript
// Dấu câu
/[.。！!？?;；,，]+\s*/

// Từ nối tiếng Việt
/(?:\s+và\s+)/      // "và"
/(?:\s+còn\s+)/     // "còn"
/(?:\s+rồi\s+)/     // "rồi"
/(?:\s+nữa\s+)/     // "nữa"
/(?:\s+thêm\s+)/    // "thêm"
```

#### 4.3 Ví dụ tách câu

**Input:**
```
"tôi đi chơi với bạn và đã mua 1 cái tạp dề 50k. Chúng tôi còn ăn phở 90k"
```

**Process:**
```
Step 1: Split by delimiters (. và còn)
  → ["tôi đi chơi với bạn", "đã mua 1 cái tạp dề 50k", "Chúng tôi", "ăn phở 90k"]

Step 2: Filter (chỉ giữ câu có amount)
  → ["đã mua 1 cái tạp dề 50k", "ăn phở 90k"]

Step 3: Analyze each
  → Transaction 1: {sentence: "đã mua 1 cái tạp dề 50k", amount: 50000, category: "shopping"}
  → Transaction 2: {sentence: "ăn phở 90k", amount: 90000, category: "food"}
```

#### 4.4 Code Implementation

**File:** [ml-service.controller.ts](apps/ml-service/src/ml-service.controller.ts#L38-L59)

```typescript
// Step 1: Split text into sentences
let rawSentences: string[] = [];

// Split by newlines first
const lineBreakPattern = /\r?\n/;
const lines = dto.text.split(lineBreakPattern);

// Then split each line by other delimiters
const delimiterPattern =
  /[.。！!？?;；,，]+\s*|(?:\s+và\s+)|(?:\s+còn\s+)|(?:\s+rồi\s+)|(?:\s+nữa\s+)|(?:\s+thêm\s+)/gi;

for (const line of lines) {
  if (line.trim().length > 0) {
    const segments = line.split(delimiterPattern);
    rawSentences.push(...segments);
  }
}

// Clean and filter empty sentences
rawSentences = rawSentences
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
```

#### 4.5 Xử lý sau khi tách câu

Sau khi tách câu, mỗi câu sẽ được:

1. **Extract Amount**: Trích xuất số tiền từ câu
2. **Filter**: Chỉ giữ các câu có amount > 0
3. **Predict Category**: Dự đoán category cho mỗi câu

```
┌─────────────────────────────────────────────────────────────┐
│              Input: Multi-transaction Text                   │
│  "ăn phở 50k. đi grab 30k rồi mua sách 100k"                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Sentence Segmentation                           │
│  Split by: . , và, còn, rồi, nữa, thêm                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Sentences: ["ăn phở 50k", "đi grab 30k", "mua sách 100k"]  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │ Extract │    │ Extract │    │ Extract │
         │ Amount  │    │ Amount  │    │ Amount  │
         │  50000  │    │  30000  │    │ 100000  │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
              ▼              ▼              ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │ Predict │    │ Predict │    │ Predict │
         │Category │    │Category │    │Category │
         │  food   │    │transport│    │shopping │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
              └───────────────┼───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Output: 3 Transactions                    │
│  [{sentence, amount, category}, ...]                        │
└─────────────────────────────────────────────────────────────┘
```

#### 4.6 Các trường hợp đặc biệt

| Input | Xử lý | Kết quả |
|-------|-------|---------|
| "ăn sáng 30k\ntrưa 45k" | Split by `\n` | 2 transactions |
| "cafe 25k, bánh mì 15k" | Split by `,` | 2 transactions |
| "mua áo và quần 200k" | Không tách (amount chung) | 1 transaction |
| "đi siêu thị mua đồ" | Không có amount | 0 transactions |
| "50k phở, 30k grab" | Amount ở đầu | 2 transactions |

---

## PHẦN II: MACHINE LEARNING CLASSIFICATION

### 5. TF-IDF (Term Frequency - Inverse Document Frequency)

#### 5.1 Khái niệm

TF-IDF là phương pháp biểu diễn văn bản dưới dạng vector số, đánh giá tầm quan trọng của một từ trong văn bản so với toàn bộ tập văn bản.

#### 5.2 Công thức toán học

**Term Frequency (TF):** Tần suất xuất hiện của từ $t$ trong văn bản $d$

$$TF(t, d) = \frac{f_{t,d}}{\sum_{t' \in d} f_{t',d}}$$

Trong đó:
- $f_{t,d}$: Số lần từ $t$ xuất hiện trong văn bản $d$
- $\sum_{t' \in d} f_{t',d}$: Tổng số từ trong văn bản $d$

**Inverse Document Frequency (IDF):** Độ hiếm của từ $t$ trong toàn bộ tập văn bản

$$IDF(t, D) = \log \frac{N}{|\{d \in D : t \in d\}|}$$

Trong đó:
- $N$: Tổng số văn bản trong tập $D$
- $|\{d \in D : t \in d\}|$: Số văn bản chứa từ $t$

**TF-IDF:** Tích của TF và IDF

$$TF\text{-}IDF(t, d, D) = TF(t, d) \times IDF(t, D)$$

#### 5.3 Sublinear TF Scaling

Để giảm ảnh hưởng của các từ xuất hiện quá nhiều lần, sử dụng sublinear scaling:

$$TF_{sublinear}(t, d) = 1 + \log(TF(t, d)) \text{ if } TF(t, d) > 0$$

#### 5.4 Ví dụ minh họa

| Văn bản | Từ | TF | IDF | TF-IDF |
|---------|-----|-----|-----|--------|
| "ăn phở buổi sáng" | phở | 0.25 | 2.3 | 0.575 |
| "ăn phở buổi sáng" | ăn | 0.25 | 0.5 | 0.125 |
| "đi grab về nhà" | grab | 0.25 | 1.8 | 0.450 |

**Nhận xét:** Từ "phở" có TF-IDF cao hơn "ăn" vì "phở" xuất hiện ít hơn trong toàn bộ dataset (IDF cao hơn), do đó mang nhiều thông tin phân biệt hơn.

### 6. N-gram trong Machine Learning

#### 6.1 N-gram cho TF-IDF

Khác với N-gram trong Enhanced Keyword (dùng để match cụm từ cố định), N-gram trong TF-IDF được dùng để tạo features cho model:

**Cấu hình N-gram trong dự án:**

```python
TFIDF_PARAMS = {
    'ngram_range': (1, 3),  # Sử dụng unigram, bigram, trigram
    'max_features': 5000,   # Giới hạn 5000 features
}
```

#### 6.2 Tại sao dùng N-gram cho ML?

- **Unigram** (1-gram): Bắt nghĩa từng từ
- **Bigram** (2-gram): Bắt cụm 2 từ như "grab food", "tiền nhà"
- **Trigram** (3-gram): Bắt cụm 3 từ như "quỹ vì trẻ em"

**Ví dụ features được tạo:**

```
Input: "ăn phở buổi sáng"

Features (5000 max):
- Unigrams: "ăn", "phở", "buổi", "sáng"
- Bigrams: "ăn phở", "phở buổi", "buổi sáng"
- Trigrams: "ăn phở buổi", "phở buổi sáng"
```

### 7. Support Vector Machine (SVM)

#### 7.1 Khái niệm

SVM là thuật toán học máy có giám sát (supervised learning) dùng để phân loại dữ liệu bằng cách tìm siêu phẳng (hyperplane) tối ưu phân tách các lớp.

#### 7.2 Công thức toán học

**Siêu phẳng phân tách:**

$$f(x) = w^T x + b = 0$$

Trong đó:
- $w$: Vector trọng số (weight vector)
- $x$: Vector đặc trưng của văn bản (TF-IDF vector)
- $b$: Bias term

**Hàm quyết định:**

$$y = sign(w^T x + b)$$

- $y = +1$: Thuộc lớp dương
- $y = -1$: Thuộc lớp âm

#### 7.3 Bài toán tối ưu hóa

Mục tiêu: Tìm siêu phẳng có margin lớn nhất

$$\min_{w, b} \frac{1}{2} ||w||^2$$

Ràng buộc:

$$y_i(w^T x_i + b) \geq 1, \forall i = 1, ..., n$$

#### 7.4 Soft Margin SVM

Cho phép một số điểm nằm sai phía của siêu phẳng (để xử lý nhiễu):

$$\min_{w, b, \xi} \frac{1}{2} ||w||^2 + C \sum_{i=1}^{n} \xi_i$$

Trong đó:
- $C$: Regularization parameter (cân bằng giữa margin và lỗi)
- $\xi_i$: Slack variables (cho phép sai số)

#### 7.5 Linear Kernel

Với bài toán phân loại văn bản, Linear Kernel thường hiệu quả nhất:

$$K(x_i, x_j) = x_i^T x_j$$

**Lý do sử dụng Linear Kernel:**
- Số chiều cao (5000 features từ TF-IDF)
- Dữ liệu văn bản thường tách tuyến tính trong không gian cao chiều
- Nhanh hơn các kernel phức tạp (RBF, Polynomial)

#### 7.6 Multi-class Classification

Vì có 17 categories, sử dụng chiến lược **One-vs-Rest (OvR)**:

```
Bước 1: Train classifier C1: food vs (tất cả còn lại)
Bước 2: Train classifier C2: transportation vs (tất cả còn lại)
...
Bước 17: Train classifier C17: other vs (tất cả còn lại)

Prediction: Chọn class có score cao nhất
```

#### 7.7 Probability Estimation (Platt Scaling)

Để có được xác suất từ SVM (vốn chỉ cho score), sử dụng Platt Scaling:

$$P(y = 1 | f(x)) = \frac{1}{1 + e^{Af(x) + B}}$$

Trong đó $A$ và $B$ được ước lượng bằng cross-validation.

### 8. Text Preprocessing cho ML Model

> **Lưu ý:** Phần này mở rộng từ Text Normalization trong Enhanced Keyword (section 3.4), với các xử lý bổ sung cho ML.

#### 8.1 Pipeline xử lý trong Python ML

```python
def preprocess_text(text):
    # 1. Unicode normalization (NFC)
    text = normalize_unicode(text)

    # 2. Lowercase
    text = text.lower()

    # 3. Apply typo corrections
    text = apply_typo_corrections(text)

    # 4. Apply teencode mapping
    text = apply_teencode_map(text)

    # 5. Remove special characters (keep Vietnamese diacritics)
    text = remove_special_chars(text)

    # 6. Normalize whitespace
    text = normalize_whitespace(text)

    return text
```

#### 8.2 Khác biệt so với Enhanced Keyword Normalization

| Bước | Enhanced Keyword | ML Preprocessing |
|------|------------------|------------------|
| Mục đích | Match chính xác keywords | Tạo features cho TF-IDF |
| Xử lý dấu | Giữ nguyên (match cả có/không dấu) | Giữ nguyên (train cả 2 dạng) |
| Tokenization | Không cần | Tự động bởi TF-IDF |
| Output | Text chuẩn hóa | Vector số (TF-IDF) |

---

## PHẦN III: HYBRID APPROACH

### 9. Ensemble Methods (Kết hợp Rule-based và ML)

#### 9.1 Khái niệm

Ensemble là phương pháp kết hợp nhiều mô hình để có dự đoán tốt hơn từng mô hình riêng lẻ. Trong My Finance, chúng ta kết hợp **Enhanced Keyword** (rule-based) với **ML Model** (TF-IDF + SVM).

#### 9.2 Chiến lược Hybrid trong My Finance

```
┌─────────────────────────────────────────────────────────────┐
│                      Input Text                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│    ML Model (SVM)       │     │   Enhanced Keyword          │
│    Predict + Conf       │     │   Predict + Conf            │
└─────────────────────────┘     └─────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Decision Logic                            │
│                                                              │
│  if ML_conf >= 0.6:                                          │
│      return ML_result                                        │
│  elif Keyword_conf >= 0.8:                                   │
│      return Keyword_result                                   │
│  else:                                                       │
│      return weighted_combine(ML, Keyword)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Final Prediction                          │
│    category, confidence, model_used                          │
└─────────────────────────────────────────────────────────────┘
```

#### 9.3 Weighted Voting (Voting có trọng số)

Khi kết hợp ML và Keyword:

$$P_{final}(c) = \alpha \cdot P_{ML}(c) + (1 - \alpha) \cdot P_{Keyword}(c)$$

Với $\alpha$ phụ thuộc vào confidence của ML model:
- ML confidence cao → $\alpha$ cao (tin tưởng ML hơn)
- ML confidence thấp → $\alpha$ thấp (dựa vào Keyword hơn)

#### 9.4 Ưu điểm của Hybrid Approach

| Ưu điểm | Giải thích |
|---------|------------|
| Robust | ML xử lý chính, Keyword backup |
| Interpretable | Keyword giải thích được kết quả |
| Fast deployment | Keyword hoạt động ngay khi ML chưa sẵn sàng |
| Edge cases | Keyword xử lý tốt các trường hợp đặc biệt |
| Continuous improvement | Thu thập data từ user để train ML |

---

## PHẦN IV: EVALUATION

### 10. Evaluation Metrics (Độ đo đánh giá)

#### 10.1 Accuracy

$$Accuracy = \frac{TP + TN}{TP + TN + FP + FN}$$

Trong đó:
- TP: True Positive (dự đoán đúng lớp dương)
- TN: True Negative (dự đoán đúng lớp âm)
- FP: False Positive (dự đoán sai thành dương)
- FN: False Negative (dự đoán sai thành âm)

#### 10.2 Precision và Recall

**Precision:** Trong các dự đoán positive, bao nhiêu đúng?

$$Precision = \frac{TP}{TP + FP}$$

**Recall:** Trong các thực tế positive, bao nhiêu được dự đoán đúng?

$$Recall = \frac{TP}{TP + FN}$$

#### 10.3 F1-Score

Trung bình điều hòa của Precision và Recall:

$$F1 = 2 \cdot \frac{Precision \cdot Recall}{Precision + Recall}$$

#### 10.4 Cross-Validation

Sử dụng k-fold cross-validation để đánh giá model:

```
Dataset: [D1, D2, D3, D4, D5]

Fold 1: Train on [D2,D3,D4,D5], Test on [D1]
Fold 2: Train on [D1,D3,D4,D5], Test on [D2]
Fold 3: Train on [D1,D2,D4,D5], Test on [D3]
Fold 4: Train on [D1,D2,D3,D5], Test on [D4]
Fold 5: Train on [D1,D2,D3,D4], Test on [D5]

Final Score = Average(Fold 1, 2, 3, 4, 5)
```

#### 10.5 Kết quả đánh giá thực tế

| Metric | Giá trị | Giải thích |
|--------|---------|------------|
| Accuracy | 94.1% | Tỷ lệ dự đoán đúng |
| CV Mean | 87.1% | Trung bình cross-validation |
| CV Std | 3.1% | Độ lệch chuẩn (model ổn định) |

### 11. Class Imbalance Problem

#### 11.1 Vấn đề

Dữ liệu không cân bằng giữa các category:

| Category | Số mẫu | Tỷ lệ |
|----------|--------|-------|
| food | 1207 | 21.0% |
| transportation | 522 | 9.1% |
| charity | 80 | 1.4% |

#### 11.2 Giải pháp: Class Weight Balancing

```python
SVM_PARAMS = {
    'class_weight': 'balanced',  # Tự động cân bằng
}
```

Công thức tính weight:

$$w_c = \frac{N}{k \cdot n_c}$$

Trong đó:
- $N$: Tổng số mẫu
- $k$: Số lượng class
- $n_c$: Số mẫu của class $c$

**Ví dụ:**
- food: weight = 5757 / (17 × 1207) = 0.28
- charity: weight = 5757 / (17 × 80) = 4.23

→ Class charity được "chú ý" nhiều hơn khi training.

---

## PHẦN V: THAM KHẢO

### 12. Tham khảo lý thuyết

1. **Joachims, T. (1998)**. Text Categorization with Support Vector Machines: Learning with Many Relevant Features. *ECML*.

2. **Salton, G. & Buckley, C. (1988)**. Term-weighting approaches in automatic text retrieval. *Information Processing & Management*.

3. **Manning, C. D., Raghavan, P., & Schütze, H. (2008)**. Introduction to Information Retrieval. *Cambridge University Press*.

4. **Platt, J. C. (1999)**. Probabilistic outputs for support vector machines. *Advances in Large Margin Classifiers*.

5. **Vu, H. T. et al. (2020)**. Vietnamese Text Classification: A Survey. *Journal of Computer Science and Cybernetics*.

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway (3000)                              │
│                           Kong Gateway (8000)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Transaction Service (3001)                           │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ Transaction     │  │ Group Expense   │  │ ML Client Service           │ │
│  │ Service         │  │ Service         │  │ (calls ML Service)          │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ML Service (3005)                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   CategoryPredictionService                          │   │
│  │                     (Orchestrator chính)                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                    │                    │              │
│         ┌──────────┴──────────┐        │         ┌──────────┴──────────┐   │
│         ▼                     ▼        ▼         ▼                     │   │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │   │
│  │   Enhanced      │   │   ML Model      │   │    Ensemble     │       │   │
│  │   Keyword       │   │  (TF-IDF+SVM)   │   │   (future)      │       │   │
│  │  Classifier     │   │   Classifier    │   │   Classifier    │       │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘       │   │
│         │                     │                                         │   │
│         ▼                     ▼                                         │   │
│  ┌─────────────────┐   ┌─────────────────┐                             │   │
│  │  - N-gram       │   │  Python ML API  │◄────────────────────────────┘   │
│  │  - Weighting    │   │  (FastAPI)      │                                 │
│  │  - Normalize    │   │  Port 5000      │                                 │
│  │  - Neg. keys    │   └─────────────────┘                                 │
│  │  - Amount hints │            │                                          │
│  └─────────────────┘            │                                          │
│                                 │                                          │
│  ┌─────────────────────────────┴──────────────────────────────────────┐   │
│  │                   Training Data Module                              │   │
│  │  - Log corrections (user sửa category)                             │   │
│  │  - Log confirmations (user xác nhận đúng)                          │   │
│  │  - Export data for training                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ML Python Service (5000)                              │
│                                                                              │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐   │
│  │  FastAPI        │   │  TF-IDF         │   │  SVM Classifier         │   │
│  │  REST API       │   │  Vectorizer     │   │  (Linear Kernel)        │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘   │
│         │                     │                         │                   │
│         ▼                     ▼                         ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Vietnamese Text Processor                         │   │
│  │  - Unicode normalization                                             │   │
│  │  - Teencode mapping (cf→cafe, k→không, dc→được)                     │   │
│  │  - Typo corrections (grap→grab, shoppee→shopee)                     │   │
│  │  - Special char removal (keep Vietnamese diacritics)                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Training Data (5757 samples)                    │   │
│  │  - 3275 samples có dấu (tiếng Việt chuẩn)                           │   │
│  │  - 2482 samples không dấu (auto-generated)                           │   │
│  │  - 17 categories                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Các thành phần chính

### 1. Enhanced Keyword Classifier (NestJS)

Rule-based classifier với nhiều tính năng nâng cao:

#### 1.1 N-gram Matching
Ưu tiên match cụm từ thay vì từ đơn để tránh nhầm lẫn:

| Input | N-gram Match | Category | Tránh nhầm |
|-------|--------------|----------|------------|
| "grab food" | grab food | food | ~~transportation~~ |
| "tiền nhà" | tiền nhà | home | ~~income~~ |
| "ăn mặc" | ăn mặc | shopping | ~~food~~ |
| "quỹ vì trẻ em" | quỹ vì trẻ em | donation | ~~charity~~ |

#### 1.2 Keyword Weighting
Phân bổ trọng số cho keywords:

```typescript
// High weight - specific keywords
{ phrase: 'grabfood', weight: 1.5 }
{ phrase: 'shopeefood', weight: 1.5 }
{ phrase: 'netflix', weight: 1.3 }

// Low weight - generic keywords
{ phrase: 'mua', weight: 0.5 }
{ phrase: 'tiền', weight: 0.4 }
{ phrase: 'đi', weight: 0.3 }
```

#### 1.3 Vietnamese Normalization
Xử lý teencode và typo phổ biến:

```typescript
TEENCODE_MAP = {
  'cf': 'cafe',
  'k': 'không',
  'ko': 'không',
  'dc': 'được',
  'đc': 'được',
  'vs': 'với',
}

TYPO_MAP = {
  'grap': 'grab',
  'shoppee': 'shopee',
  'lazda': 'lazada',
  'ca phe': 'cà phê',
  'tra sua': 'trà sữa',
}
```

#### 1.4 Negative Keywords
Loại trừ category khi gặp từ khóa đặc biệt:

```typescript
NEGATIVE_KEYWORDS = {
  food: ['grab food', 'baemin', 'shopeefood'],  // excludes transportation
  transportation: ['bánh xe', 'đồ ăn'],          // excludes food
}
```

#### 1.5 Amount Hints
Gợi ý category dựa trên số tiền:

| Amount Range | Likely Categories |
|--------------|-------------------|
| < 50k | food, transportation |
| 50k - 200k | food, entertainment, shopping |
| 200k - 1tr | shopping, health, education |
| 1tr - 5tr | home, education, travel |
| > 5tr | home, investment, travel |

### 2. ML Model Classifier (Python)

TF-IDF + SVM classifier được train với dữ liệu tiếng Việt.

#### 2.1 Text Preprocessing Pipeline

```python
def preprocess_text(text):
    # 1. Unicode normalization (NFC)
    text = normalize_unicode(text)

    # 2. Lowercase
    text = text.lower()

    # 3. Apply typo corrections
    text = apply_typo_corrections(text)

    # 4. Apply teencode mapping
    text = apply_teencode_map(text)

    # 5. Remove special characters (keep Vietnamese diacritics)
    text = remove_special_chars(text)

    # 6. Normalize whitespace
    text = normalize_whitespace(text)

    return text
```

#### 2.2 Model Configuration

```python
TFIDF_PARAMS = {
    'max_features': 5000,
    'ngram_range': (1, 3),      # Unigrams, bigrams, trigrams
    'min_df': 2,
    'max_df': 0.95,
    'sublinear_tf': True,
}

SVM_PARAMS = {
    'C': 1.0,
    'kernel': 'linear',
    'probability': True,        # Enable probability estimates
    'class_weight': 'balanced', # Handle imbalanced classes
}
```

#### 2.3 Training Data Statistics

| Metric | Value |
|--------|-------|
| Total samples | 5757 |
| Samples có dấu | 3275 |
| Samples không dấu | 2482 |
| Categories | 17 |
| Accuracy | 94.1% |
| Cross-validation | 87.1% |

### 3. Prediction Flow

```
┌───────────────┐
│  Input Text   │
│ "an pho 50k"  │
└───────┬───────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    CategoryPredictionService                   │
│                                                                │
│  1. Check ML Model availability                                │
│     └── ML available? ─────────────────────────────┐          │
│                                                     │          │
│  2. If ML available:                               ▼          │
│     ┌────────────────────────────────────────────────────┐    │
│     │              ML Classifier                          │    │
│     │  - Call Python API: POST /predict                   │    │
│     │  - Get prediction + confidence                      │    │
│     └────────────────────────────────────────────────────┘    │
│                         │                                      │
│                         ▼                                      │
│     ┌──────────────────────────────────────────────────┐      │
│     │ Confidence >= 60%?                                │      │
│     │   YES → Return ML result                          │      │
│     │   NO  → Combine with Enhanced Keyword             │      │
│     └──────────────────────────────────────────────────┘      │
│                                                                │
│  3. If ML unavailable or low confidence:                       │
│     ┌────────────────────────────────────────────────────┐    │
│     │           Enhanced Keyword Classifier               │    │
│     │  - N-gram matching                                  │    │
│     │  - Keyword weighting                                │    │
│     │  - Vietnamese normalization                         │    │
│     │  - Negative keywords                                │    │
│     │  - Amount hints                                     │    │
│     └────────────────────────────────────────────────────┘    │
│                                                                │
│  4. Return final prediction                                    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Response:                                                      │
│ {                                                              │
│   "category": "food",                                          │
│   "confidence": 0.998,                                         │
│   "suggestions": [                                             │
│     { "category": "food", "confidence": 0.998 },              │
│     { "category": "family", "confidence": 0.0003 }            │
│   ],                                                           │
│   "model": "ml-svm-v1"                                        │
│ }                                                              │
└───────────────────────────────────────────────────────────────┘
```

### 4. Categories (17 loại)

| Category | Mô tả | Ví dụ keywords |
|----------|-------|----------------|
| `income` | Thu nhập | lương, thưởng, hoàn tiền, cổ tức |
| `food` | Ăn uống | phở, cafe, grabfood, bún, cơm |
| `transportation` | Di chuyển | grab, taxi, xăng, gửi xe, vé xe |
| `entertainment` | Giải trí | phim, game, netflix, karaoke |
| `shopping` | Mua sắm | quần áo, shopee, lazada, giày |
| `health` | Sức khỏe | bệnh viện, thuốc, gym, khám |
| `education` | Giáo dục | học phí, sách, khóa học, ielts |
| `utilities` | Hóa đơn | tiền điện, nước, internet, gas |
| `home` | Nhà ở | tiền nhà, thuê nhà, sửa nhà |
| `personal` | Cá nhân | cắt tóc, spa, mỹ phẩm, nước hoa |
| `travel` | Du lịch | khách sạn, vé máy bay, tour |
| `investment` | Đầu tư | cổ phiếu, bitcoin, tiết kiệm |
| `family` | Gia đình | bỉm, sữa, tiền cho mẹ |
| `houseware` | Đồ gia dụng | tủ lạnh, máy giặt, nồi cơm |
| `donation` | Quyên góp | ủng hộ, quỹ từ thiện, cứu trợ |
| `charity` | Từ thiện | từ thiện, thiện nguyện |
| `other` | Khác | - |

### 5. Training Data Collection

Module thu thập dữ liệu từ user để cải thiện model:

#### 5.1 Log Corrections
Khi user sửa category prediction sai:

```bash
POST /training-data/log-correction
{
  "text": "cf với bạn 50k",
  "amount": 50000,
  "predictedCategory": "other",
  "predictedConfidence": 0.3,
  "correctedCategory": "food"
}
```

#### 5.2 Log Confirmations
Khi user xác nhận prediction đúng:

```bash
POST /training-data/log-confirmed
{
  "text": "đi grab 30k",
  "amount": 30000,
  "confirmedCategory": "transportation",
  "predictedConfidence": 0.92
}
```

#### 5.3 Export Data
Xuất dữ liệu để train model:

```bash
GET /training-data/export?minRecordsPerCategory=10
```

## API Endpoints

### ML Service (Port 3005)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/predict-category` | Dự đoán category cho 1 transaction |
| POST | `/batch-predict-category` | Dự đoán batch nhiều transactions |
| POST | `/analyze-transaction` | Extract amount + predict category |
| POST | `/analyze-multi-transactions` | Phân tích text chứa nhiều transactions |
| POST | `/training-data/log-correction` | Log user correction |
| POST | `/training-data/log-confirmed` | Log user confirmation |
| GET | `/training-data/stats` | Thống kê training data |
| GET | `/training-data/export` | Export training data |

### Python ML API (Port 5000)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/health` | Health check |
| POST | `/predict` | Predict single text |
| POST | `/batch-predict` | Predict batch texts |
| POST | `/train` | Train/retrain model |
| GET | `/model-info` | Get model information |
| POST | `/reload` | Reload model from disk |

## Docker Deployment

### Services trong docker-compose.yml

```yaml
# ML Python Service (TF-IDF + SVM)
ml-python:
  build:
    context: ./apps/ml-service/python-ml
    dockerfile: Dockerfile
  ports:
    - "5001:5000"
  volumes:
    - ml_models:/app/models
  healthcheck:
    test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')"]

# ML Service (NestJS)
ml-service:
  environment:
    - USE_ML_MODEL=true
    - ML_API_URL=http://ml-python:5000
  depends_on:
    ml-python:
      condition: service_healthy
```

### Commands

```bash
# Build và start tất cả services
docker compose up -d --build

# Chỉ rebuild ML services
docker compose up -d --build ml-python ml-service

# View logs
docker logs -f my-finance-ml-python
docker logs -f my-finance-ml

# Retrain model
curl -X POST "http://localhost:5001/train" -H "Content-Type: application/json" -d '{"force": true}'
```

## Performance Metrics

### Accuracy by Text Type

| Text Type | Accuracy | Example |
|-----------|----------|---------|
| Có dấu (Vietnamese) | 95-99% | "ăn phở buổi sáng" |
| Không dấu | 94-98% | "an pho buoi sang" |
| Mixed | 92-96% | "an pho 50k" |
| Teencode | 85-92% | "cf vs bn 25k" |

### Response Time

| Component | Latency |
|-----------|---------|
| Enhanced Keyword only | < 5ms |
| ML Model only | 10-50ms |
| ML + Keyword (combined) | 15-60ms |

### Model Size

| File | Size |
|------|------|
| tfidf_vectorizer.joblib | ~2MB |
| svm_classifier.joblib | ~500KB |
| label_encoder.joblib | ~1KB |

## File Structure

```
apps/ml-service/
├── src/
│   ├── categories/
│   │   ├── category.constants.ts              # 17 categories definition
│   │   ├── enhanced-keywords.constants.ts     # N-gram, weights, negative keys
│   │   ├── category-prediction.service.ts     # Main orchestrator
│   │   ├── classifiers/
│   │   │   ├── keyword-classifier.service.ts         # Basic keyword
│   │   │   ├── enhanced-keyword-classifier.service.ts # Enhanced features
│   │   │   ├── ml-classifier.service.ts              # ML model client
│   │   │   └── ensemble-classifier.service.ts        # Future: PhoBERT
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
│   ├── ml_model.py                            # TF-IDF + SVM classifier
│   ├── text_processor.py                      # Vietnamese preprocessing
│   ├── config.py                              # Configuration
│   ├── requirements.txt                       # Python dependencies
│   ├── Dockerfile
│   └── data/
│       └── training_data.json                 # 5757 training samples
└── README.md
```

## Testing

### Test với curl

```bash
# Test ML Model trực tiếp
curl -X POST "http://localhost:5001/predict" \
  -H "Content-Type: application/json" \
  -d '{"text": "an pho sang"}'

# Test qua NestJS ML Service
curl -X POST "http://localhost:3005/analyze-multi-transactions" \
  -H "Content-Type: application/json" \
  -d '{"text": "grab di cong ty 30k, tien dien thang 12 la 500k"}'
```

### Expected Results

| Input | Expected Category | Confidence |
|-------|-------------------|------------|
| "an pho sang" | food | 99.8% |
| "grab di cong ty" | transportation | 97.1% |
| "tien dien thang 12" | utilities | 98.3% |
| "luong thang 12" | income | 96.0% |
| "TANG 50K CHO QUY VI TRE EM" | donation | 98.5% |
| "mua iphone 15" | shopping | 95%+ |

## Roadmap

### Completed (Phase 1)

- [x] Enhanced Keyword Classifier
  - [x] N-gram matching
  - [x] Keyword weighting
  - [x] Vietnamese normalization (teencode, typo)
  - [x] Negative keywords
  - [x] Amount hints

- [x] ML Model (TF-IDF + SVM)
  - [x] Python FastAPI service
  - [x] Vietnamese text preprocessing
  - [x] 5757 training samples (có dấu + không dấu)
  - [x] Auto-train on startup
  - [x] NestJS integration

- [x] Training Data Collection
  - [x] Log corrections
  - [x] Log confirmations
  - [x] Export for training

- [x] Docker Integration
  - [x] ml-python service
  - [x] ml-service depends on ml-python
  - [x] Health checks
  - [x] Persistent model storage (volume)

### Future (Phase 2+)

- [ ] PhoBERT Integration (Ensemble)
- [ ] User Personalization (per-user learning)
- [ ] Active Learning (smart sample selection)
- [ ] Model versioning và A/B testing
- [ ] Real-time model updates

---

**Version**: 1.0.0
**Last Updated**: 2024-12-27
**Author**: My Finance Team

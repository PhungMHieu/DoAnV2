# Group Expense Category Implementation

## Tổng Quan

Đã implement tính năng **lưu và sử dụng category gốc** của group expense khi tạo transactions. Thay vì hard-code category thành "Group Settlement" hoặc "Group Expense", hệ thống giờ sẽ dùng category mà frontend gửi lên.

## Vấn Đề Ban Đầu

**Trước khi fix:**
```typescript
// Khi Bob tạo expense 300k cho "food"
POST /groups/{groupId}/expenses
{
  "title": "food",
  "amount": 300,
  "category": "food"  // ❌ Bị bỏ qua
}

// Bob's transaction được tạo với category hard-coded
{
  amount: -300,
  category: "Group Expense",  // ❌ Không phải "food"
  note: "Paid for group: food"
}

// Khi Alice mark paid
{
  amount: -100,
  category: "Group Settlement",  // ❌ Không phải "food"
  note: "Paid for: food"
}
```

**Hậu quả:**
- Mất thông tin category thực tế
- Report breakdown không chính xác (hiển thị "Group Settlement" thay vì "food")
- Không thể phân tích chi tiêu theo category đúng

## Giải Pháp Implemented

### 1. Thêm Column `category` vào Database

**Migration SQL:**
```sql
ALTER TABLE group_expenses
ADD COLUMN IF NOT EXISTS category VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_group_expenses_category ON group_expenses(category);

COMMENT ON COLUMN group_expenses.category IS 'Category of the expense (e.g., food, transport, entertainment)';
```

### 2. Cập Nhật Entity

**File:** [apps/transaction-service/src/group-expense/entities/group-expense.entity.ts](apps/transaction-service/src/group-expense/entities/group-expense.entity.ts#L26-L27)

```typescript
@Column({ nullable: true })
category: string; // Category of the expense (e.g., "food", "transport")
```

### 3. Cập Nhật DTO

**File:** [apps/transaction-service/src/group-expense/dto/create-expense.dto.ts](apps/transaction-service/src/group-expense/dto/create-expense.dto.ts#L72-L77)

```typescript
@ApiPropertyOptional({
  description: 'Category of the expense (e.g., food, transport, entertainment)',
  example: 'food',
})
@IsString()
category?: string;
```

### 4. Cập Nhật Service Logic

**File:** [apps/transaction-service/src/group-expense/group-expense.service.ts](apps/transaction-service/src/group-expense/group-expense.service.ts)

#### Khi tạo expense (line 423):
```typescript
// Transaction cho payer sử dụng category từ frontend
await this.transactionServiceService.createTransaction(
  payerUserId,
  {
    amount: parseFloat(this.fromCents(totalCents)),
    category: category || 'Group Expense', // ✅ Dùng category gốc
    note: `Paid for group: ${title}`,
    dateTime: new Date(),
  } as any,
);
```

#### Khi mark paid (line 285):
```typescript
// Transaction cho debtor sử dụng category gốc của expense
const debtorTx = await this.transactionServiceService.createTransaction(
  debtorUserId,
  {
    amount: parseFloat(share.amount),
    category: expense.category || 'Group Settlement', // ✅ Dùng category gốc
    note: `Paid for: ${expense.title}`,
    dateTime: new Date(),
  } as any,
);
```

### 5. Cập Nhật Controller

**File:** [apps/transaction-service/src/group-expense/group-expense.controller.ts](apps/transaction-service/src/group-expense/group-expense.controller.ts)

Truyền `category` từ DTO vào service cho tất cả 3 loại split:
- Equal split (line 60)
- Exact split (line 83)
- Percent split (line 108)

## Flow Hoàn Chỉnh

### Scenario 1: Tạo Group Expense với Category

```typescript
// Frontend gửi request
POST /groups/{groupId}/expenses
{
  "title": "Dinner at restaurant",
  "amount": 300,
  "paidByMemberId": "44",  // Bob
  "category": "food",       // ✅ Category từ frontend
  "splitType": "equal",
  "participantMemberIds": ["44", "45", "46"]
}

// 1️⃣ Expense được lưu vào database
{
  id: "exp-123",
  title: "Dinner at restaurant",
  amount: 300,
  category: "food",  // ✅ Lưu vào DB
  paidByMemberId: "44"
}

// 2️⃣ Transaction được tạo cho Bob (payer)
{
  userId: "bob-user-id",
  amount: -300,
  category: "food",  // ✅ Dùng category gốc
  note: "Paid for group: Dinner at restaurant",
  dateTime: "2025-12-24T..."
}
```

### Scenario 2: Mark Paid với Category Gốc

```typescript
// Alice mark debt as paid
POST /groups/{groupId}/expenses/mark-paid
{
  "shareId": "share-456"
}

// 1️⃣ Hệ thống tìm expense gốc và lấy category
expense = {
  id: "exp-123",
  title: "Dinner at restaurant",
  amount: 300,
  category: "food",  // ✅ Category gốc
}

// 2️⃣ Transaction cho Alice (debtor)
{
  userId: "alice-user-id",
  amount: -100,
  category: "food",  // ✅ Dùng category gốc từ expense
  note: "Paid for: Dinner at restaurant"
}

// 3️⃣ Transaction cho Bob (income)
{
  userId: "bob-user-id",
  amount: +100,
  category: "Income",  // Income vẫn giữ nguyên
  note: "Received payment for: Dinner at restaurant"
}
```

## Ưu Điểm

### 1. Tracking Chính Xác
```json
// Report monthly summary
{
  "month": "12/2025",
  "data": {
    "food": 400,      // ✅ Bao gồm cả chi tiêu nhóm
    "transport": 150,
    "income": 200
  }
}
```

### 2. Consistency Across Services
- Frontend gửi category → Backend lưu category
- Tạo expense → Dùng category gốc
- Mark paid → Dùng category gốc
- Report → Hiển thị category đúng

### 3. Fallback an toàn
```typescript
category: expense.category || 'Group Settlement'
```
- Nếu expense có category → Dùng category đó
- Nếu không có (old data) → Fallback to 'Group Settlement'

## Testing

### Test 1: Tạo expense với category

```bash
curl -X POST http://localhost:3001/groups/{groupId}/expenses \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Lunch",
    "amount": 300,
    "paidByMemberId": "44",
    "category": "food",
    "splitType": "equal",
    "participantMemberIds": ["44", "45", "46"]
  }'
```

**Expected:**
- ✅ Expense được tạo với `category: "food"`
- ✅ Transaction của payer có `category: "food"`

### Test 2: Mark paid preserves category

```bash
# Sau khi tạo expense ở Test 1
curl -X POST http://localhost:3001/groups/{groupId}/expenses/mark-paid \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "shareId": "{shareId}"
  }'
```

**Expected:**
- ✅ Debtor transaction có `category: "food"` (từ expense gốc)
- ✅ Payer income transaction có `category: "Income"`

### Test 3: Backward compatibility

```sql
-- Old expenses without category
SELECT * FROM group_expenses WHERE category IS NULL;
```

**Expected:**
- ✅ Mark paid vẫn hoạt động
- ✅ Fallback to `'Group Settlement'`

## Database Changes

### Before
```sql
my-finance=# \d group_expenses
 Column           | Type                     | Nullable
------------------+--------------------------+----------
 id               | uuid                     | not null
 groupId          | character varying        | not null
 title            | character varying        | not null
 amount           | numeric(18,2)            | not null
 paidByMemberId   | character varying        | not null
 createdByUserId  | character varying        | not null
 createdAt        | timestamp with time zone | not null
 splitType        | character varying        | not null
```

### After
```sql
my-finance=# \d group_expenses
 Column           | Type                     | Nullable
------------------+--------------------------+----------
 id               | uuid                     | not null
 groupId          | character varying        | not null
 title            | character varying        | not null
 amount           | numeric(18,2)            | not null
 category         | character varying(255)   | ✅ NEW
 paidByMemberId   | character varying        | not null
 createdByUserId  | character varying        | not null
 createdAt        | timestamp with time zone | not null
 splitType        | character varying        | not null

Indexes:
  "idx_group_expenses_category" btree (category) ✅ NEW
```

## Files Modified

1. ✅ [apps/transaction-service/src/group-expense/entities/group-expense.entity.ts](apps/transaction-service/src/group-expense/entities/group-expense.entity.ts) - Added `category` field
2. ✅ [apps/transaction-service/src/group-expense/dto/create-expense.dto.ts](apps/transaction-service/src/group-expense/dto/create-expense.dto.ts) - Added `category` to DTO
3. ✅ [apps/transaction-service/src/group-expense/group-expense.service.ts](apps/transaction-service/src/group-expense/group-expense.service.ts) - Use category in transactions
4. ✅ [apps/transaction-service/src/group-expense/group-expense.controller.ts](apps/transaction-service/src/group-expense/group-expense.controller.ts) - Pass category to service

## Summary

**Achieved:**
- ✅ Frontend có thể gửi category cho group expense
- ✅ Category được lưu vào database
- ✅ Transaction của payer dùng category gốc
- ✅ Transaction của debtor (khi mark paid) dùng category gốc
- ✅ Report breakdown hiển thị category chính xác
- ✅ Backward compatible với old data (fallback to 'Group Settlement')
- ✅ Migration database thành công
- ✅ All services rebuilt và running

**Behavior:**
- **Khi tạo expense:** Frontend gửi category → Lưu vào DB → Transaction dùng category đó
- **Khi mark paid:** Lấy category từ expense gốc → Transaction dùng category đó
- **Fallback:** Nếu không có category → Dùng 'Group Settlement' (backward compatible)

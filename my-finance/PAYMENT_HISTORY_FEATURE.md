# Payment History Feature

## Tổng Quan

Tính năng **lịch sử trả/nhận tiền** cho phép người dùng xem tất cả các khoản thanh toán (paid) và nhận tiền (received) trong một nhóm theo tháng.

## Endpoint

```
GET /groups/:groupId/expenses/payment-history?monthYear=12/2025
```

**Authentication:** Required (JWT token)

## Request

### Parameters:
- `groupId` (path): ID của nhóm
- `monthYear` (query): Tháng/năm theo format `MM/YYYY` (VD: `12/2025`)

### Headers:
```
Authorization: Bearer <jwt_token>
```

## Response

```json
{
  "month": "12/2025",
  "payments": [
    {
      "date": "2025-12-24T10:30:00.000Z",
      "type": "paid",
      "amount": 300,
      "expenseId": "exp-123",
      "expenseTitle": "Dinner",
      "category": "food",
      "note": "Đã thanh toán cho nhóm"
    },
    {
      "date": "2025-12-24T15:00:00.000Z",
      "type": "received",
      "amount": 200,
      "expenseId": "exp-456",
      "expenseTitle": "Lunch",
      "category": "food",
      "from": "Nam",
      "fromMemberId": "45",
      "note": "Nhận từ Nam"
    }
  ],
  "summary": {
    "totalPaid": 300,
    "totalReceived": 200,
    "net": -100
  }
}
```

## Response Fields

### Payment Object:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `date` | ISO Date | Thời gian thanh toán/nhận | `2025-12-24T10:30:00.000Z` |
| `type` | String | Loại: `"paid"` hoặc `"received"` | `"paid"` |
| `amount` | Number | Số tiền | `300` |
| `expenseId` | String | ID của expense | `"exp-123"` |
| `expenseTitle` | String | Tên expense | `"Dinner"` |
| `category` | String | Danh mục | `"food"` |
| `note` | String | Ghi chú | `"Đã thanh toán cho nhóm"` |
| `from` | String | Tên người trả (chỉ có khi `type="received"`) | `"Nam"` |
| `fromMemberId` | String | ID của member trả (chỉ có khi `type="received"`) | `"45"` |

### Summary Object:

| Field | Type | Description |
|-------|------|-------------|
| `totalPaid` | Number | Tổng số tiền đã thanh toán trong tháng |
| `totalReceived` | Number | Tổng số tiền đã nhận trong tháng |
| `net` | Number | Số tiền ròng (received - paid). Âm = trả nhiều hơn, Dương = nhận nhiều hơn |

## Logic

### Type "paid" (Đã thanh toán):

Hiển thị khi user là **payer** (người trả tiền) của expense:

```typescript
// Bob tạo expense 300k cho "Dinner"
// → Bob là payer
// → Payment history của Bob:
{
  type: "paid",
  amount: 300,
  expenseTitle: "Dinner",
  note: "Đã thanh toán cho nhóm"
}
```

### Type "received" (Nhận tiền):

Hiển thị khi user là **payer** và có người khác **mark paid** share của họ:

```typescript
// Bob tạo expense 300k, split 3 người (Bob, Alice, Eny)
// Alice mark paid 100k
// → Payment history của Bob:
{
  type: "received",
  amount: 100,
  expenseTitle: "Dinner",
  from: "Alice",
  note: "Nhận từ Alice"
}
```

## Use Cases

### Use Case 1: Xem Lịch Sử Tháng 12/2025

**Scenario:**
- Bob tạo expense "Dinner" 300k ngày 24/12
- Alice mark paid 100k cho Bob ngày 24/12
- Eny chưa trả

**Request:**
```bash
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
Authorization: Bearer <bob_token>
```

**Response:**
```json
{
  "month": "12/2025",
  "payments": [
    {
      "date": "2025-12-24T15:00:00.000Z",
      "type": "received",
      "amount": 100,
      "expenseTitle": "Dinner",
      "category": "food",
      "from": "Alice",
      "note": "Nhận từ Alice"
    },
    {
      "date": "2025-12-24T10:00:00.000Z",
      "type": "paid",
      "amount": 300,
      "expenseTitle": "Dinner",
      "category": "food",
      "note": "Đã thanh toán cho nhóm"
    }
  ],
  "summary": {
    "totalPaid": 300,
    "totalReceived": 100,
    "net": -200
  }
}
```

**Giải thích:**
- Bob trả 300k cho group → `type: "paid"`
- Bob nhận 100k từ Alice → `type: "received"`
- Net = 100 - 300 = -200 (Bob còn thiếu 200k chưa thu về)

### Use Case 2: Xem Lịch Sử Của Alice

**Request:**
```bash
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
Authorization: Bearer <alice_token>
```

**Response:**
```json
{
  "month": "12/2025",
  "payments": [],
  "summary": {
    "totalPaid": 0,
    "totalReceived": 0,
    "net": 0
  }
}
```

**Giải thích:**
- Alice chưa tạo expense nào → Không có `type: "paid"`
- Alice đã trả cho Bob, nhưng payment history chỉ hiển thị khi **user là payer**
- Nếu muốn xem debts của Alice → Dùng endpoint `/my-debts`

## Implementation Details

### Service Method

**File:** [apps/transaction-service/src/group-expense/group-expense.service.ts](apps/transaction-service/src/group-expense/group-expense.service.ts#L358-L454)

```typescript
async getPaymentHistory(groupId: string, memberId: string, monthYear: string) {
  // 1. Parse monthYear
  const [monthStr, yearStr] = monthYear.split('/');
  const month = parseInt(monthStr);
  const year = parseInt(yearStr);

  // 2. Get date range
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // 3. Find all expenses in this group for this month
  const expenses = await this.expenseRepo.find({
    where: {
      groupId,
      createdAt: Between(startDate, endDate),
    },
    relations: ['shares'],
    order: { createdAt: 'DESC' },
  });

  // 4. Build payment list
  const payments: any[] = [];
  let totalPaid = 0;
  let totalReceived = 0;

  for (const expense of expenses) {
    // A. If current user is PAYER → Add "paid" entry
    if (expense.paidByMemberId === memberId) {
      payments.push({
        type: 'paid',
        amount: parseFloat(expense.amount),
        expenseTitle: expense.title,
        category: expense.category || 'Group Expense',
        note: 'Đã thanh toán cho nhóm',
      });
      totalPaid += parseFloat(expense.amount);
    }

    // B. If current user is PAYER and share is PAID → Add "received" entry
    if (expense.paidByMemberId === memberId) {
      const paidShares = expense.shares.filter(
        (s) => s.memberId !== memberId && s.isPaid
      );

      for (const share of paidShares) {
        const memberName = await getMemberName(share.memberId);

        payments.push({
          type: 'received',
          amount: parseFloat(share.amount),
          expenseTitle: expense.title,
          category: expense.category,
          from: memberName,
          fromMemberId: share.memberId,
          note: `Nhận từ ${memberName}`,
        });
        totalReceived += parseFloat(share.amount);
      }
    }
  }

  // 5. Sort by date descending
  payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    month: monthYear,
    payments,
    summary: {
      totalPaid,
      totalReceived,
      net: totalReceived - totalPaid,
    },
  };
}
```

### Controller Endpoint

**File:** [apps/transaction-service/src/group-expense/group-expense.controller.ts](apps/transaction-service/src/group-expense/group-expense.controller.ts#L158-L220)

```typescript
@Get('payment-history')
@ApiOperation({
  summary: 'Get payment history (paid/received) for current user in a month',
})
@ApiQuery({
  name: 'monthYear',
  required: true,
  description: 'Month and year in format MM/YYYY',
  example: '12/2025'
})
async getPaymentHistory(
  @Param('groupId') groupId: string,
  @Query('monthYear') monthYear: string,
  @Req() req: Request
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) throw new BadRequestException('Missing or invalid JWT token');

  if (!monthYear) {
    throw new BadRequestException('monthYear query parameter is required');
  }

  // Get member ID from group-service
  const authHeader = req.headers.authorization || '';
  const memberId = await this.groupClientService.getMyMemberId(groupId, authHeader);

  return this.groupExpenseService.getPaymentHistory(groupId, String(memberId), monthYear);
}
```

## Related Endpoints

### 1. My Debts (Khoản nợ của tôi)

```
GET /groups/:groupId/expenses/my-debts
```

**Khác biệt:**
- `/my-debts`: Hiển thị các expense mà **tôi nợ người khác** (chưa trả)
- `/payment-history`: Hiển thị các expense mà **tôi đã trả** và **tôi đã nhận**

### 2. Owed To Me (Người khác nợ tôi)

```
GET /groups/:groupId/expenses/owed-to-me
```

**Khác biệt:**
- `/owed-to-me`: Hiển thị các expense mà **người khác nợ tôi** (chưa trả)
- `/payment-history`: Hiển thị các expense mà **người khác đã trả cho tôi** (đã trả)

## Testing

### Test 1: Payment History với Multiple Payments

```bash
# 1. Bob tạo expense 300k "Dinner" (24/12)
POST /groups/group-123/expenses
{
  "title": "Dinner",
  "amount": 300,
  "paidByMemberId": "44",
  "category": "food",
  "splitType": "equal",
  "participantMemberIds": ["44", "45", "46"]
}

# 2. Alice mark paid
POST /groups/group-123/expenses/mark-paid
{ "shareId": "share-456" }

# 3. Check Bob's payment history
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
Authorization: Bearer <bob_token>

# Expected:
{
  "payments": [
    {
      "type": "received",
      "amount": 100,
      "from": "Alice",
      "expenseTitle": "Dinner"
    },
    {
      "type": "paid",
      "amount": 300,
      "expenseTitle": "Dinner"
    }
  ],
  "summary": {
    "totalPaid": 300,
    "totalReceived": 100,
    "net": -200
  }
}
```

### Test 2: Empty Payment History

```bash
# Alice chưa tạo expense nào
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
Authorization: Bearer <alice_token>

# Expected:
{
  "month": "12/2025",
  "payments": [],
  "summary": {
    "totalPaid": 0,
    "totalReceived": 0,
    "net": 0
  }
}
```

### Test 3: Multiple Months

```bash
# Tạo expense tháng 11
POST /groups/group-123/expenses (11/2025)

# Tạo expense tháng 12
POST /groups/group-123/expenses (12/2025)

# Check tháng 11
GET /groups/group-123/expenses/payment-history?monthYear=11/2025
# → Chỉ hiển thị expenses tháng 11

# Check tháng 12
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
# → Chỉ hiển thị expenses tháng 12
```

## Error Handling

### 1. Missing monthYear Parameter

```bash
GET /groups/group-123/expenses/payment-history
# → 400 Bad Request: "monthYear query parameter is required (format: MM/YYYY)"
```

### 2. Invalid monthYear Format

```bash
GET /groups/group-123/expenses/payment-history?monthYear=13/2025
# → 400 Bad Request: "monthYear must be in format MM/YYYY"

GET /groups/group-123/expenses/payment-history?monthYear=2025-12
# → 400 Bad Request: "monthYear must be in format MM/YYYY"
```

### 3. Missing JWT Token

```bash
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
# (No Authorization header)
# → 400 Bad Request: "Missing or invalid JWT token"
```

### 4. User Not Member of Group

```bash
GET /groups/group-123/expenses/payment-history?monthYear=12/2025
Authorization: Bearer <non_member_token>
# → 404 Not Found: "User is not a member of this group"
```

## Files Modified/Created

### Modified Files:
1. ✅ [apps/transaction-service/src/group-expense/group-expense.service.ts](apps/transaction-service/src/group-expense/group-expense.service.ts) - Added `getPaymentHistory()` method
2. ✅ [apps/transaction-service/src/group-expense/group-expense.controller.ts](apps/transaction-service/src/group-expense/group-expense.controller.ts) - Added `/payment-history` endpoint
3. ✅ [apps/transaction-service/src/group-expense/group-client.service.ts](apps/transaction-service/src/group-expense/group-client.service.ts) - Added `getMemberById()` method
4. ✅ [apps/group-service/src/group-service.controller.ts](apps/group-service/src/group-service.controller.ts) - Added `GET /:groupId/members/:memberId` endpoint
5. ✅ [apps/group-service/src/group-service.service.ts](apps/group-service/src/group-service.service.ts) - Added `getMemberByIdWithGroup()` method

## Summary

**Feature:** Lịch sử trả/nhận tiền theo tháng

**Benefits:**
- ✅ Xem được tất cả khoản đã trả trong tháng
- ✅ Xem được tất cả khoản đã nhận trong tháng
- ✅ Tổng hợp tài chính: totalPaid, totalReceived, net
- ✅ Filter theo tháng/năm
- ✅ Sắp xếp theo thời gian (mới nhất trước)

**Use Cases:**
- Kiểm tra xem đã trả/nhận bao nhiêu tiền trong tháng
- Đối chiếu với ngân hàng/ví điện tử
- Báo cáo tài chính cá nhân

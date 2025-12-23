# Group Expense - Transaction Service Documentation

## Tổng quan

Module `group-expense` trong `transaction-service` quản lý chi tiêu nhóm (giống Splitwise). Cho phép chia tiền theo nhiều cách và tính toán số dư ai nợ ai.

## Sơ đồ lớp Entity

```
┌─────────────────────────────────────────────────────────────┐
│                       GroupExpense                          │
│                   (group_expenses table)                    │
├─────────────────────────────────────────────────────────────┤
│  PK   id: string (UUID)                                     │
│       groupId: string (indexed) ───────────────────────┐    │
│       title: string                                    │    │
│       amount: numeric(18,2)                            │    │
│       paidByMemberId: string ─────────────────────┐    │    │
│       createdByUserId: string                     │    │    │
│       createdAt: timestamptz                      │    │    │
│       splitType: 'equal' | 'exact' | 'percent'    │    │    │
├─────────────────────────────────────────────────────────────┤
│  1──┐                                             │    │    │
│     │  OneToMany: shares                          │    │    │
└─────│─────────────────────────────────────────────│────│────┘
      │                                             │    │
      │ N                                           │    │
┌─────▼─────────────────────────────────────────────│────│────┐
│                   GroupExpenseShare               │    │    │
│              (group_expense_shares table)         │    │    │
├───────────────────────────────────────────────────│────│────┤
│  PK   id: string (UUID)                           │    │    │
│  FK   expense: GroupExpense                       │    │    │
│       expenseId: string (indexed)                 │    │    │
│       memberId: string (indexed) ─────────────────┼────┘    │
│       amount: numeric(18,2)                       │         │
└───────────────────────────────────────────────────│─────────┘
                                                    │
                                                    │ references
                                                    ▼
                                   ┌────────────────────────────┐
                                   │  GroupMember (group-service)│
                                   │  (external reference)       │
                                   └────────────────────────────┘
                                                    │
                                                    │ groupId references
                                                    ▼
                                   ┌────────────────────────────┐
                                   │   Group (group-service)     │
                                   │  (external reference)       │
                                   └────────────────────────────┘
```

## Chi tiết các Entity

### GroupExpense

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `groupId` | string | ID nhóm (FK logical đến Group) |
| `title` | string | Tên chi phí (VD: "Dinner", "Taxi") |
| `amount` | numeric(18,2) | Tổng số tiền |
| `paidByMemberId` | string | Member đã trả tiền |
| `createdByUserId` | string | User tạo expense |
| `createdAt` | timestamptz | Thời gian tạo |
| `splitType` | enum | Cách chia: `equal`, `exact`, `percent` |

### GroupExpenseShare

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `expense` | GroupExpense | FK đến expense (CASCADE delete) |
| `expenseId` | string | ID của expense |
| `memberId` | string | Member phải chịu phần này |
| `amount` | numeric(18,2) | Số tiền member phải trả |

## Service Classes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GroupExpenseService                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  + createExpenseEqualSplit(params)   → Chia đều cho các members             │
│  + createExpenseExactSplit(...)      → Chia theo số tiền cụ thể             │
│  + createExpensePercentSplit(...)    → Chia theo phần trăm                  │
│  + getExpensesOfGroup(groupId)       → Lấy danh sách expense của nhóm       │
│  + getExpenseDetail(groupId, id)     → Lấy chi tiết 1 expense               │
├─────────────────────────────────────────────────────────────────────────────┤
│  - persistExpenseWithShares(...)     → Lưu expense + shares (transaction)   │
│  - toCents(value)                    → Convert to cents (tránh float error) │
│  - fromCents(cents)                  → Convert cents back to string         │
│  - requireString/Number(...)         → Validation helpers                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         GroupBalanceService                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  + getNetPerMember(groupId)          → Tính net cho từng member             │
│  + simplify(netList)                 → Rút gọn nợ (giống Splitwise)         │
│  + getSimplifiedBalances(groupId)    → API: net + simplified                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Split Types (Cách chia tiền)

### 1. Equal Split (Chia đều)

```
Input:
  amount: 100,000đ
  participantMemberIds: ["A", "B", "C"]

Output shares:
  A: 33,334đ  ← extra 1đ từ remainder
  B: 33,333đ
  C: 33,333đ

Thuật toán: Chia đều theo cents, phân bổ remainder cho member đầu
```

### 2. Exact Split (Chia theo số tiền cụ thể)

```
Input:
  amount: 100,000đ
  splits: [
    { memberId: "A", amount: 50,000 },
    { memberId: "B", amount: 30,000 },
    { memberId: "C", amount: 20,000 }
  ]

Validation: Sum of splits MUST equal total amount
```

### 3. Percent Split (Chia theo phần trăm)

```
Input:
  amount: 100,000đ
  splits: [
    { memberId: "A", percent: 50 },
    { memberId: "B", percent: 30 },
    { memberId: "C", percent: 20 }
  ]

Validation: Sum of percents MUST equal 100%
Algorithm: Largest Remainder Method (để tổng chính xác)
```

## Balance Calculation (Tính số dư)

### Net Calculation

```typescript
interface NetRecord {
  memberId: string;
  net: number;  // > 0: được nhận tiền, < 0: đang nợ
}
```

**Công thức:**
```
Net(member) = Σ(amount paid by member) - Σ(share amounts of member)
```

**Ví dụ:**
```
Expense 1: A paid 100k, split equally (A, B, C)
  A: +100k (paid) - 33.3k (share) = +66.7k
  B: -33.3k
  C: -33.3k

Expense 2: B paid 60k, split equally (A, B)
  A: -30k
  B: +60k - 30k = +30k

Final Net:
  A: +66.7k - 30k = +36.7k (được nhận)
  B: -33.3k + 30k = -3.3k (nợ)
  C: -33.3k (nợ)
```

### Simplify (Rút gọn nợ - Giống Splitwise)

```typescript
interface BalanceRecord {
  fromMemberId: string;  // Người nợ
  toMemberId: string;    // Người được nhận
  amount: number;
}
```

**Thuật toán:**
```
1. Chia members thành creditors (net > 0) và debtors (net < 0)
2. Match debtor với creditor
3. Chuyển min(debt, credit)
4. Tiếp tục cho đến khi hết
```

**Ví dụ:**
```
Net: A: +36.7k, B: -3.3k, C: -33.3k

Simplified:
  B → A: 3.3k
  C → A: 33.3k  (hoặc có thể 33.4k tùy rounding)

Thay vì 6 giao dịch, chỉ cần 2!
```

## API Endpoints

### Group Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups/:groupId/expenses` | Tạo expense mới |
| GET | `/groups/:groupId/expenses` | Lấy danh sách expenses |

### Group Balances

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/:groupId/balances` | Lấy simplified balances |

## Request/Response Examples

### Create Expense (Equal Split)

```json
// POST /groups/abc-123/expenses
{
  "title": "Dinner",
  "amount": 500000,
  "paidByMemberId": "member-1",
  "splitType": "equal",
  "participantMemberIds": ["member-1", "member-2", "member-3"]
}
```

### Create Expense (Exact Split)

```json
// POST /groups/abc-123/expenses
{
  "title": "Shopping",
  "amount": 1000000,
  "paidByMemberId": "member-1",
  "splitType": "exact",
  "splits": [
    { "memberId": "member-1", "amount": 500000 },
    { "memberId": "member-2", "amount": 300000 },
    { "memberId": "member-3", "amount": 200000 }
  ]
}
```

### Create Expense (Percent Split)

```json
// POST /groups/abc-123/expenses
{
  "title": "Trip",
  "amount": 2000000,
  "paidByMemberId": "member-2",
  "splitType": "percent",
  "splits": [
    { "memberId": "member-1", "percent": 40 },
    { "memberId": "member-2", "percent": 35 },
    { "memberId": "member-3", "percent": 25 }
  ]
}
```

### Get Balances Response

```json
// GET /groups/abc-123/balances
{
  "netList": [
    { "memberId": "member-1", "net": 166666.67 },
    { "memberId": "member-2", "net": -83333.33 },
    { "memberId": "member-3", "net": -83333.33 }
  ],
  "simplified": [
    { "fromMemberId": "member-2", "toMemberId": "member-1", "amount": 83333.33 },
    { "fromMemberId": "member-3", "toMemberId": "member-1", "amount": 83333.33 }
  ]
}
```

## Data Flow

```
┌──────────────────┐
│   Client/Frontend│
└────────┬─────────┘
         │ POST /groups/:id/expenses
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                    GroupExpenseController                          │
│  - Validate splitType                                              │
│  - Route to appropriate service method                             │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                    GroupExpenseService                             │
│  - Calculate shares (equal/exact/percent)                          │
│  - Handle cents conversion (avoid float errors)                    │
│  - Persist in transaction                                          │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL                                   │
│  ┌─────────────────┐    ┌─────────────────────┐                    │
│  │  group_expenses │───►│ group_expense_shares│                    │
│  └─────────────────┘    └─────────────────────┘                    │
└────────────────────────────────────────────────────────────────────┘


┌──────────────────┐
│   Client/Frontend│
└────────┬─────────┘
         │ GET /groups/:id/balances
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                   GroupBalanceController                           │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                   GroupBalanceService                              │
│  1. getNetPerMember() - Tính net cho từng member                   │
│  2. simplify() - Rút gọn nợ                                        │
└────────────────────────────────────────────────────────────────────┘
```

## Precision Handling

Để tránh lỗi floating-point:

```typescript
// Convert to cents (integer)
toCents(100.50) → 10050

// Calculate with integers
10050 / 3 = 3350 (base)
10050 - 3350*3 = 0 remainder

// Convert back
fromCents(3350) → "33.50"
```

## Database Schema (SQL)

```sql
CREATE TABLE group_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    paid_by_member_id VARCHAR NOT NULL,
    created_by_user_id VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    split_type VARCHAR DEFAULT 'equal'
);

CREATE INDEX idx_group_expenses_group_id ON group_expenses(group_id);

CREATE TABLE group_expense_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES group_expenses(id) ON DELETE CASCADE,
    member_id VARCHAR NOT NULL,
    amount NUMERIC(18,2) NOT NULL
);

CREATE INDEX idx_group_expense_shares_expense_id ON group_expense_shares(expense_id);
CREATE INDEX idx_group_expense_shares_member_id ON group_expense_shares(member_id);
```

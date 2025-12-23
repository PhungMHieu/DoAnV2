# Group Expense - Sơ đồ tuần tự chia tiền

## Tổng quan

Group Expense Service hỗ trợ 3 phương thức chia tiền:
1. **Equal Split** - Chia đều cho tất cả người tham gia
2. **Exact Split** - Chỉ định số tiền cụ thể cho từng người
3. **Percent Split** - Chia theo phần trăm cho từng người

---

## Sơ đồ lớp thực thể (Entity Class Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GroupExpense                                      │
│                      (group_expenses table)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  PK   id: string (UUID)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│       groupId: string                    // Reference to Group.id           │
│       title: string                      // Expense description             │
│       amount: string (numeric 18,2)      // Total amount                    │
│       paidByMemberId: string             // Who paid                        │
│       createdByUserId: string            // Who created the expense         │
│       createdAt: Date (timestamptz)      // When created                    │
│       splitType: 'equal'|'exact'|'percent' // Split method                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  1──┐                                                                        │
│     │  OneToMany: shares                                                    │
└─────│───────────────────────────────────────────────────────────────────────┘
      │
      │
      │ N
┌─────▼─────────────────────────────────────────────────────────────────────┐
│                         GroupExpenseShare                                  │
│                   (group_expense_shares table)                             │
├───────────────────────────────────────────────────────────────────────────┤
│  PK   id: string (UUID)                                                   │
│  FK   expenseId: string → GroupExpense.id (CASCADE DELETE)                │
├───────────────────────────────────────────────────────────────────────────┤
│       memberId: string                   // Reference to GroupMember.id   │
│       amount: string (numeric 18,2)      // Member's share amount         │
└───────────────────────────────────────────────────────────────────────────┘
```

### Quan hệ với các Service khác

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│  group-service  │     │ transaction-    │     │  GroupExpense       │
│                 │     │   service       │     │  (entities)         │
│  Group          │────►│                 │     │                     │
│  GroupMember    │     │  GroupExpense   │────►│  • GroupExpense     │
└─────────────────┘     │  GroupExpense   │     │  • GroupExpenseShare│
        │               │  Share          │     └─────────────────────┘
        │               └─────────────────┘
        │ groupId
        │ memberId
        ▼
   ┌────────────────────────────────────────┐
   │ Logical Foreign Keys                   │
   │ (no FK constraint in DB)               │
   │ - GroupExpense.groupId → Group.id      │
   │ - GroupExpense.paidByMemberId →        │
   │   GroupMember.id                       │
   │ - GroupExpenseShare.memberId →         │
   │   GroupMember.id                       │
   └────────────────────────────────────────┘
```

## Kiểu trả về (Response Types)

### GroupExpense Response

```typescript
{
  id: string                              // UUID của expense
  groupId: string                         // ID của group
  title: string                           // Mô tả chi tiêu
  amount: string                          // Tổng số tiền (VD: "300.00")
  paidByMemberId: string                  // Member ID người trả tiền
  createdByUserId: string                 // User ID người tạo expense
  createdAt: Date                         // Timestamp tạo
  splitType: 'equal'|'exact'|'percent'    // Kiểu chia tiền
  shares: GroupExpenseShare[]             // Danh sách shares
}
```

### GroupExpenseShare Response

```typescript
{
  id: string              // UUID của share
  expenseId: string       // ID của expense cha
  memberId: string        // Member ID
  amount: string          // Số tiền member này phải trả (VD: "100.00")
}
```

### Example Response - Equal Split

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "groupId": "group-uuid-123",
  "title": "Dinner at restaurant",
  "amount": "300.00",
  "paidByMemberId": "member-1",
  "createdByUserId": "user-uuid-456",
  "createdAt": "2024-12-21T10:30:00Z",
  "splitType": "equal",
  "shares": [
    {
      "id": "share-uuid-1",
      "expenseId": "550e8400-e29b-41d4-a716-446655440000",
      "memberId": "member-1",
      "amount": "100.00"
    },
    {
      "id": "share-uuid-2",
      "expenseId": "550e8400-e29b-41d4-a716-446655440000",
      "memberId": "member-2",
      "amount": "100.00"
    },
    {
      "id": "share-uuid-3",
      "expenseId": "550e8400-e29b-41d4-a716-446655440000",
      "memberId": "member-3",
      "amount": "100.00"
    }
  ]
}
```

### Example Response - Exact Split

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "groupId": "group-uuid-123",
  "title": "Grocery shopping",
  "amount": "500.00",
  "paidByMemberId": "member-1",
  "createdByUserId": "user-uuid-456",
  "createdAt": "2024-12-21T11:00:00Z",
  "splitType": "exact",
  "shares": [
    {
      "id": "share-uuid-4",
      "expenseId": "660e8400-e29b-41d4-a716-446655440001",
      "memberId": "member-1",
      "amount": "200.00"
    },
    {
      "id": "share-uuid-5",
      "expenseId": "660e8400-e29b-41d4-a716-446655440001",
      "memberId": "member-2",
      "amount": "300.00"
    }
  ]
}
```

### Example Response - Percent Split

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "groupId": "group-uuid-123",
  "title": "Taxi fare",
  "amount": "1000.00",
  "paidByMemberId": "member-1",
  "createdByUserId": "user-uuid-456",
  "createdAt": "2024-12-21T12:00:00Z",
  "splitType": "percent",
  "shares": [
    {
      "id": "share-uuid-6",
      "expenseId": "770e8400-e29b-41d4-a716-446655440002",
      "memberId": "member-1",
      "amount": "400.00"
    },
    {
      "id": "share-uuid-7",
      "expenseId": "770e8400-e29b-41d4-a716-446655440002",
      "memberId": "member-2",
      "amount": "600.00"
    }
  ]
}
```

---

## Sơ đồ tuần tự (Sequence Diagrams)

### 1. Luồng chia tiền đều (Equal Split)

**Endpoint:** `POST /groups/:groupId/expenses`
**Split Type:** `equal`

```
┌────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ Client │     │ GroupExpense │     │ GroupExpense │     │ Database │
│        │     │  Controller  │     │   Service    │     │(Postgres)│
└───┬────┘     └──────┬───────┘     └──────┬───────┘     └────┬─────┘
    │                 │                    │                   │
    │ POST /groups/   │                    │                   │
    │ {groupId}/      │                    │                   │
    │ expenses        │                    │                   │
    │ {               │                    │                   │
    │   title,        │                    │                   │
    │   amount: 300,  │                    │                   │
    │   paidByMemberId,│                   │                   │
    │   splitType:    │                    │                   │
    │     "equal",    │                    │                   │
    │   participant-  │                    │                   │
    │   MemberIds: [] │                    │                   │
    │ }               │                    │                   │
    ├────────────────>│                    │                   │
    │                 │                    │                   │
    │                 │ getUserId(req)     │                   │
    │                 │ (from JWT)         │                   │
    │                 ├────────┐           │                   │
    │                 │        │           │                   │
    │                 │<───────┘           │                   │
    │                 │                    │                   │
    │                 │ Validate input:    │                   │
    │                 │ - title required   │                   │
    │                 │ - amount > 0       │                   │
    │                 │ - splitType valid  │                   │
    │                 │ - participant      │                   │
    │                 │   MemberIds array  │                   │
    │                 ├────────┐           │                   │
    │                 │        │           │                   │
    │                 │<───────┘           │                   │
    │                 │                    │                   │
    │                 │ createExpense      │                   │
    │                 │ EqualSplit()       │                   │
    │                 ├───────────────────>│                   │
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Tính toán chia đều (cents)   │
    │                 │         │ 1. Convert to cents:         │
    │                 │         │    totalCents = 300 * 100    │
    │                 │         │              = 30000 cents   │
    │                 │         │ 2. N participants = 3        │
    │                 │         │ 3. base = floor(30000/3)     │
    │                 │         │         = 10000 cents        │
    │                 │         │ 4. remainder = 30000-30000   │
    │                 │         │              = 0             │
    │                 │         │ 5. Each gets: 10000 cents    │
    │                 │         │              = 100.00        │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ toCents()         │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Phân bổ phần dư (nếu có)     │
    │                 │         │ VD: 100.01 / 3 người         │
    │                 │         │ base = 33 cents              │
    │                 │         │ remainder = 1 cent           │
    │                 │         │ → [33.34, 33.33, 33.33]      │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ persistExpense    │
    │                 │                    │ WithShares()      │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │ BEGIN TX          │
    │                 │                    │                   │
    │                 │                    │ CREATE            │
    │                 │                    │ GroupExpense      │
    │                 │                    │ {                 │
    │                 │                    │   groupId,        │
    │                 │                    │   title,          │
    │                 │                    │   amount: "300.00"│
    │                 │                    │   paidByMemberId, │
    │                 │                    │   splitType:      │
    │                 │                    │     "equal"       │
    │                 │                    │ }                 │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ INSERT expense    │
    │                 │                    │                   │
    │                 │                    │ Saved Expense     │
    │                 │                    │ (id: uuid)        │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Create shares for each       │
    │                 │         │ participant:                 │
    │                 │         │ - memberId: "member-1"       │
    │                 │         │   amount: "100.00"           │
    │                 │         │ - memberId: "member-2"       │
    │                 │         │   amount: "100.00"           │
    │                 │         │ - memberId: "member-3"       │
    │                 │         │   amount: "100.00"           │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ INSERT shares     │
    │                 │                    │ (bulk)            │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ Saved Shares      │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │                    │ COMMIT TX         │
    │                 │                    │                   │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │ GroupExpense       │                   │
    │                 │ + shares[]         │                   │
    │                 │<───────────────────┤                   │
    │                 │                    │                   │
    │ Response:       │                    │                   │
    │ {               │                    │                   │
    │   id,           │                    │                   │
    │   groupId,      │                    │                   │
    │   title,        │                    │                   │
    │   amount: "300" │                    │                   │
    │   splitType:    │                    │                   │
    │     "equal",    │                    │                   │
    │   shares: [     │                    │                   │
    │     {memberId,  │                    │                   │
    │      amount}... │                    │                   │
    │   ]             │                    │                   │
    │ }               │                    │                   │
    │<────────────────┤                    │                   │
    │                 │                    │                   │
```

### 2. Luồng chia tiền theo số tiền cụ thể (Exact Split)

**Endpoint:** `POST /groups/:groupId/expenses`
**Split Type:** `exact`

```
┌────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ Client │     │ GroupExpense │     │ GroupExpense │     │ Database │
│        │     │  Controller  │     │   Service    │     │(Postgres)│
└───┬────┘     └──────┬───────┘     └──────┬───────┘     └────┬─────┘
    │                 │                    │                   │
    │ POST /groups/   │                    │                   │
    │ {groupId}/      │                    │                   │
    │ expenses        │                    │                   │
    │ {               │                    │                   │
    │   title,        │                    │                   │
    │   amount: 500,  │                    │                   │
    │   paidByMemberId,│                   │                   │
    │   splitType:    │                    │                   │
    │     "exact",    │                    │                   │
    │   splits: [     │                    │                   │
    │     {memberId:  │                    │                   │
    │      "m1",      │                    │                   │
    │      amount:200},│                   │                   │
    │     {memberId:  │                    │                   │
    │      "m2",      │                    │                   │
    │      amount:300} │                   │                   │
    │   ]             │                    │                   │
    │ }               │                    │                   │
    ├────────────────>│                    │                   │
    │                 │                    │                   │
    │                 │ getUserId(req)     │                   │
    │                 ├────────┐           │                   │
    │                 │        │           │                   │
    │                 │<───────┘           │                   │
    │                 │                    │                   │
    │                 │ Validate input     │                   │
    │                 ├────────┐           │                   │
    │                 │        │           │                   │
    │                 │<───────┘           │                   │
    │                 │                    │                   │
    │                 │ createExpense      │                   │
    │                 │ ExactSplit()       │                   │
    │                 ├───────────────────>│                   │
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Validate exact amounts       │
    │                 │         │ 1. Parse all amounts         │
    │                 │         │ 2. Convert to cents:         │
    │                 │         │    m1: 200 * 100 = 20000     │
    │                 │         │    m2: 300 * 100 = 30000     │
    │                 │         │ 3. Sum = 50000 cents         │
    │                 │         │ 4. Total = 500 * 100         │
    │                 │         │          = 50000 cents       │
    │                 │         │ 5. Validate: sum == total    │
    │                 │         │    ✓ 50000 == 50000          │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ requireString()   │
    │                 │                    │ requirePositive   │
    │                 │                    │ Number()          │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │                    │ toCents() for     │
    │                 │                    │ each split        │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Validate sum == total        │
    │                 │         │ If not match:                │
    │                 │         │ → throw BadRequestException  │
    │                 │         │   "Sum of splits must equal  │
    │                 │         │    total amount"             │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ persistExpense    │
    │                 │                    │ WithShares()      │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │ BEGIN TX          │
    │                 │                    │                   │
    │                 │                    │ INSERT expense    │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ Saved Expense     │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │                    │ INSERT shares     │
    │                 │                    │ [{memberId:"m1", │
    │                 │                    │   amount:"200.00"}│
    │                 │                    │  {memberId:"m2", │
    │                 │                    │   amount:"300.00"}│
    │                 │                    │ ]                 │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ Saved Shares      │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │                    │ COMMIT TX         │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │ GroupExpense       │                   │
    │                 │<───────────────────┤                   │
    │                 │                    │                   │
    │ Response        │                    │                   │
    │<────────────────┤                    │                   │
    │                 │                    │                   │
```

### 3. Luồng chia tiền theo phần trăm (Percent Split)

**Endpoint:** `POST /groups/:groupId/expenses`
**Split Type:** `percent`

```
┌────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ Client │     │ GroupExpense │     │ GroupExpense │     │ Database │
│        │     │  Controller  │     │   Service    │     │(Postgres)│
└───┬────┘     └──────┬───────┘     └──────┬───────┘     └────┬─────┘
    │                 │                    │                   │
    │ POST /groups/   │                    │                   │
    │ {groupId}/      │                    │                   │
    │ expenses        │                    │                   │
    │ {               │                    │                   │
    │   title,        │                    │                   │
    │   amount: 1000, │                    │                   │
    │   paidByMemberId,│                   │                   │
    │   splitType:    │                    │                   │
    │     "percent",  │                    │                   │
    │   splits: [     │                    │                   │
    │     {memberId:  │                    │                   │
    │      "m1",      │                    │                   │
    │      percent:40},│                   │                   │
    │     {memberId:  │                    │                   │
    │      "m2",      │                    │                   │
    │      percent:60} │                   │                   │
    │   ]             │                    │                   │
    │ }               │                    │                   │
    ├────────────────>│                    │                   │
    │                 │                    │                   │
    │                 │ getUserId(req)     │                   │
    │                 ├────────┐           │                   │
    │                 │        │           │                   │
    │                 │<───────┘           │                   │
    │                 │                    │                   │
    │                 │ Validate input     │                   │
    │                 ├────────┐           │                   │
    │                 │        │           │                   │
    │                 │<───────┘           │                   │
    │                 │                    │                   │
    │                 │ createExpense      │                   │
    │                 │ PercentSplit()     │                   │
    │                 ├───────────────────>│                   │
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Validate percent total       │
    │                 │         │ 1. Sum percents: 40 + 60     │
    │                 │         │                = 100         │
    │                 │         │ 2. Check: |sum - 100| < ε    │
    │                 │         │    ✓ Valid                   │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ requireNonNegative│
    │                 │                    │ Number() for %    │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Calculate cents with         │
    │                 │         │ Largest Remainder Method     │
    │                 │         │                              │
    │                 │         │ totalCents = 1000*100        │
    │                 │         │            = 100000          │
    │                 │         │                              │
    │                 │         │ m1: ideal = 100000*40/100    │
    │                 │         │           = 40000.0          │
    │                 │         │     floor = 40000            │
    │                 │         │     frac  = 0.0              │
    │                 │         │                              │
    │                 │         │ m2: ideal = 100000*60/100    │
    │                 │         │           = 60000.0          │
    │                 │         │     floor = 60000            │
    │                 │         │     frac  = 0.0              │
    │                 │         │                              │
    │                 │         │ used = 40000 + 60000         │
    │                 │         │      = 100000                │
    │                 │         │ remain = 100000 - 100000     │
    │                 │         │        = 0                   │
    │                 │         │                              │
    │                 │         │ Final:                       │
    │                 │         │ - m1: 40000 cents = 400.00   │
    │                 │         │ - m2: 60000 cents = 600.00   │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │         ┌──────────────────────────────┐
    │                 │         │ Example with rounding:       │
    │                 │         │ amount: 100.01 / 3 people    │
    │                 │         │ percent: [33.33, 33.33, 33.34]│
    │                 │         │                              │
    │                 │         │ totalCents = 10001           │
    │                 │         │                              │
    │                 │         │ m1: 10001*33.33/100=3333.33  │
    │                 │         │     floor=3333, frac=0.33    │
    │                 │         │ m2: 10001*33.33/100=3333.33  │
    │                 │         │     floor=3333, frac=0.33    │
    │                 │         │ m3: 10001*33.34/100=3334.33  │
    │                 │         │     floor=3334, frac=0.33    │
    │                 │         │                              │
    │                 │         │ used = 9999                  │
    │                 │         │ remain = 2                   │
    │                 │         │                              │
    │                 │         │ Sort by frac (all 0.33):     │
    │                 │         │ Distribute 2 cents to first  │
    │                 │         │ 2 entries                    │
    │                 │         │                              │
    │                 │         │ Final: [3334, 3334, 3333]    │
    │                 │         │      = [33.34, 33.34, 33.33] │
    │                 │         └──────────────────────────────┘
    │                 │                    │                   │
    │                 │                    │ persistExpense    │
    │                 │                    │ WithShares()      │
    │                 │                    ├────────┐          │
    │                 │                    │        │          │
    │                 │                    │ BEGIN TX          │
    │                 │                    │                   │
    │                 │                    │ INSERT expense    │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ Saved Expense     │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │                    │ INSERT shares     │
    │                 │                    │ [{memberId:"m1", │
    │                 │                    │   amount:"400.00"}│
    │                 │                    │  {memberId:"m2", │
    │                 │                    │   amount:"600.00"}│
    │                 │                    │ ]                 │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ Saved Shares      │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │                    │ COMMIT TX         │
    │                 │                    │<───────┘          │
    │                 │                    │                   │
    │                 │ GroupExpense       │                   │
    │                 │<───────────────────┤                   │
    │                 │                    │                   │
    │ Response        │                    │                   │
    │<────────────────┤                    │                   │
    │                 │                    │                   │
```

### 4. Luồng lấy danh sách chi tiêu của nhóm (GET /groups/:groupId/expenses)

```
┌────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ Client │     │ GroupExpense │     │ GroupExpense │     │ Database │
│        │     │  Controller  │     │   Service    │     │(Postgres)│
└───┬────┘     └──────┬───────┘     └──────┬───────┘     └────┬─────┘
    │                 │                    │                   │
    │ GET /groups/    │                    │                   │
    │ {groupId}/      │                    │                   │
    │ expenses        │                    │                   │
    ├────────────────>│                    │                   │
    │                 │                    │                   │
    │                 │ getExpensesOfGroup│                   │
    │                 ├───────────────────>│                   │
    │                 │                    │                   │
    │                 │                    │ SELECT            │
    │                 │                    │ group_expenses    │
    │                 │                    │ WHERE groupId=?   │
    │                 │                    │ WITH shares       │
    │                 │                    │ ORDER BY          │
    │                 │                    │ createdAt DESC    │
    │                 │                    ├──────────────────>│
    │                 │                    │                   │
    │                 │                    │ Expenses +        │
    │                 │                    │ Shares[]          │
    │                 │                    │<──────────────────┤
    │                 │                    │                   │
    │                 │ GroupExpense[]     │                   │
    │                 │<───────────────────┤                   │
    │                 │                    │                   │
    │ Response:       │                    │                   │
    │ [               │                    │                   │
    │   {             │                    │                   │
    │     id,         │                    │                   │
    │     title,      │                    │                   │
    │     amount,     │                    │                   │
    │     splitType,  │                    │                   │
    │     shares: [   │                    │                   │
    │       {memberId,│                    │                   │
    │        amount}  │                    │                   │
    │     ]           │                    │                   │
    │   }, ...        │                    │                   │
    │ ]               │                    │                   │
    │<────────────────┤                    │                   │
    │                 │                    │                   │
```

---

## Ghi chú kỹ thuật

### Xử lý số tiền (Money Handling)

#### Tại sao dùng cents?
- **Tránh floating point errors**: `0.1 + 0.2 !== 0.3` trong JavaScript
- **Chính xác tuyệt đối**: Tất cả tính toán trên số nguyên (cents)
- **Lưu trữ**: Database lưu string với 2 chữ số thập phân (`"100.00"`)

#### Conversion Flow
```
Input (VND)  →  Cents (int)  →  Calculation  →  String (2dp)  →  Database
  300.50     →     30050      →   Math.floor  →   "300.50"    →   NUMERIC
```

### Thuật toán chia đều (Equal Split)

```typescript
// Example: 100.01 VND chia cho 3 người
totalCents = 10001
n = 3

base = Math.floor(10001 / 3) = 3333
remainder = 10001 - (3333 * 3) = 2

// Phân bổ phần dư cho 2 người đầu tiên
Person 1: 3333 + 1 = 3334 cents = 33.34 VND
Person 2: 3333 + 1 = 3334 cents = 33.34 VND
Person 3: 3333 + 0 = 3333 cents = 33.33 VND

Total: 33.34 + 33.34 + 33.33 = 100.01 ✓
```

### Thuật toán chia theo phần trăm (Percent Split)

Sử dụng **Largest Remainder Method** để đảm bảo tổng chính xác:

```typescript
// Example: 100.00 VND với [33.33%, 33.33%, 33.34%]
totalCents = 10000

Step 1: Tính ideal amount cho mỗi phần trăm
  m1: 10000 * 33.33 / 100 = 3333.0 → floor=3333, frac=0.0
  m2: 10000 * 33.33 / 100 = 3333.0 → floor=3333, frac=0.0
  m3: 10000 * 33.34 / 100 = 3334.0 → floor=3334, frac=0.0

Step 2: Tính remainder
  used = 3333 + 3333 + 3334 = 10000
  remain = 10000 - 10000 = 0

Step 3: Sort by fraction (descending) và phân bổ remain
  (No remainder to distribute)

Final: [3333, 3333, 3334] = [33.33, 33.33, 33.34] ✓
```

### Validation Rules

#### Equal Split
- ✅ `participantMemberIds` phải là array không rỗng
- ✅ Mỗi memberId phải là string không rỗng
- ✅ `amount > 0`

#### Exact Split
- ✅ `splits` phải là array không rỗng
- ✅ Mỗi split phải có `memberId` và `amount`
- ✅ `amount >= 0` cho mỗi split
- ✅ **CRITICAL**: Tổng splits phải bằng total amount
  ```
  sum(split.amount) === total.amount
  ```

#### Percent Split
- ✅ `splits` phải là array không rỗng
- ✅ Mỗi split phải có `memberId` và `percent`
- ✅ `percent >= 0` cho mỗi split
- ✅ **CRITICAL**: Tổng percent phải bằng 100 (sai số ≤ 0.0001)
  ```
  |sum(split.percent) - 100| < 0.0001
  ```

### Database Schema

```sql
-- Table: group_expenses
CREATE TABLE group_expenses (
  id UUID PRIMARY KEY,
  group_id VARCHAR NOT NULL,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,  -- Stored as string with 2 decimals
  paid_by_member_id VARCHAR NOT NULL,
  created_by_user_id VARCHAR NOT NULL,
  split_type VARCHAR(20) NOT NULL,  -- 'equal', 'exact', 'percent'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: group_expense_shares
CREATE TABLE group_expense_shares (
  id SERIAL PRIMARY KEY,
  expense_id UUID REFERENCES group_expenses(id) ON DELETE CASCADE,
  member_id VARCHAR NOT NULL,
  amount NUMERIC(15,2) NOT NULL,  -- Each member's share
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Transaction Safety
- Tất cả operations đều chạy trong **database transaction**
- `BEGIN TX` → `INSERT expense` → `INSERT shares` → `COMMIT`
- Nếu lỗi bất kỳ → `ROLLBACK` toàn bộ
- Đảm bảo data integrity: không có expense mà không có shares

### Edge Cases Handled

1. **Rounding errors**
   - ✅ Equal split với số không chia hết
   - ✅ Percent split với phần trăm decimal

2. **Validation errors**
   - ✅ Exact split: sum ≠ total → reject
   - ✅ Percent split: sum ≠ 100% → reject
   - ✅ Duplicate memberIds → reject

3. **Precision**
   - ✅ Tất cả amounts lưu với 2 chữ số thập phân
   - ✅ Không mất cents trong quá trình tính toán

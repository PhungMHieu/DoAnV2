# Sơ đồ tuần tự: Flutter gọi API getListMonth

## Mô tả
Sơ đồ này mô tả quy trình xử lý khi ứng dụng Flutter gọi API `GET /months` để lấy danh sách các tháng có giao dịch.

## Endpoint
- **Method**: GET
- **Path**: `/api/transactions/months`
- **Authentication**: Bearer JWT Token (required)

---

## Sơ đồ tuần tự ASCII

```
┌─────────┐      ┌──────────────┐      ┌─────────────────────┐      ┌─────────────────────────┐      ┌──────────┐
│ Flutter │      │ Kong Gateway │      │ Transaction Service │      │ Transaction Service     │      │ Postgres │
│  App    │      │   (:8000)    │      │ Controller (:3001)  │      │ Service Layer           │      │ Database │
└────┬────┘      └──────┬───────┘      └──────────┬──────────┘      └───────────┬─────────────┘      └────┬─────┘
     │                  │                          │                             │                         │
     │                  │                          │                             │                         │
     │ 1. GET /api/transactions/months            │                             │                         │
     │    Authorization: Bearer {JWT}              │                             │                         │
     ├─────────────────>│                          │                             │                         │
     │                  │                          │                             │                         │
     │                  │ 2. Validate JWT          │                             │                         │
     │                  │    - Verify signature    │                             │                         │
     │                  │    - Check expiration    │                             │                         │
     │                  │    - Extract claims      │                             │                         │
     │                  │      (sub, email, iss)   │                             │                         │
     │                  ├────────┐                 │                             │                         │
     │                  │        │                 │                             │                         │
     │                  │<───────┘                 │                             │                         │
     │                  │                          │                             │                         │
     │                  │ 3. Route to service      │                             │                         │
     │                  │    Strip path prefix     │                             │                         │
     │                  │    /api/transactions/months → /months                  │                         │
     │                  │    Forward JWT token     │                             │                         │
     │                  ├─────────────────────────>│                             │                         │
     │                  │ GET /months              │                             │                         │
     │                  │ Authorization: Bearer {JWT}                            │                         │
     │                  │                          │                             │                         │
     │                  │                          │ 4. Extract userId from JWT  │                         │
     │                  │                          │    - Call getUserIdFromRequest(req)                   │
     │                  │                          │    - Decode JWT token       │                         │
     │                  │                          │    - Extract 'sub' claim → userId                     │
     │                  │                          ├─────────────┐               │                         │
     │                  │                          │             │               │                         │
     │                  │                          │<────────────┘               │                         │
     │                  │                          │                             │                         │
     │                  │                          │ 5. Validate userId exists   │                         │
     │                  │                          │    If null/undefined:       │                         │
     │                  │                          │    → throw UnauthorizedException                      │
     │                  │                          ├─────────────┐               │                         │
     │                  │                          │             │               │                         │
     │                  │                          │<────────────┘               │                         │
     │                  │                          │                             │                         │
     │                  │                          │ 6. Call service layer       │                         │
     │                  │                          │    getAvailableMonthsByUser(userId)                   │
     │                  │                          ├────────────────────────────>│                         │
     │                  │                          │                             │                         │
     │                  │                          │                             │ 7. Query Database       │
     │                  │                          │                             │    SELECT dateTime      │
     │                  │                          │                             │    FROM transaction     │
     │                  │                          │                             │    WHERE userId = ?     │
     │                  │                          │                             │    ORDER BY dateTime ASC│
     │                  │                          │                             ├────────────────────────>│
     │                  │                          │                             │                         │
     │                  │                          │                             │ 8. Return transactions  │
     │                  │                          │                             │    [{dateTime: ...}, ...]
     │                  │                          │                             │<────────────────────────┤
     │                  │                          │                             │                         │
     │                  │                          │                             │ 9. Process data         │
     │                  │                          │                             │    - Extract unique months
     │                  │                          │                             │    - Format: MM/YYYY    │
     │                  │                          │                             │    - Add 'future' option│
     │                  │                          │                             │    - Return array       │
     │                  │                          │                             ├───────────┐             │
     │                  │                          │                             │           │             │
     │                  │                          │                             │<──────────┘             │
     │                  │                          │                             │                         │
     │                  │                          │ 10. Return months array     │                         │
     │                  │                          │     ["01/2024", "02/2024", "future"]                  │
     │                  │                          │<────────────────────────────┤                         │
     │                  │                          │                             │                         │
     │                  │ 11. Return HTTP 200      │                             │                         │
     │                  │     Content-Type: application/json                     │                         │
     │                  │     Body: ["01/2024", "02/2024", "future"]             │                         │
     │                  │<─────────────────────────┤                             │                         │
     │                  │                          │                             │                         │
     │ 12. Receive response                        │                             │                         │
     │     ["01/2024", "02/2024", "future"]        │                             │                         │
     │<─────────────────┤                          │                             │                         │
     │                  │                          │                             │                         │
     │ 13. Update UI    │                          │                             │                         │
     │     Display month list                      │                             │                         │
     ├────────┐         │                          │                             │                         │
     │        │         │                          │                             │                         │
     │<───────┘         │                          │                             │                         │
     │                  │                          │                             │                         │
```

---

## Chi tiết từng bước

### 1. Flutter gửi HTTP Request
- **URL**: `http://localhost:8000/api/transactions/months`
- **Method**: GET
- **Headers**:
  - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Body**: None

### 2. Kong Gateway xác thực JWT
- Kong kiểm tra JWT plugin
- Xác thực chữ ký (signature) với JWT_SECRET
- Kiểm tra thời gian hết hạn (exp claim)
- Kiểm tra issuer (iss claim)
- Trích xuất thông tin user từ claims:
  - `sub`: User ID
  - `email`: Email của user

### 3. Kong routing và chuyển tiếp request
- Nếu JWT hợp lệ, Kong tra cứu routing configuration
- Path matching: `/api/transactions/months` → service `transaction-service`
- Strip path: `/api/transactions` → chỉ forward `/months` đến service
- Forward đến: `http://transaction-service:3001/months`
- Giữ nguyên JWT trong Authorization header

### 4. Transaction Service Controller nhận request
File: [apps/transaction-service/src/transaction-service.controller.ts:21-44](apps/transaction-service/src/transaction-service.controller.ts#L21-L44)

```typescript
@Get('months')
async getAvailableMonths(@Req() req): Promise<string[]> {
  const userId = getUserIdFromRequest(req); // 👈 Extract từ JWT

  if (!userId) {
    throw new UnauthorizedException('Missing or invalid JWT token');
  }

  return await this.transactionServiceService.getAvailableMonthsByUser(userId);
}
```

### 5. Trích xuất userId từ JWT
File: [libs/common/src/middleware/jwt-extract.middleware.ts:30-39](libs/common/src/middleware/jwt-extract.middleware.ts#L30-L39)

```typescript
export function getUserIdFromRequest(req: Request): string | null {
  // Check header x-user-id trước (nếu có)
  const existingUserId = req.headers['x-user-id'] as string;
  if (existingUserId) {
    return existingUserId;
  }

  // Extract từ Authorization header
  return extractUserIdFromToken(req.headers['authorization']);
}
```

- Decode JWT token (không verify vì Kong đã verify)
- Lấy claim `sub` (subject) chứa userId

### 6. Gọi Service Layer
File: [apps/transaction-service/src/transaction-service.service.ts:143-170](apps/transaction-service/src/transaction-service.service.ts#L143-L170)

```typescript
async getAvailableMonthsByUser(userId: string): Promise<string[]> {
  // Query transactions của user
  const transactions = await this.transactionRepository
    .createQueryBuilder('transaction')
    .select('transaction.dateTime')
    .where('transaction.userId = :userId', { userId })
    .orderBy('transaction.dateTime', 'ASC')
    .getMany();

  // Xử lý dữ liệu...
}
```

### 7. Query Database
```sql
SELECT
  "transaction"."dateTime"
FROM "transaction"
WHERE "transaction"."userId" = $1
ORDER BY "transaction"."dateTime" ASC
```

**Parameters**: `[$1 = userId]`

### 8. Database trả về kết quả
```json
[
  { "dateTime": "2024-01-15T10:30:00Z" },
  { "dateTime": "2024-01-20T14:00:00Z" },
  { "dateTime": "2024-02-05T09:15:00Z" },
  { "dateTime": "2024-02-18T16:45:00Z" }
]
```

### 9. Service xử lý dữ liệu
```typescript
// Extract unique months in MM/YYYY format
const monthsSet = new Set<string>();

transactions.forEach(transaction => {
  const date = new Date(transaction.dateTime);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  monthsSet.add(`${month}/${year}`);
});

const months = Array.from(monthsSet);
months.push('future'); // Thêm option "future" cho giao dịch tương lai

return months;
```

**Kết quả**: `["01/2024", "02/2024", "future"]`

### 10-12. Trả response về Flutter
- Service layer → Controller
- Controller → Kong Gateway
- Kong → Flutter App

**HTTP Response**:
```json
HTTP/1.1 200 OK
Content-Type: application/json

[
  "01/2024",
  "02/2024",
  "future"
]
```

### 13. Flutter cập nhật UI
Flutter nhận response và hiển thị danh sách tháng cho user chọn.

---

## Error Handling

### Trường hợp JWT không hợp lệ hoặc hết hạn

```
┌─────────┐      ┌──────┐
│ Flutter │      │ Kong │
└────┬────┘      └──┬───┘
     │                │
     │ GET /api/transactions/months
     │ Authorization: Bearer {invalid_token}
     ├───────────────>│
     │                │
     │                │ Validate JWT ❌
     │                │ → Invalid signature
     │                │ → or Expired
     │                ├────────┐
     │                │        │
     │                │<───────┘
     │                │
     │ HTTP 401 Unauthorized
     │ {"message": "Invalid token"}
     │<───────────────┤
     │                │
```

### Trường hợp thiếu userId trong JWT

```
┌─────────────────────┐      ┌─────────────────────────┐
│ Transaction Service │      │ Transaction Service     │
│ Controller          │      │ Service Layer           │
└──────────┬──────────┘      └───────────┬─────────────┘
           │                             │
           │ getUserIdFromRequest(req)   │
           ├─────────────┐               │
           │             │               │
           │<────────────┘               │
           │ userId = null ❌            │
           │                             │
           │ throw UnauthorizedException │
           │ "Missing or invalid JWT token"
           │                             │
           │ ← HTTP 401 ───────────────> Flutter
           │                             │
```

---

## Các component liên quan

### 1. Kong Gateway
- **Port**: 8000 (proxy), 8001 (admin API)
- **Nhiệm vụ**:
  - Xác thực JWT
  - Rate limiting
  - Load balancing
  - Routing

### 2. Transaction Service
- **Port**: 3001
- **Controller**: [transaction-service.controller.ts](apps/transaction-service/src/transaction-service.controller.ts)
- **Service**: [transaction-service.service.ts](apps/transaction-service/src/transaction-service.service.ts)
- **Nhiệm vụ**:
  - Xử lý logic nghiệp vụ liên quan transaction
  - Tương tác với database

### 3. PostgreSQL Database
- **Port**: 5433 (mapped to 5432)
- **Database**: myfinance_db
- **Tables**: transaction, account

---

## Technologies Stack

- **Frontend**: Flutter
- **API Gateway**: Kong Gateway 3.9
- **Backend Framework**: NestJS
- **Database**: PostgreSQL 15
- **Message Queue**: RabbitMQ 3.13
- **Cache**: Redis 7
- **Authentication**: JWT (JSON Web Token)
- **ORM**: TypeORM

---

## Lưu ý bảo mật

1. **JWT được validate 2 lần**:
   - Lần 1: Tại Kong Gateway (verify signature, expiration)
   - Lần 2: Tại Transaction Service (extract userId, validate existence)

2. **userId được lấy trực tiếp từ JWT**:
   - Không cho phép client gửi userId qua query param hay body
   - Đảm bảo user chỉ có thể truy cập data của chính họ

3. **Database query có WHERE clause**:
   - Luôn filter theo `userId` để tránh data leak
   - User A không thể xem transactions của User B

---

## Performance Optimization

1. **Caching** (có thể implement):
   - Cache danh sách tháng trong Redis
   - TTL: 1 hour hoặc invalidate khi có transaction mới

2. **Database Index**:
   - Index trên `userId` column
   - Composite index trên `(userId, dateTime)` để tăng tốc query

3. **Query Optimization**:
   - Chỉ SELECT field cần thiết (`dateTime`)
   - Không load toàn bộ transaction entity

---

**Tài liệu được tạo**: 2025-12-21
**Version**: 1.0
**Author**: System Documentation

# Cache Invalidation Fix

## Vấn Đề

Khi **chia tiền nhóm** hoặc **mark debt as paid**, transactions được tạo nhưng **dữ liệu không cập nhật** khi gọi API `/transactions/summary`.

### Root Cause

Report Service sử dụng **Cache-Aside pattern** với logic:
1. ✅ Client request → Try cache first
2. ✅ Cache HIT → Return data từ cache (fast)
3. ✅ Cache MISS → Query SSOT → Rebuild cache

**Nhưng** khi có transaction mới:
1. ✅ Transaction Service emit event `transaction.created`
2. ✅ Report Service nhận event
3. ❌ Report Service **KHÔNG invalidate cache**
4. ❌ Request tiếp theo vẫn **Cache HIT** với **data cũ**

### Ví Dụ Cụ Thể

```
1. Bob tạo group expense 300k "food" (12/2025)
   → Transaction Service: Creates transaction for Bob (-300k, category: "food")
   → RabbitMQ: Emit event transaction.created
   → Report Service: Receive event + apply incremental update to cache ✅

2. Client gọi GET /transactions/summary?monthYear=12/2025
   → Report Service: Cache HIT
   → Returns: { food: 300, totals: { expense: 300 } } ✅

3. Alice mark debt as paid (100k)
   → Transaction Service: Creates 2 transactions:
     - Alice: -100k, category: "food"
     - Bob: +100k, category: "Income"
   → RabbitMQ: Emit 2 events transaction.created
   → Report Service: Receive events + apply incremental update ✅

4. Client gọi GET /transactions/summary?monthYear=12/2025
   → Report Service: Cache HIT (data cũ!)
   → Returns: { food: 300, totals: { expense: 300 } } ❌
   → Expected: { food: 400, income: 100, totals: { expense: 400, income: 100 } }
```

**Why?** Cache có TTL 24 giờ, nên data cũ vẫn còn valid. Event handler chỉ apply **incremental update** nhưng nếu cache đã có data cũ thì incremental update không đủ chính xác.

## Giải Pháp: Cache Invalidation

Thay vì chỉ **incremental update**, giờ sẽ **INVALIDATE cache** khi có transaction mới, để request tiếp theo sẽ **rebuild từ SSOT**.

### Changes

**File:** [apps/report-service/src/report-service.service.ts](apps/report-service/src/report-service.service.ts)

#### 1. handleCreated() - Invalidate cache on create

```typescript
async handleCreated(payload: TransactionEventDto) {
  this.logger.debug(`transaction.created ${payload.transactionId}`);
  const { after } = payload;
  if (!after) return;

  // ✅ NEW: Invalidate cache for this month to force rebuild from SSOT
  const dateTime = new Date(after.dateTime);
  const month = dateTime.getMonth() + 1;
  const year = dateTime.getFullYear();
  const summaryKey = this.getSummaryKey(payload.userId, year, month);

  try {
    await this.redis.del(summaryKey);
    this.logger.log(`🗑️  [Cache INVALIDATE] Deleted key: ${summaryKey} (transaction created)`);
  } catch (error: any) {
    this.logger.warn(`⚠️  [Cache INVALIDATE FAILED] ${error.message}`);
  }

  // Also apply incremental update (backup in case cache is already invalidated)
  await this.applyTransactionDelta(
    payload.userId,
    dateTime,
    after.amount,
    after.category,
    1,
  );
}
```

#### 2. handleUpdated() - Invalidate cache on update

```typescript
async handleUpdated(payload: TransactionEventDto) {
  this.logger.debug(`transaction.updated ${payload.transactionId}`);
  const { before, after } = payload;
  if (!before || !after) return;

  // ✅ NEW: Invalidate cache for both old and new month (might be different)
  const beforeDate = new Date(before.dateTime);
  const afterDate = new Date(after.dateTime);

  const beforeMonth = beforeDate.getMonth() + 1;
  const beforeYear = beforeDate.getFullYear();
  const afterMonth = afterDate.getMonth() + 1;
  const afterYear = afterDate.getFullYear();

  try {
    const beforeKey = this.getSummaryKey(payload.userId, beforeYear, beforeMonth);
    await this.redis.del(beforeKey);
    this.logger.log(`🗑️  [Cache INVALIDATE] Deleted key: ${beforeKey} (transaction updated)`);

    // If different month, invalidate both
    if (beforeMonth !== afterMonth || beforeYear !== afterYear) {
      const afterKey = this.getSummaryKey(payload.userId, afterYear, afterMonth);
      await this.redis.del(afterKey);
      this.logger.log(`🗑️  [Cache INVALIDATE] Deleted key: ${afterKey} (transaction updated - different month)`);
    }
  } catch (error: any) {
    this.logger.warn(`⚠️  [Cache INVALIDATE FAILED] ${error.message}`);
  }

  // Also apply incremental update (backup)
  // ... (existing code)
}
```

#### 3. handleDeleted() - Invalidate cache on delete

```typescript
async handleDeleted(payload: TransactionEventDto) {
  this.logger.debug(`transaction.deleted ${payload.transactionId}`);
  const { before } = payload;
  if (!before) return;

  // ✅ NEW: Invalidate cache for this month
  const dateTime = new Date(before.dateTime);
  const month = dateTime.getMonth() + 1;
  const year = dateTime.getFullYear();
  const summaryKey = this.getSummaryKey(payload.userId, year, month);

  try {
    await this.redis.del(summaryKey);
    this.logger.log(`🗑️  [Cache INVALIDATE] Deleted key: ${summaryKey} (transaction deleted)`);
  } catch (error: any) {
    this.logger.warn(`⚠️  [Cache INVALIDATE FAILED] ${error.message}`);
  }

  // Also apply incremental update (backup)
  // ... (existing code)
}
```

## Flow Sau Khi Fix

### Scenario: Mark Debt As Paid

```
1. Alice mark debt as paid (100k for "food" expense)
   ↓
2. Transaction Service creates 2 transactions:
   - Alice: -100k, category: "food"
   - Bob: +100k, category: "Income"
   ↓
3. Transaction Service emits 2 events:
   - transaction.created (Alice's transaction)
   - transaction.created (Bob's transaction)
   ↓
4. Report Service receives first event (Alice)
   ↓
5. ✅ NEW: Report Service DELETES cache key
      `user:alice:month:2025-12:summary`
   ↓
6. Report Service receives second event (Bob)
   ↓
7. ✅ NEW: Report Service DELETES cache key
      `user:bob:month:2025-12:summary`
   ↓
8. Client gọi GET /transactions/summary?monthYear=12/2025
   ↓
9. Report Service: Cache MISS (cache đã bị xóa)
   ↓
10. Report Service: Query Transaction Service (SSOT)
    → Returns ALL transactions for 12/2025 (including new ones)
   ↓
11. Report Service: Rebuild cache from SSOT
    → Cache now has CORRECT data
   ↓
12. Report Service: Return to client
    → { food: 400, income: 100, totals: { expense: 400, income: 100 } } ✅
```

## Logs Minh Họa

### Before Fix (Data không update):

```
[Report Service] ✅ [Cache HIT] Redis key: user:123:month:2025-12:summary | Hit rate: 60%
[Client] ← { food: 300 }  ❌ (Missing new transaction)
```

### After Fix (Data được update):

```
[Transaction Service] transaction.created: 611e9c2e-3011-400e-9ab0-c101e3433b37
[Report Service] Received transaction.created: 611e9c2e-3011-400e-9ab0-c101e3433b37
[Report Service] 🗑️  [Cache INVALIDATE] Deleted key: user:123:month:2025-12:summary (transaction created)

[Client] GET /transactions/summary?monthYear=12/2025
[Report Service] ❌ [Cache MISS] Redis key: user:123:month:2025-12:summary (empty hash)
[Report Service] 🔄 [Rebuild Cache] Querying Transaction Service for 12/2025
[Report Service] 📌 [SSOT Query] Fetching transactions from Transaction Service
[Report Service] ✅ [SSOT Query] Retrieved 18 transactions (including new ones)
[Report Service] 💾 [Cache UPDATE] Redis key: user:123:month:2025-12:summary
[Client] ← { food: 400, income: 100 } ✅ (Correct data!)
```

## Ưu Điểm Của Giải Pháp

### 1. Eventual Consistency
- Cache được invalidate ngay khi có transaction mới
- Request tiếp theo sẽ **luôn lấy data mới nhất** từ SSOT

### 2. Fault Tolerance
- Nếu Redis down → Cache invalidation fail nhưng **không throw error**
- Incremental update vẫn chạy (backup mechanism)
- Service vẫn hoạt động bình thường

### 3. Performance
- **Chỉ invalidate** cache khi cần (transaction created/updated/deleted)
- **Không rebuild** cache ngay lập tức (lazy rebuild on next request)
- TTL 24 giờ vẫn hoạt động cho các tháng không có activity

### 4. Correctness
- SSOT (Transaction Service) là source of truth
- Cache được rebuild từ SSOT → **100% accurate**
- Không phụ thuộc vào incremental update (có thể sai nếu out-of-order events)

## Testing

### Test 1: Group Expense Creation

```bash
# 1. Create group expense
POST /groups/{groupId}/expenses
{
  "title": "Dinner",
  "amount": 300,
  "category": "food",
  "paidByMemberId": "44",
  "splitType": "equal",
  "participantMemberIds": ["44", "45", "46"]
}

# 2. Immediately check summary
GET /transactions/summary?monthYear=12/2025
# Expected: { food: 300 } ✅
```

### Test 2: Mark Paid

```bash
# 1. Mark debt as paid
POST /groups/{groupId}/expenses/mark-paid
{
  "shareId": "{shareId}"
}

# 2. Check cache invalidation in logs
docker compose logs report-service | grep "Cache INVALIDATE"
# Expected:
# 🗑️  [Cache INVALIDATE] Deleted key: user:alice:month:2025-12:summary
# 🗑️  [Cache INVALIDATE] Deleted key: user:bob:month:2025-12:summary

# 3. Immediately check summary
GET /transactions/summary?monthYear=12/2025
# Expected: { food: 400, income: 100 } ✅ (Updated!)
```

### Test 3: Multiple Quick Operations

```bash
# Create 3 group expenses rapidly
POST /groups/{groupId}/expenses (expense 1)
POST /groups/{groupId}/expenses (expense 2)
POST /groups/{groupId}/expenses (expense 3)

# Check summary immediately
GET /transactions/summary?monthYear=12/2025
# Expected: All 3 expenses included ✅
```

## Tradeoffs

### Pros:
- ✅ Data luôn chính xác (rebuild từ SSOT)
- ✅ Simple logic (invalidate → rebuild)
- ✅ Fault tolerant (graceful degradation)
- ✅ No race conditions (SSOT is source of truth)

### Cons:
- ⚠️ Request đầu tiên sau invalidation sẽ **chậm hơn** (~100-200ms thay vì <10ms)
- ⚠️ Cache bị invalidate **mỗi khi có transaction mới** (có thể frequent nếu nhiều transactions)

### Alternative Solution (Not Chosen):

**Incremental Update Only:**
- Pros: Faster (no cache rebuild)
- Cons: Có thể **không chính xác** nếu:
  - Out-of-order events
  - Transaction dateTime trong quá khứ
  - Events bị miss
  - Cache corruption

**Why Invalidation is Better:**
- Correctness > Performance
- Cache rebuild chỉ diễn ra **1 lần** sau invalidation
- Subsequent requests vẫn fast (cache hit)

## Summary

**Fixed:**
- ✅ Data cập nhật ngay lập tức khi có transaction mới
- ✅ Cache invalidation automatic qua RabbitMQ events
- ✅ Rebuild từ SSOT đảm bảo data chính xác
- ✅ Graceful degradation nếu Redis fail

**Pattern:**
- Write-Invalidate Cache Pattern
- Event-Driven Cache Invalidation
- Lazy Cache Rebuild (rebuild on next read, not on write)

# gRPC Integration: Transaction Service → Report Service

## Tổng quan (Architecture Overview)

### ❌ Design Cũ (SAI - Redis là source of truth)
```
Transaction Created → RabbitMQ → Report Service → Update Redis ONLY
                                                   ↓
                                        GET /summary → Read from Redis
```
**Vấn đề**: Redis crash → MẤT DATA, không có database backup!

### ✅ Design Mới (ĐÚNG - Postgres là source of truth, Redis là cache)
```
Transaction Created → Transaction Service (Postgres) → Emit Event
                                                        ↓
                                                    RabbitMQ
                                                        ↓
                                     Report Service (Postgres - Aggregated Tables)
                                                        ↓
                                           Update aggregation in Postgres
                                                        ↓
                                           Invalidate/Update Redis cache
                                                        ↓
                            GET /summary → Check Redis → Miss? → Query Postgres → Cache it
```

**Key Points**:
- **Transaction Service Postgres**: Lưu raw transactions (source of truth)
- **Report Service Postgres**: Lưu aggregated data (monthly_summaries, daily_stats tables)
- **Redis**: Cache layer cho read queries (TTL: 1 hour)
- **gRPC bidirectional**:
  - Transaction → Report: Notify transaction changes, get balance
  - Report → Transaction: Get account balance

---

## Database Schema

### Transaction Service (Postgres)

```sql
-- Raw transaction data
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  category VARCHAR NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date_time);

-- Account balance
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  user_id VARCHAR UNIQUE NOT NULL,
  balance NUMERIC(18, 2) DEFAULT 0,
  currency VARCHAR DEFAULT 'VND',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Report Service (Postgres)

```sql
-- Aggregated monthly summary (pre-computed)
CREATE TABLE monthly_summaries (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  total_income NUMERIC(18, 2) DEFAULT 0,
  total_expense NUMERIC(18, 2) DEFAULT 0,
  currency VARCHAR DEFAULT 'VND',
  category_breakdown JSONB,  -- {"food": 150000, "transport": 80000}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

CREATE INDEX idx_monthly_summaries_user ON monthly_summaries(user_id, year, month);

-- Aggregated daily stats (for line charts)
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  day INT NOT NULL,
  cumulative_expense NUMERIC(18, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month, day)
);

CREATE INDEX idx_daily_stats_user ON daily_stats(user_id, year, month);
```

---

## Sơ đồ lớp thiết kế (Class Diagram)

### 1. Transaction Service (gRPC Client + Server)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Transaction Service                              │
│                   (gRPC Server for Account Balance)                     │
│                   (gRPC Client to call Report Service)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │              transaction.proto (Protocol Buffer)               │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  // Account balance service (Transaction is SERVER)            │    │
│  │  service AccountService {                                      │    │
│  │    rpc GetBalance(GetBalanceRequest) returns (BalanceResponse)│    │
│  │  }                                                             │    │
│  │                                                                │    │
│  │  // Report aggregation service (Transaction is CLIENT)         │    │
│  │  service ReportAggregationService {                            │    │
│  │    rpc UpdateTransaction(TransactionEvent) returns (Response)  │    │
│  │    rpc DeleteTransaction(TransactionEvent) returns (Response)  │    │
│  │  }                                                             │    │
│  │                                                                │    │
│  │  message GetBalanceRequest {                                   │    │
│  │    string userId = 1;                                          │    │
│  │  }                                                             │    │
│  │                                                                │    │
│  │  message BalanceResponse {                                     │    │
│  │    double balance = 1;                                         │    │
│  │    string currency = 2;                                        │    │
│  │  }                                                             │    │
│  │                                                                │    │
│  │  message TransactionEvent {                                    │    │
│  │    string userId = 1;                                          │    │
│  │    string transactionId = 2;                                   │    │
│  │    TransactionData before = 3;  // For update/delete           │    │
│  │    TransactionData after = 4;   // For create/update           │    │
│  │  }                                                             │    │
│  │                                                                │    │
│  │  message TransactionData {                                     │    │
│  │    double amount = 1;                                          │    │
│  │    string category = 2;                                        │    │
│  │    string dateTime = 3;                                        │    │
│  │  }                                                             │    │
│  │                                                                │    │
│  │  message Response {                                            │    │
│  │    bool success = 1;                                           │    │
│  │    string message = 2;                                         │    │
│  │  }                                                             │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │         AccountGrpcController (gRPC Server)                    │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  @Controller()                                                 │    │
│  │  @GrpcMethod('AccountService', 'GetBalance')                   │    │
│  │  + getBalance(req): Promise<BalanceResponse>                   │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ↓                                          │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │              TransactionServiceService                         │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  - transactionRepo: Repository<Transaction>                    │    │
│  │  - accountRepo: Repository<Account>                            │    │
│  │  - reportGrpcClient: ReportGrpcClient  // NEW                  │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  + createTransaction(dto): Promise<Transaction>                │    │
│  │    {                                                           │    │
│  │      1. Save to Postgres                                       │    │
│  │      2. Update account balance                                 │    │
│  │      3. Call reportGrpcClient.updateTransaction() // gRPC      │    │
│  │    }                                                           │    │
│  │                                                                │    │
│  │  + updateTransaction(id, dto): Promise<Transaction>            │    │
│  │  + deleteTransaction(id): Promise<void>                        │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ↑                                          │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │            ReportGrpcClient (gRPC Client)                      │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  @Injectable()                                                 │    │
│  │  - reportService: IReportAggregationService                    │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  + updateTransaction(event): Promise<Response>                 │    │
│  │  + deleteTransaction(event): Promise<Response>                 │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Report Service (gRPC Server + Client)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Report Service                                  │
│              (gRPC Server for Aggregation Updates)                      │
│              (gRPC Client to get Account Balance)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │      ReportAggregationGrpcController (gRPC Server)             │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  @Controller()                                                 │    │
│  │  - reportService: ReportServiceService                         │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  @GrpcMethod('ReportAggregationService', 'UpdateTransaction')  │    │
│  │  + updateTransaction(event): Promise<Response>                 │    │
│  │                                                                │    │
│  │  @GrpcMethod('ReportAggregationService', 'DeleteTransaction')  │    │
│  │  + deleteTransaction(event): Promise<Response>                 │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ↓                                          │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │              ReportServiceService                              │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  - monthlySummaryRepo: Repository<MonthlySummary>              │    │
│  │  - dailyStatsRepo: Repository<DailyStats>                      │    │
│  │  - redis: Redis (for caching)                                  │    │
│  │  - accountGrpcClient: AccountGrpcClient                        │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  + handleTransactionUpdate(event): Promise<void>               │    │
│  │    {                                                           │    │
│  │      1. Update monthly_summaries table (Postgres)              │    │
│  │      2. Update daily_stats table (Postgres)                    │    │
│  │      3. Invalidate Redis cache for this user/month             │    │
│  │    }                                                           │    │
│  │                                                                │    │
│  │  + getMonthlySummary(userId, monthYear): Promise<Summary>      │    │
│  │    {                                                           │    │
│  │      1. Check Redis cache                                      │    │
│  │      2. If miss → Query Postgres monthly_summaries             │    │
│  │      3. Call accountGrpcClient.getBalance() for balance        │    │
│  │      4. Cache result in Redis (TTL: 1h)                        │    │
│  │      5. Return combined data                                   │    │
│  │    }                                                           │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ↑                                          │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │            AccountGrpcClient (gRPC Client)                     │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  @Injectable()                                                 │    │
│  │  - accountService: IAccountService                             │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  + getBalance(userId): Promise<BalanceResponse>                │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │         MonthlySummary (Entity - Postgres)                     │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  PK  id: UUID                                                  │    │
│  │      userId: string                                            │    │
│  │      year: number                                              │    │
│  │      month: number                                             │    │
│  │      totalIncome: number                                       │    │
│  │      totalExpense: number                                      │    │
│  │      categoryBreakdown: object  // JSONB                       │    │
│  │      UNIQUE(userId, year, month)                               │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │            DailyStats (Entity - Postgres)                      │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  PK  id: UUID                                                  │    │
│  │      userId: string                                            │    │
│  │      year: number                                              │    │
│  │      month: number                                             │    │
│  │      day: number                                               │    │
│  │      cumulativeExpense: number                                 │    │
│  │      UNIQUE(userId, year, month, day)                          │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sơ đồ tuần tự (Sequence Diagrams)

### 1. Create Transaction Flow (với gRPC)

```
┌────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌────────┐  ┌────────┐
│ Client │  │   Kong   │  │Transaction  │  │  Report  │  │Postgres│  │ Redis  │
│        │  │ Gateway  │  │  Service    │  │  Service │  │  (TX)  │  │        │
└───┬────┘  └────┬─────┘  └──────┬──────┘  └─────┬────┘  └───┬────┘  └───┬────┘
    │            │                │                │           │           │
    │ POST /transactions          │                │           │           │
    │ { amount, category }        │                │           │           │
    ├───────────>│                │                │           │           │
    │            │                │                │           │           │
    │            │ Verify JWT     │                │           │           │
    │            ├────────┐       │                │           │           │
    │            │        │       │                │           │           │
    │            │<───────┘       │                │           │           │
    │            │                │                │           │           │
    │            │ create(dto)    │                │           │           │
    │            ├───────────────>│                │           │           │
    │            │                │                │           │           │
    │            │                │ INSERT transaction         │           │
    │            │                ├───────────────────────────>│           │
    │            │                │                │           │           │
    │            │                │ UPDATE accounts.balance    │           │
    │            │                │ (balance += amount)        │           │
    │            │                ├───────────────────────────>│           │
    │            │                │                │           │           │
    │            │                │ Saved          │           │           │
    │            │                │<───────────────────────────┤           │
    │            │                │                │           │           │
    │            │       ┌────────────────────────────────────────────┐   │
    │            │       │ NEW: Call Report Service via gRPC          │   │
    │            │       │ Instead of RabbitMQ event                  │   │
    │            │       └────────────────────────────────────────────┘   │
    │            │                │                │           │           │
    │            │                │ gRPC: UpdateTransaction(event)         │
    │            │                │ reportGrpcClient.updateTransaction()   │
    │            │                ├───────────────>│           │           │
    │            │                │                │           │           │
    │            │                │                │ UPSERT    │           │
    │            │                │                │ monthly_  │           │
    │            │                │                │ summaries │           │
    │            │                │                ├──────────>│           │
    │            │                │                │           │           │
    │            │                │                │ UPSERT    │           │
    │            │                │                │ daily_    │           │
    │            │                │                │ stats     │           │
    │            │                │                ├──────────>│           │
    │            │                │                │           │           │
    │            │                │                │ DEL cache │           │
    │            │                │                │ key for   │           │
    │            │                │                │ this month│           │
    │            │                │                ├──────────────────────>│
    │            │                │                │           │           │
    │            │                │ Response       │           │           │
    │            │                │ {success: true}│           │           │
    │            │                │<───────────────┤           │           │
    │            │                │                │           │           │
    │            │ 201 Created    │                │           │           │
    │            │ {transaction}  │                │           │           │
    │            │<───────────────┤                │           │           │
    │            │                │                │           │           │
    │ 201        │                │                │           │           │
    │<───────────┤                │                │           │           │
    │            │                │                │           │           │
```

### 2. Get Monthly Summary Flow (với cache)

```
┌────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌────────┐
│ Client │  │   Kong   │  │ Report  │  │  Redis   │  │ Transaction │  │Postgres│
│        │  │ Gateway  │  │ Service │  │  Cache   │  │   Service   │  │ (Rpt)  │
└───┬────┘  └────┬─────┘  └────┬────┘  └─────┬────┘  └──────┬──────┘  └───┬────┘
    │            │              │             │               │             │
    │ GET /transactions/summary?monthYear=12/2024            │             │
    ├───────────>│              │             │               │             │
    │            │              │             │               │             │
    │            │ getMonthlySummary(userId, monthYear)      │             │
    │            ├─────────────>│             │               │             │
    │            │              │             │               │             │
    │            │              │ GET cache   │               │             │
    │            │              │ key         │               │             │
    │            │              ├────────────>│               │             │
    │            │              │             │               │             │
    │            │              │ Cache MISS  │               │             │
    │            │              │<────────────┤               │             │
    │            │              │             │               │             │
    │            │       ┌──────────────────────┐            │             │
    │            │       │ Query from Postgres  │            │             │
    │            │       │ (source of truth)    │            │             │
    │            │       └──────────────────────┘            │             │
    │            │              │             │               │             │
    │            │              │ SELECT * FROM monthly_summaries           │
    │            │              │ WHERE userId=? AND year=? AND month=?     │
    │            │              ├──────────────────────────────────────────>│
    │            │              │             │               │             │
    │            │              │ {totalIncome, totalExpense, breakdown}    │
    │            │              │<──────────────────────────────────────────┤
    │            │              │             │               │             │
    │            │       ┌──────────────────────────────────────────┐      │
    │            │       │ Get balance via gRPC from TX Service     │      │
    │            │       └──────────────────────────────────────────┘      │
    │            │              │             │               │             │
    │            │              │ gRPC: GetBalance(userId)   │             │
    │            │              │ accountGrpcClient          │             │
    │            │              ├───────────────────────────>│             │
    │            │              │             │               │             │
    │            │              │             │               │ SELECT balance
    │            │              │             │               │ FROM accounts
    │            │              │             │               ├────────────>│
    │            │              │             │               │             │
    │            │              │             │               │ {balance}   │
    │            │              │             │               │<────────────┤
    │            │              │             │               │             │
    │            │              │ {balance: 2500000, currency: "VND"}       │
    │            │              │<───────────────────────────┤             │
    │            │              │             │               │             │
    │            │       ┌──────────────────────┐            │             │
    │            │       │ Combine DB + balance│            │             │
    │            │       │ Cache for 1 hour    │            │             │
    │            │       └──────────────────────┘            │             │
    │            │              │             │               │             │
    │            │              │ SETEX key   │               │             │
    │            │              │ 3600 data   │               │             │
    │            │              ├────────────>│               │             │
    │            │              │             │               │             │
    │            │ {summary}    │             │               │             │
    │            │<─────────────┤             │               │             │
    │            │              │             │               │             │
    │ 200 OK     │              │             │               │             │
    │ {summary}  │              │             │               │             │
    │<───────────┤              │             │               │             │
    │            │              │             │               │             │
```

---

## TypeScript Implementation

### 1. Protocol Buffer Definition

**File:** `libs/common/src/proto/transaction.proto`

```protobuf
syntax = "proto3";

package transaction;

// ============= Account Service (Transaction is SERVER) =============
service AccountService {
  rpc GetBalance (GetBalanceRequest) returns (BalanceResponse);
}

message GetBalanceRequest {
  string userId = 1;
}

message BalanceResponse {
  double balance = 1;
  string currency = 2;
}

// ============= Report Aggregation Service (Report is SERVER) =============
service ReportAggregationService {
  rpc UpdateTransaction (TransactionEvent) returns (Response);
  rpc DeleteTransaction (TransactionEvent) returns (Response);
}

message TransactionEvent {
  string userId = 1;
  string transactionId = 2;
  TransactionData before = 3;  // For update/delete
  TransactionData after = 4;   // For create/update
}

message TransactionData {
  double amount = 1;
  string category = 2;
  string dateTime = 3;  // ISO 8601 format
}

message Response {
  bool success = 1;
  string message = 2;
}
```

### 2. Transaction Service - gRPC Client to Report Service

**File:** `apps/transaction-service/src/report-grpc.client.ts`

```typescript
import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

interface TransactionEvent {
  userId: string;
  transactionId: string;
  before?: {
    amount: number;
    category: string;
    dateTime: string;
  };
  after?: {
    amount: number;
    category: string;
    dateTime: string;
  };
}

interface Response {
  success: boolean;
  message: string;
}

interface IReportAggregationService {
  updateTransaction(event: TransactionEvent): Observable<Response>;
  deleteTransaction(event: TransactionEvent): Observable<Response>;
}

@Injectable()
export class ReportGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(ReportGrpcClient.name);
  private reportService: IReportAggregationService;

  constructor(
    @Inject('REPORT_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.reportService = this.client.getService<IReportAggregationService>(
      'ReportAggregationService'
    );
  }

  async updateTransaction(event: TransactionEvent): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.reportService.updateTransaction(event).pipe(timeout(5000))
      );

      if (!result.success) {
        this.logger.error(`Report update failed: ${result.message}`);
      }
    } catch (error) {
      this.logger.error('gRPC UpdateTransaction failed', error);
      // Don't throw - transaction already saved, report can be rebuilt later
    }
  }

  async deleteTransaction(event: TransactionEvent): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.reportService.deleteTransaction(event).pipe(timeout(5000))
      );

      if (!result.success) {
        this.logger.error(`Report delete failed: ${result.message}`);
      }
    } catch (error) {
      this.logger.error('gRPC DeleteTransaction failed', error);
    }
  }
}
```

**File:** `apps/transaction-service/src/transaction-service.service.ts` (Updated)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { ReportGrpcClient } from './report-grpc.client';

@Injectable()
export class TransactionServiceService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly reportGrpcClient: ReportGrpcClient,  // NEW
  ) {}

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    // 1. Save to database
    const transaction = this.transactionRepo.create({
      userId,
      amount: dto.amount,
      category: dto.category,
      dateTime: dto.dateTime,
      description: dto.description,
    });

    const saved = await this.transactionRepo.save(transaction);

    // 2. Update account balance (in same service)
    await this.updateAccountBalance(userId, dto.amount, dto.category);

    // 3. Notify Report Service via gRPC (fire-and-forget)
    this.reportGrpcClient.updateTransaction({
      userId,
      transactionId: saved.id,
      after: {
        amount: saved.amount,
        category: saved.category,
        dateTime: saved.dateTime.toISOString(),
      },
    }).catch(err => {
      this.logger.error('Failed to notify report service', err);
      // Don't fail the transaction - report can be rebuilt
    });

    return saved;
  }

  async updateTransaction(id: string, userId: string, dto: UpdateTransactionDto) {
    const existing = await this.transactionRepo.findOne({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Transaction not found');

    const before = {
      amount: existing.amount,
      category: existing.category,
      dateTime: existing.dateTime.toISOString(),
    };

    // Update
    Object.assign(existing, dto);
    const updated = await this.transactionRepo.save(existing);

    // Notify Report Service
    this.reportGrpcClient.updateTransaction({
      userId,
      transactionId: id,
      before,
      after: {
        amount: updated.amount,
        category: updated.category,
        dateTime: updated.dateTime.toISOString(),
      },
    }).catch(err => this.logger.error('Report notification failed', err));

    return updated;
  }

  async deleteTransaction(id: string, userId: string) {
    const existing = await this.transactionRepo.findOne({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Transaction not found');

    await this.transactionRepo.remove(existing);

    // Notify Report Service
    this.reportGrpcClient.deleteTransaction({
      userId,
      transactionId: id,
      before: {
        amount: existing.amount,
        category: existing.category,
        dateTime: existing.dateTime.toISOString(),
      },
    }).catch(err => this.logger.error('Report notification failed', err));
  }
}
```

**Module Configuration:**

```typescript
// apps/transaction-service/src/transaction-service.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'REPORT_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'transaction',
          protoPath: join(__dirname, '../../../libs/common/src/proto/transaction.proto'),
          url: process.env.REPORT_GRPC_URL || 'report-service:50052',
        },
      },
    ]),
  ],
  providers: [TransactionServiceService, ReportGrpcClient],
})
export class TransactionServiceModule {}
```

### 3. Report Service - gRPC Server + Postgres

**File:** `apps/report-service/src/entities/monthly-summary.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from 'typeorm';

@Entity('monthly_summaries')
@Unique(['userId', 'year', 'month'])
@Index(['userId', 'year', 'month'])
export class MonthlySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('int')
  year: number;

  @Column('int')
  month: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  totalIncome: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  totalExpense: number;

  @Column({ default: 'VND' })
  currency: string;

  @Column('jsonb', { default: {} })
  categoryBreakdown: Record<string, number>;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
```

**File:** `apps/report-service/src/report-aggregation-grpc.controller.ts`

```typescript
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ReportServiceService } from './report-service.service';

interface TransactionEvent {
  userId: string;
  transactionId: string;
  before?: {
    amount: number;
    category: string;
    dateTime: string;
  };
  after?: {
    amount: number;
    category: string;
    dateTime: string;
  };
}

interface Response {
  success: boolean;
  message: string;
}

@Controller()
export class ReportAggregationGrpcController {
  private readonly logger = new Logger(ReportAggregationGrpcController.name);

  constructor(private readonly reportService: ReportServiceService) {}

  @GrpcMethod('ReportAggregationService', 'UpdateTransaction')
  async updateTransaction(event: TransactionEvent): Promise<Response> {
    try {
      await this.reportService.handleTransactionUpdate(event);
      return { success: true, message: 'Aggregation updated' };
    } catch (error) {
      this.logger.error('Update failed', error);
      return { success: false, message: error.message };
    }
  }

  @GrpcMethod('ReportAggregationService', 'DeleteTransaction')
  async deleteTransaction(event: TransactionEvent): Promise<Response> {
    try {
      await this.reportService.handleTransactionDelete(event);
      return { success: true, message: 'Aggregation updated' };
    } catch (error) {
      this.logger.error('Delete failed', error);
      return { success: false, message: error.message };
    }
  }
}
```

**File:** `apps/report-service/src/report-service.service.ts` (Updated)

```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '@app/redis-common';
import Redis from 'ioredis';
import { MonthlySummary } from './entities/monthly-summary.entity';
import { AccountGrpcClient } from './account-grpc.client';

@Injectable()
export class ReportServiceService {
  private readonly logger = new Logger(ReportServiceService.name);

  constructor(
    @InjectRepository(MonthlySummary)
    private readonly summaryRepo: Repository<MonthlySummary>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly accountGrpcClient: AccountGrpcClient,
  ) {}

  async handleTransactionUpdate(event: any) {
    const { userId, before, after } = event;

    // 1. Rollback old (if exists)
    if (before) {
      await this.applyDelta(userId, before, -1);
    }

    // 2. Apply new
    if (after) {
      await this.applyDelta(userId, after, 1);
    }

    // 3. Invalidate cache
    const date = new Date(after?.dateTime || before.dateTime);
    const cacheKey = `summary:${userId}:${date.getFullYear()}-${date.getMonth() + 1}`;
    await this.redis.del(cacheKey);
  }

  async handleTransactionDelete(event: any) {
    const { userId, before } = event;
    if (!before) return;

    await this.applyDelta(userId, before, -1);

    const date = new Date(before.dateTime);
    const cacheKey = `summary:${userId}:${date.getFullYear()}-${date.getMonth() + 1}`;
    await this.redis.del(cacheKey);
  }

  private async applyDelta(
    userId: string,
    data: { amount: number; category: string; dateTime: string },
    factor: 1 | -1,
  ) {
    const date = new Date(data.dateTime);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const isIncome = data.category.toLowerCase() === 'income';

    // Upsert monthly summary
    const existing = await this.summaryRepo.findOne({
      where: { userId, year, month },
    });

    if (existing) {
      // Update existing
      if (isIncome) {
        existing.totalIncome += factor * data.amount;
      } else {
        existing.totalExpense += factor * data.amount;
        existing.categoryBreakdown[data.category] =
          (existing.categoryBreakdown[data.category] || 0) + factor * data.amount;
      }
      existing.updatedAt = new Date();
      await this.summaryRepo.save(existing);
    } else {
      // Create new
      const summary = this.summaryRepo.create({
        userId,
        year,
        month,
        totalIncome: isIncome ? data.amount : 0,
        totalExpense: isIncome ? 0 : data.amount,
        categoryBreakdown: isIncome ? {} : { [data.category]: data.amount },
      });
      await this.summaryRepo.save(summary);
    }
  }

  async getMonthlySummary(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);
    const cacheKey = `summary:${userId}:${year}-${month}`;

    // 1. Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Query from Postgres
    const summary = await this.summaryRepo.findOne({
      where: { userId, year, month },
    });

    const data = summary
      ? { ...summary.categoryBreakdown, income: summary.totalIncome }
      : {};

    // 3. Get balance via gRPC
    let balance = 0;
    try {
      const balanceResp = await this.accountGrpcClient.getBalance(userId);
      balance = balanceResp.balance;
    } catch (error) {
      this.logger.error('Failed to get balance', error);
    }

    // 4. Build response
    const result = {
      month: `${month.toString().padStart(2, '0')}/${year}`,
      currency: summary?.currency || 'VND',
      data,
      totals: {
        expense: summary?.totalExpense || 0,
        income: summary?.totalIncome || 0,
        balance,
      },
    };

    // 5. Cache for 1 hour
    await this.redis.setex(cacheKey, 3600, JSON.stringify(result));

    return result;
  }
}
```

---

## Environment Variables

```env
# Transaction Service
REPORT_GRPC_URL=report-service:50052

# Report Service
TRANSACTION_GRPC_URL=transaction-service:50051
REDIS_URL=redis://redis:6379
```

---

## Docker Compose

```yaml
services:
  transaction-service:
    ports:
      - "3001:3001"  # HTTP
      - "50051:50051" # gRPC (Account Balance)
    environment:
      - REPORT_GRPC_URL=report-service:50052

  report-service:
    ports:
      - "3002:3002"  # HTTP
      - "50052:50052" # gRPC (Aggregation Updates)
    environment:
      - TRANSACTION_GRPC_URL=transaction-service:50051
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
```

---

## Summary

### ✅ Design Principles

1. **Postgres is source of truth**: Both services có database riêng
2. **Redis is cache only**: Chỉ cache kết quả query, TTL 1 hour
3. **gRPC bidirectional**:
   - Transaction → Report: Notify changes
   - Report → Transaction: Get balance
4. **Eventual consistency**: Report có thể lag vài milliseconds, acceptable
5. **Fault tolerance**: gRPC fail không làm crash transaction

### 🎯 Benefits

- ✅ Data persistence: Redis crash không mất data
- ✅ Rebuild capability: Có thể rebuild report từ transactions
- ✅ Performance: Cache giảm load
- ✅ Service boundaries: Mỗi service có DB riêng
- ✅ Type safety: Protocol Buffers

Đây là architecture production-ready!

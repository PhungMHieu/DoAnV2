# Report Service - Sơ đồ lớp

## Tổng quan

Report Service sử dụng **Redis** để lưu trữ dữ liệu báo cáo thay vì database truyền thống. Dữ liệu được tổng hợp từ các event của Transaction Service qua RabbitMQ.

## Sơ đồ lớp (Class Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REPORT SERVICE                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│   ReportServiceController           │
├─────────────────────────────────────┤
│ - reportService: ReportServiceService│
├─────────────────────────────────────┤
│ + getUserId(req): string            │
│ + getSummary(req, monthYear): Promise│
│ + getLine(req, monthYear): Promise   │
│ + getPie(req, monthYear): Promise    │
└─────────────────────────────────────┘
              │
              │ uses
              ▼
┌─────────────────────────────────────┐
│   ReportEventController             │
├─────────────────────────────────────┤
│ - logger: Logger                    │
│ - reportService: ReportServiceService│
├─────────────────────────────────────┤
│ @EventPattern('transaction.created')│
│ + handleTransactionCreated(payload) │
│ @EventPattern('transaction.updated')│
│ + handleTransactionUpdated(payload) │
│ @EventPattern('transaction.deleted')│
│ + handleTransactionDeleted(payload) │
└─────────────────────────────────────┘
              │
              │ uses
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ReportServiceService                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ - logger: Logger                                                            │
│ - redis: Redis                                                              │
│ - configService: ConfigService                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ - detectType(category): TransactionType                                     │
│ - parseMonthYear(monthYear): { month, year }                                │
│ - getPrevMonth(month, year): { month, year }                                │
│ - getSummaryKey(userId, year, month): string                                │
│ - getDailyKey(userId, year, month): string                                  │
│ - applyTransactionDelta(userId, dateTime, amount, category, factor): Promise│
│ - buildCumulativeSeries(userId, month, year): Promise<DailyTotal[]>         │
├─────────────────────────────────────────────────────────────────────────────┤
│ + handleCreated(payload: TransactionEvent): Promise<void>                   │
│ + handleUpdated(payload: TransactionUpdatedEvent): Promise<void>            │
│ + handleDeleted(payload: TransactionEvent): Promise<void>                   │
│ + getMonthlySummary(userId, monthYear): Promise<MonthlySummary>             │
│ + getLineStats(userId, monthYear): Promise<LineStats>                       │
│ + getPieStats(userId, monthYear): Promise<PieStats>                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Các Interface / Type (DTO)

```
┌─────────────────────────────────────┐
│      TransactionType                │
├─────────────────────────────────────┤
│ 'INCOME' | 'EXPENSE'                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    TransactionDataDto               │
├─────────────────────────────────────┤
│ + amount: number                    │
│ + category: string                  │
│ + dateTime: string                  │
└─────────────────────────────────────┘
              │
              │ used by
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TransactionEventDto                                   │
│                          (Unified Event DTO)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ + userId: string                                                            │
│ + transactionId: string                                                     │
│ + before?: TransactionDataDto       // Có khi Updated/Deleted               │
│ + after?: TransactionDataDto        // Có khi Created/Updated               │
└─────────────────────────────────────────────────────────────────────────────┘

Cách sử dụng TransactionEventDto:
- Created event: chỉ có after
- Deleted event: chỉ có before
- Updated event: có cả before và after

┌─────────────────────────────────────┐
│         DailyTotal                  │
├─────────────────────────────────────┤
│ + day: number                       │
│ + total: number                     │
└─────────────────────────────────────┘
```

## Response Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MonthlySummary                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ + month: string                     // "MM/YYYY"                            │
│ + currency: string                  // "VND"                                │
│ + data: Record<string, number>      // { food: 150000, transport: 80000 }   │
│ + totals: {                                                                 │
│     expense: number,                                                        │
│     income: number                                                          │
│   }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              LineStats                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ + currentMonth: DailyTotal[]        // [{ day: 1, total: 50000 }, ...]      │
│ + previousMonth: DailyTotal[]       // [{ day: 1, total: 40000 }, ...]      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              PieStats                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ + month: string                     // "MM/YYYY"                            │
│ + currency: string                  // "VND"                                │
│ + data: Record<string, number>      // { food: 150000, transport: 80000 }   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cấu trúc dữ liệu Redis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REDIS DATA STRUCTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ KEY: user:{userId}:month:{YYYY-MM}:summary                                  │
│ TYPE: Hash                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬────────────────────────────────────────────┐       │
│ │ Field               │ Value                                      │       │
│ ├─────────────────────┼────────────────────────────────────────────┤       │
│ │ currency            │ "VND"                                      │       │
│ │ income:total        │ 5000000                                    │       │
│ │ expense:total       │ 2500000                                    │       │
│ │ category:food       │ 500000                                     │       │
│ │ category:transport  │ 300000                                     │       │
│ │ category:entertainment │ 200000                                  │       │
│ │ category:utilities  │ 150000                                     │       │
│ │ ...                 │ ...                                        │       │
│ └─────────────────────┴────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ KEY: user:{userId}:month:{YYYY-MM}:daily                                    │
│ TYPE: Hash                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬────────────────────────────────────────────┐       │
│ │ Field               │ Value                                      │       │
│ ├─────────────────────┼────────────────────────────────────────────┤       │
│ │ day:1               │ 50000                                      │       │
│ │ day:2               │ 0                                          │       │
│ │ day:3               │ 120000                                     │       │
│ │ day:4               │ 30000                                      │       │
│ │ ...                 │ ...                                        │       │
│ │ day:31              │ 80000                                      │       │
│ └─────────────────────┴────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Luồng dữ liệu (Data Flow)

```
┌────────────────────┐     Event      ┌────────────────────┐
│ Transaction        │  ─────────────▶│ RabbitMQ           │
│ Service            │  transaction.* │ (report_queue)     │
└────────────────────┘                └─────────┬──────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          REPORT SERVICE                                   │
│  ┌────────────────────────┐      ┌────────────────────────┐              │
│  │ ReportEventController  │      │ ReportServiceController │◄── HTTP API │
│  │ (Event Consumer)       │      │ (REST API)             │              │
│  └───────────┬────────────┘      └───────────┬────────────┘              │
│              │                               │                           │
│              ▼                               ▼                           │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │                  ReportServiceService                      │          │
│  │   ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ │          │
│  │   │handleCreated()│  │getMonthlySummary│ │getLineStats()│ │          │
│  │   │handleUpdated()│  │getPieStats()   │ │              │ │          │
│  │   │handleDeleted()│  │                │ │              │ │          │
│  │   └───────┬───────┘  └───────┬────────┘ └──────┬───────┘ │          │
│  │           │                  │                  │         │          │
│  │           ▼                  ▼                  ▼         │          │
│  │  ┌────────────────────────────────────────────────────┐  │          │
│  │  │              applyTransactionDelta()                │  │          │
│  │  │              buildCumulativeSeries()                │  │          │
│  │  └───────────────────────┬────────────────────────────┘  │          │
│  └──────────────────────────┼───────────────────────────────┘          │
│                             │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │     REDIS       │
                    │ (Hash Storage)  │
                    └─────────────────┘
```

## API Endpoints

| Method | Endpoint               | Description                           |
|--------|------------------------|---------------------------------------|
| GET    | `/transactions/summary`| Lấy tổng hợp thu chi theo tháng       |
| GET    | `/stats/line`          | Dữ liệu biểu đồ đường (so sánh tháng) |
| GET    | `/stats/pie`           | Dữ liệu biểu đồ tròn (chi tiêu)       |

## Event Patterns (RabbitMQ)

| Event Pattern         | Description                        |
|----------------------|-------------------------------------|
| `transaction.created` | Khi tạo giao dịch mới              |
| `transaction.updated` | Khi cập nhật giao dịch             |
| `transaction.deleted` | Khi xóa giao dịch                  |

---

## Sơ đồ tuần tự (Sequence Diagrams)

### 1. Luồng tạo giao dịch mới (Transaction Created)

```
┌──────────────┐        ┌──────────────┐        ┌─────────────────┐        ┌───────┐
│ Transaction  │        │   RabbitMQ   │        │ ReportEvent     │        │ Redis │
│   Service    │        │              │        │   Controller    │        │       │
└──────┬───────┘        └──────┬───────┘        └────────┬────────┘        └───┬───┘
       │                       │                         │                     │
       │ Emit Event            │                         │                     │
       │ transaction.created   │                         │                     │
       ├──────────────────────>│                         │                     │
       │                       │                         │                     │
       │                       │ Consume Event           │                     │
       │                       ├────────────────────────>│                     │
       │                       │                         │                     │
       │                       │  handleTransactionCreated(payload)             │
       │                       │                         │                     │
       │                       │                         │ reportService.      │
       │                       │                         │ handleCreated()     │
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │                   applyTransactionDelta()     │
       │                       │                         │ (factor = +1)       │
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │                         │ detectType()        │
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │                         │ getSummaryKey()     │
       │                       │                         │ getDailyKey()       │
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │                    HSETNX currency             │
       │                       │                         ├────────────────────>│
       │                       │                         │                     │
       │                       │                    HINCRBYFLOAT               │
       │                       │                         │  income:total hoặc  │
       │                       │                         │  expense:total      │
       │                       │                         ├────────────────────>│
       │                       │                         │                     │
       │                       │                    HINCRBYFLOAT               │
       │                       │                         │  category:{name}    │
       │                       │                         ├────────────────────>│
       │                       │                         │                     │
       │                       │                    HINCRBYFLOAT               │
       │                       │                         │  day:{number}       │
       │                       │                         ├────────────────────>│
       │                       │                         │                     │
       │                       │                    OK   │                     │
       │                       │                         │<────────────────────┤
       │                       │                         │                     │
       │                       │  Return                 │                     │
       │                       │<────────────────────────┤                     │
       │                       │                         │                     │
```

### 2. Luồng cập nhật giao dịch (Transaction Updated)

```
┌──────────────┐        ┌──────────────┐        ┌─────────────────┐        ┌───────┐
│ Transaction  │        │   RabbitMQ   │        │ ReportEvent     │        │ Redis │
│   Service    │        │              │        │   Controller    │        │       │
└──────┬───────┘        └──────┬───────┘        └────────┬────────┘        └───┬───┘
       │                       │                         │                     │
       │ Emit Event            │                         │                     │
       │ transaction.updated   │                         │                     │
       ├──────────────────────>│                         │                     │
       │                       │                         │                     │
       │                       │ Consume Event           │                     │
       │                       ├────────────────────────>│                     │
       │                       │                         │                     │
       │                       │  handleTransactionUpdated(payload)             │
       │                       │                         │                     │
       │                       │                         │ reportService.      │
       │                       │                         │ handleUpdated()     │
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │          ┌──────────────────────────────────┐ │
       │                       │          │ 1. Rollback giao dịch CŨ        │ │
       │                       │          │    applyTransactionDelta()       │ │
       │                       │          │    (before, factor = -1)         │ │
       │                       │          └──────────────────────────────────┘ │
       │                       │                         │                     │
       │                       │                         │ HINCRBYFLOAT (-)    │
       │                       │                         ├────────────────────>│
       │                       │                         │<────────────────────┤
       │                       │                         │                     │
       │                       │          ┌──────────────────────────────────┐ │
       │                       │          │ 2. Apply giao dịch MỚI           │ │
       │                       │          │    applyTransactionDelta()       │ │
       │                       │          │    (after, factor = +1)          │ │
       │                       │          └──────────────────────────────────┘ │
       │                       │                         │                     │
       │                       │                         │ HINCRBYFLOAT (+)    │
       │                       │                         ├────────────────────>│
       │                       │                         │<────────────────────┤
       │                       │                         │                     │
       │                       │  Return                 │                     │
       │                       │<────────────────────────┤                     │
       │                       │                         │                     │
```

### 3. Luồng xóa giao dịch (Transaction Deleted)

```
┌──────────────┐        ┌──────────────┐        ┌─────────────────┐        ┌───────┐
│ Transaction  │        │   RabbitMQ   │        │ ReportEvent     │        │ Redis │
│   Service    │        │              │        │   Controller    │        │       │
└──────┬───────┘        └──────┬───────┘        └────────┬────────┘        └───┬───┘
       │                       │                         │                     │
       │ Emit Event            │                         │                     │
       │ transaction.deleted   │                         │                     │
       ├──────────────────────>│                         │                     │
       │                       │                         │                     │
       │                       │ Consume Event           │                     │
       │                       ├────────────────────────>│                     │
       │                       │                         │                     │
       │                       │  handleTransactionDeleted(payload)             │
       │                       │                         │                     │
       │                       │                         │ reportService.      │
       │                       │                         │ handleDeleted()     │
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │                   applyTransactionDelta()     │
       │                       │                         │ (before, factor = -1)
       │                       │                         ├─────────┐           │
       │                       │                         │         │           │
       │                       │                         │<────────┘           │
       │                       │                         │                     │
       │                       │                         │ HINCRBYFLOAT (-)    │
       │                       │                         │  Rollback data      │
       │                       │                         ├────────────────────>│
       │                       │                         │                     │
       │                       │                    OK   │                     │
       │                       │                         │<────────────────────┤
       │                       │                         │                     │
       │                       │  Return                 │                     │
       │                       │<────────────────────────┤                     │
       │                       │                         │                     │
```

### 4. Luồng lấy tổng hợp báo cáo (GET /transactions/summary)

```
┌────────┐          ┌─────────────────┐          ┌─────────────────┐          ┌───────┐
│ Client │          │ ReportService   │          │ ReportService   │          │ Redis │
│        │          │   Controller    │          │    Service      │          │       │
└───┬────┘          └────────┬────────┘          └────────┬────────┘          └───┬───┘
    │                        │                            │                       │
    │ GET /transactions/     │                            │                       │
    │ summary?monthYear=     │                            │                       │
    │ 12/2024                │                            │                       │
    ├───────────────────────>│                            │                       │
    │                        │                            │                       │
    │                        │ getUserId(req)             │                       │
    │                        ├────────────┐               │                       │
    │                        │            │               │                       │
    │                        │<───────────┘               │                       │
    │                        │                            │                       │
    │                        │ getMonthlySummary()        │                       │
    │                        ├───────────────────────────>│                       │
    │                        │                            │                       │
    │                        │                            │ parseMonthYear()      │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │                            │ getSummaryKey()       │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │                            │ HGETALL               │
    │                        │                            │ user:{id}:month:      │
    │                        │                            │ {YYYY-MM}:summary     │
    │                        │                            ├──────────────────────>│
    │                        │                            │                       │
    │                        │                            │ Hash data             │
    │                        │                            │<──────────────────────┤
    │                        │                            │                       │
    │                        │                            │ Parse & Build         │
    │                        │                            │ Response              │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │ MonthlySummary             │                       │
    │                        │<───────────────────────────┤                       │
    │                        │                            │                       │
    │ Response:              │                            │                       │
    │ {                      │                            │                       │
    │   month: "12/2024",    │                            │                       │
    │   currency: "VND",     │                            │                       │
    │   data: {...},         │                            │                       │
    │   totals: {...}        │                            │                       │
    │ }                      │                            │                       │
    │<───────────────────────┤                            │                       │
    │                        │                            │                       │
```

### 5. Luồng lấy dữ liệu biểu đồ đường (GET /stats/line)

```
┌────────┐          ┌─────────────────┐          ┌─────────────────┐          ┌───────┐
│ Client │          │ ReportService   │          │ ReportService   │          │ Redis │
│        │          │   Controller    │          │    Service      │          │       │
└───┬────┘          └────────┬────────┘          └────────┬────────┘          └───┬───┘
    │                        │                            │                       │
    │ GET /stats/line?       │                            │                       │
    │ monthYear=12/2024      │                            │                       │
    ├───────────────────────>│                            │                       │
    │                        │                            │                       │
    │                        │ getUserId(req)             │                       │
    │                        ├────────────┐               │                       │
    │                        │            │               │                       │
    │                        │<───────────┘               │                       │
    │                        │                            │                       │
    │                        │ getLineStats()             │                       │
    │                        ├───────────────────────────>│                       │
    │                        │                            │                       │
    │                        │                            │ parseMonthYear()      │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │          ┌────────────────────────────────────┐    │
    │                        │          │ Build currentMonth                 │    │
    │                        │          └────────────────────────────────────┘    │
    │                        │                            │                       │
    │                        │                            │ buildCumulativeSeries()
    │                        │                            │ (month, year)         │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │ getDailyKey()         │
    │                        │                            │                       │
    │                        │                            │ HGETALL daily         │
    │                        │                            ├──────────────────────>│
    │                        │                            │                       │
    │                        │                            │ Hash data             │
    │                        │                            │<──────────────────────┤
    │                        │                            │                       │
    │                        │                            │ Calculate cumulative  │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │          ┌────────────────────────────────────┐    │
    │                        │          │ Build previousMonth                │    │
    │                        │          └────────────────────────────────────┘    │
    │                        │                            │                       │
    │                        │                            │ getPrevMonth()        │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │                            │ buildCumulativeSeries()
    │                        │                            │ (prevMonth, prevYear) │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │ HGETALL daily         │
    │                        │                            ├──────────────────────>│
    │                        │                            │                       │
    │                        │                            │ Hash data             │
    │                        │                            │<──────────────────────┤
    │                        │                            │                       │
    │                        │                            │ Calculate cumulative  │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │ LineStats                  │                       │
    │                        │<───────────────────────────┤                       │
    │                        │                            │                       │
    │ Response:              │                            │                       │
    │ {                      │                            │                       │
    │   currentMonth: [...], │                            │                       │
    │   previousMonth: [...]│                            │                       │
    │ }                      │                            │                       │
    │<───────────────────────┤                            │                       │
    │                        │                            │                       │
```

### 6. Luồng lấy dữ liệu biểu đồ tròn (GET /stats/pie)

```
┌────────┐          ┌─────────────────┐          ┌─────────────────┐          ┌───────┐
│ Client │          │ ReportService   │          │ ReportService   │          │ Redis │
│        │          │   Controller    │          │    Service      │          │       │
└───┬────┘          └────────┬────────┘          └────────┬────────┘          └───┬───┘
    │                        │                            │                       │
    │ GET /stats/pie?        │                            │                       │
    │ monthYear=12/2024      │                            │                       │
    ├───────────────────────>│                            │                       │
    │                        │                            │                       │
    │                        │ getUserId(req)             │                       │
    │                        ├────────────┐               │                       │
    │                        │            │               │                       │
    │                        │<───────────┘               │                       │
    │                        │                            │                       │
    │                        │ getPieStats()              │                       │
    │                        ├───────────────────────────>│                       │
    │                        │                            │                       │
    │                        │                            │ parseMonthYear()      │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │                            │ getSummaryKey()       │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │                            │ HGETALL summary       │
    │                        │                            ├──────────────────────>│
    │                        │                            │                       │
    │                        │                            │ Hash data             │
    │                        │                            │<──────────────────────┤
    │                        │                            │                       │
    │                        │                            │ Filter category:*     │
    │                        │                            │ Build Response        │
    │                        │                            ├─────────┐             │
    │                        │                            │         │             │
    │                        │                            │<────────┘             │
    │                        │                            │                       │
    │                        │ PieStats                   │                       │
    │                        │<───────────────────────────┤                       │
    │                        │                            │                       │
    │ Response:              │                            │                       │
    │ {                      │                            │                       │
    │   month: "12/2024",    │                            │                       │
    │   currency: "VND",     │                            │                       │
    │   data: {...}          │                            │                       │
    │ }                      │                            │                       │
    │<───────────────────────┤                            │                       │
    │                        │                            │                       │
```

---

## Ghi chú kỹ thuật

### Xử lý Event với Unified DTO
Report Service sử dụng một DTO thống nhất (`TransactionEventDto`) cho cả 3 loại event:
- **Created**: Chỉ có `after` (dữ liệu giao dịch mới)
- **Updated**: Có cả `before` (dữ liệu cũ) và `after` (dữ liệu mới)
- **Deleted**: Chỉ có `before` (dữ liệu bị xóa)

### Cơ chế cập nhật dữ liệu
- Sử dụng `applyTransactionDelta()` với tham số `factor` (1 hoặc -1) để cộng/trừ số liệu
- Updated event = Rollback (factor=-1) + Apply mới (factor=+1)
- Deleted event = Rollback (factor=-1)

### Redis Operations
- `HSETNX`: Set field nếu chưa tồn tại (dùng cho currency)
- `HINCRBYFLOAT`: Tăng/giảm giá trị số (hỗ trợ số âm)
- `HGETALL`: Lấy toàn bộ hash
- `HGET`: Lấy một field cụ thể

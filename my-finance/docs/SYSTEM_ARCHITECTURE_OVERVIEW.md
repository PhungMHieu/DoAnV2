# My Finance - System Architecture Overview

## Tổng quan hệ thống

My Finance là một hệ thống quản lý tài chính cá nhân được xây dựng theo kiến trúc **Microservices** với NestJS framework. Hệ thống bao gồm 5 microservices chính, API Gateway (Kong), và các infrastructure components (Postgres, Redis, RabbitMQ).

---

## Sơ đồ kiến trúc tổng thể (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│                     (Web App / Mobile App / Postman)                        │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ HTTP/HTTPS
                                   │ Port 8000
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            KONG API GATEWAY                                 │
│                         (Port 8000, 8001, 8002)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Rate Limiting                                                            │
│  • Authentication (JWT Plugin)                                              │
│  • Request/Response Transformation                                          │
│  • Logging & Monitoring                                                     │
│  • Load Balancing                                                           │
│  • Service Discovery                                                        │
└──────┬────────┬─────────┬──────────┬─────────┬────────────────────────┬────┘
       │        │         │          │         │                        │
       │        │         │          │         │                        │
┌──────▼────────▼─────────▼──────────▼─────────▼────────────────────────▼────┐
│                         MICROSERVICES LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │Auth Service  │  │Transaction   │  │Report Service│  │Group Service │   │
│  │Port: 3002    │  │Service       │  │Port: 3003    │  │Port: 3004    │   │
│  ├──────────────┤  │Port: 3001    │  ├──────────────┤  ├──────────────┤   │
│  │• Register    │  ├──────────────┤  │• Monthly     │  │• Create Group│   │
│  │• Login       │  │• CRUD Trans. │  │  Summary     │  │• Join Group  │   │
│  │• JWT Tokens  │  │• Accounts    │  │• Line Stats  │  │• Group Exp.  │   │
│  │• Refresh     │  │• Categories  │  │• Pie Chart   │  │• Split Bills │   │
│  │              │  │• Auto-Categ. │  │• Cache Layer │  │              │   │
│  └──────┬───────┘  │• Group Exp.  │  └──────┬───────┘  └──────┬───────┘   │
│         │          └──────┬───────┘          │                 │           │
│         │                 │                   │                 │           │
│         │                 │                   │                 │           │
└─────────┼─────────────────┼───────────────────┼─────────────────┼───────────┘
          │                 │                   │                 │
          │                 │                   │                 │
┌─────────▼─────────────────▼───────────────────▼─────────────────▼───────────┐
│                      DATA & MESSAGING LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┐  ┌────────────────┐  ┌──────────────────────────┐ │
│  │  PostgreSQL        │  │  Redis         │  │  RabbitMQ                │ │
│  │  Port: 5432        │  │  Port: 6379    │  │  Port: 5672, 15672       │ │
│  ├────────────────────┤  ├────────────────┤  ├──────────────────────────┤ │
│  │ Databases:         │  │• Cache Layer   │  │• Message Queue           │ │
│  │ • myfinance_db     │  │• Session Store │  │• Event-Driven Comm.      │ │
│  │ • kong             │  │• TTL: 1 hour   │  │                          │ │
│  │                    │  │• AOF Enabled   │  │ Queues:                  │ │
│  │ Tables:            │  │                │  │ • report_queue           │ │
│  │ • users            │  └────────────────┘  │                          │ │
│  │ • transactions     │                      │ Events:                  │ │
│  │ • accounts         │                      │ • transaction.created    │ │
│  │ • categories       │                      │ • transaction.updated    │ │
│  │ • groups           │                      │ • transaction.deleted    │ │
│  │ • group_members    │                      └──────────────────────────┘ │
│  │ • group_expenses   │                                                   │
│  │ • group_expense_   │                                                   │
│  │   shares           │                                                   │
│  └────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Chi tiết các Microservices

### 1. Auth Service (Port 3002)

**Chức năng:**
- User registration & authentication
- JWT token generation & validation
- Token refresh mechanism
- Password hashing với bcrypt

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL (users table)
- JWT tokens (access token 7 days)

**Endpoints:**
```
POST   /auth/register          - Đăng ký user mới
POST   /auth/login             - Đăng nhập, trả về JWT
POST   /auth/refresh           - Refresh access token
GET    /auth/profile           - Lấy thông tin user hiện tại
```

**Database Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,  -- bcrypt hashed
  full_name VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

### 2. Transaction Service (Port 3001)

**Chức năng:**
- Quản lý transactions (CRUD)
- Quản lý accounts & balance
- Category management
- Auto-categorization với ML Service
- Group expenses (equal/exact/percent split)
- Emit events qua RabbitMQ

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- RabbitMQ (producer)
- HTTP Client để gọi ML Service

**Endpoints:**
```
# Transactions
POST   /transactions            - Tạo transaction mới
GET    /transactions            - List transactions (paginated)
GET    /transactions/:id        - Chi tiết 1 transaction
PATCH  /transactions/:id        - Update transaction
DELETE /transactions/:id        - Xóa transaction

# Accounts
GET    /account/balance         - Lấy balance hiện tại

# Group Expenses
POST   /groups/:groupId/expenses - Tạo expense trong group
GET    /groups/:groupId/expenses - List expenses của group
```

**Database Schema:**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  category VARCHAR NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  user_id VARCHAR UNIQUE NOT NULL,
  balance NUMERIC(18,2) DEFAULT 0,
  currency VARCHAR DEFAULT 'VND',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE group_expenses (
  id UUID PRIMARY KEY,
  group_id VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  paid_by_member_id VARCHAR NOT NULL,
  created_by_user_id VARCHAR NOT NULL,
  split_type VARCHAR CHECK (split_type IN ('equal','exact','percent')),
  created_at TIMESTAMPTZ
);

CREATE TABLE group_expense_shares (
  id UUID PRIMARY KEY,
  expense_id UUID REFERENCES group_expenses(id) ON DELETE CASCADE,
  member_id VARCHAR NOT NULL,
  amount NUMERIC(18,2) NOT NULL
);
```

**RabbitMQ Events (Producer):**
```typescript
// Emit events khi có thay đổi transaction
{
  pattern: 'transaction.created',
  data: {
    userId: string,
    transactionId: string,
    after: { amount, category, dateTime }
  }
}

{
  pattern: 'transaction.updated',
  data: {
    userId: string,
    transactionId: string,
    before: { amount, category, dateTime },
    after: { amount, category, dateTime }
  }
}

{
  pattern: 'transaction.deleted',
  data: {
    userId: string,
    transactionId: string,
    before: { amount, category, dateTime }
  }
}
```

---

### 3. Report Service (Port 3003)

**Chức năng:**
- Tính toán monthly summary (income, expense, by category)
- Line chart stats (daily cumulative expense)
- Pie chart stats (expense breakdown)
- Cache layer với Redis
- Listen RabbitMQ events từ Transaction Service

**Tech Stack:**
- NestJS
- Redis (cache với TTL 1 hour)
- RabbitMQ (consumer)

**Endpoints:**
```
GET /transactions/summary?monthYear=12/2024  - Monthly summary
GET /stats/line?monthYear=12/2024            - Line chart data
GET /stats/pie?monthYear=12/2024             - Pie chart data
```

**Cache Strategy:**
```typescript
// Redis Keys
summary:${userId}:${year}-${month}:summary   // Monthly aggregation
daily:${userId}:${year}-${month}:daily       // Daily stats

// TTL: 1 hour (hoặc invalidate khi có transaction mới)
```

**RabbitMQ Events (Consumer):**
```typescript
@EventPattern('transaction.created')
async handleTransactionCreated(data: TransactionEventDto) {
  // Update Redis aggregation
  // - Cộng/trừ income/expense
  // - Update category breakdown
  // - Update daily cumulative
}

@EventPattern('transaction.updated')
async handleTransactionUpdated(data: TransactionEventDto) {
  // Rollback old transaction
  // Apply new transaction
}

@EventPattern('transaction.deleted')
async handleTransactionDeleted(data: TransactionEventDto) {
  // Rollback transaction
}
```

**Response Format:**
```typescript
// GET /transactions/summary
{
  month: "12/2024",
  currency: "VND",
  data: {
    food: 150000,
    transport: 80000,
    entertainment: 120000,
    income: 1000000
  },
  totals: {
    expense: 350000,
    income: 1000000,
    balance: 2500000  // From account service
  }
}
```

---

### 4. Group Service (Port 3004)

**Chức năng:**
- Tạo nhóm chi tiêu chung (group)
- Quản lý members trong group
- Join group bằng code
- List groups của user

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL

**Endpoints:**
```
POST   /groups                  - Tạo group mới
GET    /groups/join/:code       - Lấy thông tin group theo code
POST   /groups/join             - Join vào group
GET    /groups/my               - List groups của user hiện tại
```

**Database Schema:**
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  code VARCHAR(6) UNIQUE NOT NULL,  -- Random code: ABC123
  created_by_user_id VARCHAR NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  user_id VARCHAR,  -- NULL nếu chưa join
  joined BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ
);
```

**Workflow:**
1. User A tạo group → Tạo 1 group + N+1 members (owner + invited)
2. User B nhận code → GET /groups/join/:code để xem members
3. User B chọn member slot → POST /groups/join với memberId
4. System link userId vào member → joined = true

---

### 5. Kong Gateway (Port 8000)

**Chức năng:**
- API Gateway cho toàn bộ hệ thống
- Authentication với JWT Plugin
- Rate limiting
- Request/Response logging
- Load balancing
- Service discovery

**Configuration:**
```yaml
Services:
  - auth-service      → http://auth-service:3002
  - transaction       → http://transaction-service:3001
  - report            → http://report-service:3003
  - group             → http://group-service:3004

Routes:
  /auth/*             → auth-service
  /transactions/*     → transaction-service
  /stats/*            → report-service
  /groups/*           → group-service
  /account/*          → transaction-service

Plugins:
  - JWT Authentication (global)
  - Rate Limiting (per consumer)
  - CORS
  - Request/Response Transformer
  - Logging
```

**Ports:**
- **8000**: Proxy (client requests)
- **8001**: Admin API (configuration)
- **8002**: Kong Manager GUI

---

## Communication Patterns

### 1. Synchronous Communication (HTTP/REST)

```
Client → Kong → Service
       ↓
     JWT validation
     Rate limiting
     Routing
```

**Example:**
```
POST http://localhost:8000/transactions
Authorization: Bearer <jwt-token>
{
  "amount": 50000,
  "category": "food",
  "dateTime": "2024-12-21T10:00:00Z"
}

→ Kong validates JWT
→ Routes to transaction-service:3001
→ Transaction Service saves to Postgres
→ Returns 201 Created
```

### 2. Asynchronous Communication (RabbitMQ)

```
Transaction Service (Producer)
    ↓
  RabbitMQ Queue (report_queue)
    ↓
Report Service (Consumer)
```

**Benefits:**
- Decoupling services
- Async processing
- Retry mechanism
- Event-driven architecture

---

## Data Flow Examples

### Example 1: Create Transaction

```
┌────────┐   ┌──────┐   ┌─────────────┐   ┌──────────┐   ┌─────────┐
│ Client │   │ Kong │   │ Transaction │   │Postgres  │   │RabbitMQ │
│        │   │      │   │   Service   │   │          │   │         │
└───┬────┘   └──┬───┘   └──────┬──────┘   └────┬─────┘   └────┬────┘
    │           │               │                │              │
    │ POST /transactions        │                │              │
    ├──────────>│               │                │              │
    │           │ JWT Verify    │                │              │
    │           ├──────┐        │                │              │
    │           │      │        │                │              │
    │           │<─────┘        │                │              │
    │           │               │                │              │
    │           │ Route to TX   │                │              │
    │           ├──────────────>│                │              │
    │           │               │ INSERT         │              │
    │           │               ├───────────────>│              │
    │           │               │                │              │
    │           │               │ Saved          │              │
    │           │               │<───────────────┤              │
    │           │               │                │              │
    │           │               │ Emit Event     │              │
    │           │               │ 'transaction.created'         │
    │           │               ├──────────────────────────────>│
    │           │               │                │              │
    │           │ 201 Created   │                │              │
    │           │<──────────────┤                │              │
    │           │               │                │              │
    │ 201       │               │                │              │
    │<──────────┤               │                │              │
    │           │               │                │              │
```

### Example 2: Get Monthly Summary (with Cache)

```
┌────────┐   ┌──────┐   ┌─────────┐   ┌───────┐
│ Client │   │ Kong │   │ Report  │   │ Redis │
│        │   │      │   │ Service │   │       │
└───┬────┘   └──┬───┘   └────┬────┘   └───┬───┘
    │           │             │            │
    │ GET /transactions/summary?month=12/2024
    ├──────────>│             │            │
    │           │             │            │
    │           │ Route       │            │
    │           ├────────────>│            │
    │           │             │            │
    │           │             │ GET cache  │
    │           │             ├───────────>│
    │           │             │            │
    │           │             │ Cache HIT  │
    │           │             │<───────────┤
    │           │             │            │
    │           │ 200 OK      │            │
    │           │<────────────┤            │
    │           │             │            │
    │ 200 OK    │             │            │
    │<──────────┤             │            │
    │           │             │            │
```

---

## Infrastructure Components

### 1. PostgreSQL (Port 5432)

**Databases:**
- `myfinance_db`: Main application database
- `kong`: Kong Gateway configuration

**Tables:**
```
myfinance_db:
  - users
  - transactions
  - accounts
  - categories
  - groups
  - group_members
  - group_expenses
  - group_expense_shares

kong:
  - services
  - routes
  - consumers
  - plugins
  - jwt_secrets
```

### 2. Redis (Port 6379)

**Usage:**
- Cache layer cho Report Service
- Session storage (optional)
- TTL: 1 hour cho report data

**Configuration:**
- AOF (Append Only File) enabled cho persistence
- Volume mount: `/data`

### 3. RabbitMQ (Port 5672, 15672)

**Queues:**
- `report_queue`: Transaction events → Report Service

**Management UI:**
- http://localhost:15672
- User: myfinance / myfinance_pass

### 4. pgAdmin (Port 5050)

**Database Management UI:**
- http://localhost:5050
- Email: admin@myfinance.com
- Password: admin123

---

## Security

### 1. Authentication & Authorization

**JWT Tokens:**
```typescript
{
  sub: userId,           // User ID
  email: user@email.com,
  iat: 1234567890,      // Issued at
  exp: 1234999999,      // Expires in 7 days
  iss: 'my-finance-app' // Issuer
}
```

**Flow:**
1. Client login → Auth Service generates JWT
2. Client stores token
3. Every request includes: `Authorization: Bearer <token>`
4. Kong validates JWT before routing
5. Services extract userId from `x-user-id` header (set by Kong)

### 2. API Gateway Security (Kong)

**Plugins:**
- **JWT Plugin**: Validate tokens on all routes (except /auth/login, /auth/register)
- **Rate Limiting**: 100 requests/minute per consumer
- **CORS**: Allow specific origins
- **IP Restriction**: (Optional) Whitelist IPs

---

## Deployment Architecture

### Development
```
Docker Compose:
  - All services in single network
  - Exposed ports for debugging
  - Hot reload enabled
  - Logs to stdout
```

### Production (Future)
```
Kubernetes:
  - Each service as Deployment
  - Horizontal Pod Autoscaler
  - Service Mesh (Istio)
  - External Load Balancer
  - Managed Postgres (RDS/Cloud SQL)
  - Managed Redis (ElastiCache/MemoryStore)
  - Managed RabbitMQ (CloudAMQP)
```

---

## Service Dependencies

```
graph TD
    Kong --> AuthService
    Kong --> TransactionService
    Kong --> ReportService
    Kong --> GroupService

    AuthService --> Postgres

    TransactionService --> Postgres
    TransactionService --> RabbitMQ

    ReportService --> Redis
    ReportService --> RabbitMQ

    GroupService --> Postgres

    RabbitMQ -.event.-> ReportService
```

**Startup Order:**
1. Infrastructure: Postgres, Redis, RabbitMQ
2. Services: Auth, Transaction, Report, Group
3. Gateway: Kong

---

## Scalability Considerations

### Horizontal Scaling

**Stateless Services** (can scale easily):
- Auth Service
- Transaction Service
- Report Service
- Group Service

**Scaling Strategy:**
```yaml
# Kubernetes HPA example
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: transaction-service
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: transaction-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Scaling

**Read Replicas:**
- Master-slave replication
- Read queries → Slaves
- Write queries → Master

**Sharding (future):**
- Shard by userId
- Each shard handles subset of users

### Cache Strategy

**Redis Cluster:**
- Master-slave replication
- Sentinel for failover
- Cluster mode for partitioning

---

## Monitoring & Observability

### Metrics (Future)

**Prometheus + Grafana:**
```
Metrics to track:
  - Request rate (req/s)
  - Error rate (%)
  - Response time (p50, p95, p99)
  - Database connection pool
  - Redis hit/miss ratio
  - RabbitMQ queue depth
  - CPU/Memory usage per service
```

### Logging

**Current:**
- Console logs (Docker logs)
- Structured logging với NestJS Logger

**Future:**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Centralized logging
- Log aggregation

### Tracing (Future)

**Distributed Tracing:**
- OpenTelemetry
- Jaeger/Zipkin
- Trace requests across services

---

## API Endpoints Summary

### Auth Service (Port 3002)
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
GET    /auth/profile
```

### Transaction Service (Port 3001)
```
POST   /transactions
GET    /transactions
GET    /transactions/:id
PATCH  /transactions/:id
DELETE /transactions/:id
GET    /account/balance
POST   /groups/:groupId/expenses
GET    /groups/:groupId/expenses
```

### Report Service (Port 3003)
```
GET    /transactions/summary?monthYear=MM/YYYY
GET    /stats/line?monthYear=MM/YYYY
GET    /stats/pie?monthYear=MM/YYYY
```

### Group Service (Port 3004)
```
POST   /groups
GET    /groups/join/:code
POST   /groups/join
GET    /groups/my
```

### Kong Gateway (Port 8000)
```
All above endpoints accessible via:
http://localhost:8000/<endpoint>
```

---

## Technology Stack Summary

| Component | Technology |
|-----------|------------|
| **Backend Framework** | NestJS (Node.js + TypeScript) |
| **API Gateway** | Kong 3.9 |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Message Queue** | RabbitMQ 3.13 |
| **ORM** | TypeORM |
| **Authentication** | JWT (jsonwebtoken) |
| **Validation** | class-validator, class-transformer |
| **Documentation** | Swagger/OpenAPI |
| **Container** | Docker + Docker Compose |
| **Database UI** | pgAdmin 4 |

---

## Environment Variables

```env
# Common
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_ISSUER=my-finance-app

# Database
DATABASE_URL=postgresql://myfinance_user:myfinance_pass@postgres:5432/myfinance_db

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://myfinance:myfinance_pass@rabbitmq:5672
RABBITMQ_QUEUE_PREFIX=myfinance
REPORT_QUEUE=report_queue

# Service URLs
AUTH_SERVICE_URL=http://auth-service:3002
TRANSACTION_SERVICE_URL=http://transaction-service:3001
REPORT_SERVICE_URL=http://report-service:3003
GROUP_SERVICE_URL=http://group-service:3004

# Ports
AUTH_SERVICE_PORT=3002
TRANSACTION_SERVICE_PORT=3001
REPORT_SERVICE_PORT=3003
GROUP_SERVICE_PORT=3004
API_GATEWAY_PORT=3000
```

---

## Development Workflow

### 1. Start All Services
```bash
docker-compose up -d
```

### 2. Access Services
- **API Gateway**: http://localhost:8000
- **Kong Admin**: http://localhost:8001
- **Kong Manager**: http://localhost:8002
- **RabbitMQ Management**: http://localhost:15672
- **pgAdmin**: http://localhost:5050

### 3. Health Checks
```bash
# Check all services
curl http://localhost:8000/health

# Individual services
curl http://localhost:3001/health  # Transaction
curl http://localhost:3002/health  # Auth
curl http://localhost:3003/health  # Report
curl http://localhost:3004/health  # Group
```

### 4. View Logs
```bash
docker-compose logs -f transaction-service
docker-compose logs -f report-service
```

---

## Conclusion

Hệ thống My Finance được thiết kế theo kiến trúc **Microservices** với các nguyên tắc:

✅ **Loose Coupling**: Mỗi service độc lập, có database riêng
✅ **High Cohesion**: Mỗi service tập trung vào 1 domain cụ thể
✅ **Scalability**: Có thể scale từng service độc lập
✅ **Resilience**: Service failure không làm sập toàn hệ thống
✅ **Event-Driven**: Async communication qua RabbitMQ
✅ **API Gateway**: Single entry point với Kong
✅ **Security**: JWT authentication, rate limiting
✅ **Observability**: Structured logging, health checks

Đây là nền tảng vững chắc để mở rộng và phát triển thêm features trong tương lai!

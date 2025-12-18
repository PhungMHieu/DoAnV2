# Kong Gateway Setup Guide

## Tổng quan

Kong Gateway được sử dụng như một API Gateway trung tâm để:
- 🔐 Xác thực JWT token
- 🛣️ Route requests đến đúng microservice
- 🔄 Forward user information từ JWT đến backend services
- 🌐 Xử lý CORS

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Kong Gateway (:8000)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ JWT Plugin  │  │   Router    │  │ Request Transformer     │ │
│  │ (验证token)  │  │ (路由分发)   │  │ (forward user info)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Auth Service  │   │  Transaction  │   │ Group Service │
│    (:3002)    │   │   Service     │   │    (:3004)    │
│   (public)    │   │   (:3001)     │   │  (protected)  │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Cài đặt

### 1. Khởi động containers

```bash
cd /Users/admin/Desktop/DoAn/my-finance
docker compose up -d
```

### 2. Đợi Kong khởi động

```bash
# Check Kong status
docker logs my-finance-kong

# Hoặc check health
curl http://localhost:8001/status
```

### 3. Chạy script cấu hình Kong

```bash
chmod +x scripts/setup-kong.sh
./scripts/setup-kong.sh
```

## Endpoints

| Endpoint | Port | Description |
|----------|------|-------------|
| Kong Proxy | 8000 | API requests đi qua đây |
| Kong Admin | 8001 | Admin API để quản lý Kong |
| Kong Manager | 8002 | Web UI quản lý Kong |

## API Routes

### Public Routes (không cần JWT)

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| POST | `/api/auth/register` | auth-service | Đăng ký user |
| POST | `/api/auth/login` | auth-service | Đăng nhập |

### Protected Routes (cần JWT)

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/transactions` | transaction-service | Lấy transactions |
| POST | `/api/transactions` | transaction-service | Tạo transaction |
| GET | `/api/account/balance` | transaction-service | Lấy số dư |
| GET | `/api/reports/*` | report-service | Báo cáo |
| POST | `/api/groups` | group-service | Tạo group |
| GET | `/api/groups/my` | group-service | Lấy groups của user |

## Cách sử dụng

### 1. Đăng ký user

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "123456"
  }'
```

**Response:**
```json
{
  "message": "Register success",
  "user": {
    "id": "abc-123-...",
    "username": "testuser",
    "email": "test@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2. Đăng nhập

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "123456"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "abc-123-...",
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

### 3. Gọi API được bảo vệ

```bash
# Lưu token vào biến
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Gọi API với token
curl http://localhost:8000/api/transactions \
  -H "Authorization: Bearer $TOKEN"
```

## JWT Token Structure

Token được tạo bởi auth-service có cấu trúc:

```json
{
  "iss": "my-finance-app",    // Issuer - Kong cần để xác thực
  "sub": "user-uuid-here",     // Subject - User ID
  "email": "user@example.com",
  "iat": 1702886400,           // Issued at
  "exp": 1703491200            // Expires (7 days)
}
```

Kong sử dụng `iss` claim để lookup JWT credentials và verify signature.

## Kong Plugins được sử dụng

### 1. JWT Plugin
- Verify JWT token signature
- Check token expiration
- Authenticate requests

### 2. CORS Plugin
- Cho phép cross-origin requests
- Support credentials

## JWT Middleware (Backend Services)

Các backend services (transaction, group, report) sử dụng `JwtExtractMiddleware` để extract user ID từ JWT token:

```typescript
// libs/common/src/middleware/jwt-extract.middleware.ts
@Injectable()
export class JwtExtractMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.decode(token) as { sub?: string };
      if (decoded?.sub) {
        req.headers['x-user-id'] = decoded.sub;
      }
    }
    next();
  }
}
```

**Luồng hoạt động:**
1. Client gửi `Authorization: Bearer <token>` header
2. Kong verify JWT signature và reject nếu invalid
3. Kong forward request đến backend service
4. `JwtExtractMiddleware` decode JWT và set `x-user-id` header
5. Controller sử dụng `@Headers('x-user-id')` để lấy user ID

> **Lưu ý:** Middleware chỉ decode (không verify) vì Kong đã verify trước đó.

## Troubleshooting

### Token không hợp lệ?

```bash
# Check JWT credentials trong Kong
curl http://localhost:8001/consumers/my-finance-app/jwt
```

### Route không hoạt động?

```bash
# List all routes
curl http://localhost:8001/routes

# List all services
curl http://localhost:8001/services
```

### Reset Kong configuration

```bash
# Xóa tất cả config
docker compose down kong kong-database kong-migration
docker volume rm my-finance_kong_data

# Khởi động lại
docker compose up -d
./scripts/setup-kong.sh
```

### Check logs

```bash
# Kong logs
docker logs my-finance-kong -f

# Kong database logs  
docker logs my-finance-kong-db
```

## So sánh với cách cũ

| Aspect | Cách cũ (x-user-id header) | Cách mới (Kong + JWT) |
|--------|---------------------------|----------------------|
| Authentication | Không có | JWT token |
| Security | ❌ Ai cũng giả mạo được | ✅ Token signed |
| User ID | Client tự gửi | Kong extract từ JWT |
| Centralized | ❌ Mỗi service tự handle | ✅ Kong handle hết |

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| Kong Proxy | 8000 | http://localhost:8000 |
| Kong Admin | 8001 | http://localhost:8001 |
| Kong Manager | 8002 | http://localhost:8002 |
| Auth Service | 3002 | http://localhost:3002 |
| Transaction Service | 3001 | http://localhost:3001 |
| Report Service | 3003 | http://localhost:3003 |
| Group Service | 3004 | http://localhost:3004 |
| PostgreSQL | 5433 | localhost:5433 |
| pgAdmin | 5050 | http://localhost:5050 |
| RabbitMQ | 15672 | http://localhost:15672 |

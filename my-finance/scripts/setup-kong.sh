#!/bin/bash

# Kong Configuration Script for My Finance
# This script sets up services, routes, and JWT authentication

KONG_ADMIN_URL="http://localhost:8001"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_ISSUER="my-finance-app"

echo "⏳ Waiting for Kong to be ready..."
until curl -s $KONG_ADMIN_URL > /dev/null; do
  sleep 2
done
echo "✅ Kong is ready!"

# ============================================
# 1. Create Services
# ============================================
echo ""
echo "📦 Creating Services..."

# Auth Service
curl -s -X POST $KONG_ADMIN_URL/services \
  --data "name=auth-service" \
  --data "url=http://auth-service:3002" > /dev/null
echo "  ✅ auth-service"

# Transaction Service
curl -s -X POST $KONG_ADMIN_URL/services \
  --data "name=transaction-service" \
  --data "url=http://transaction-service:3001" > /dev/null
echo "  ✅ transaction-service"

# Report Service
curl -s -X POST $KONG_ADMIN_URL/services \
  --data "name=report-service" \
  --data "url=http://report-service:3003" > /dev/null
echo "  ✅ report-service"

# Group Service
curl -s -X POST $KONG_ADMIN_URL/services \
  --data "name=group-service" \
  --data "url=http://group-service:3004" > /dev/null
echo "  ✅ group-service"

# ============================================
# 2. Create Routes
# ============================================
echo ""
echo "🛣️  Creating Routes..."

# Auth routes (public - no JWT required)
curl -s -X POST $KONG_ADMIN_URL/services/auth-service/routes \
  --data "name=auth-routes" \
  --data "paths[]=/api/auth" \
  --data "strip_path=false" > /dev/null
echo "  ✅ /api/auth/* -> auth-service"

# Transaction routes (protected)
curl -s -X POST $KONG_ADMIN_URL/services/transaction-service/routes \
  --data "name=transaction-routes" \
  --data "paths[]=/api/transactions" \
  --data "strip_path=true" > /dev/null
echo "  ✅ /api/transactions/* -> transaction-service"

# Account routes (protected)
curl -s -X POST $KONG_ADMIN_URL/services/transaction-service/routes \
  --data "name=account-routes" \
  --data "paths[]=/api/account" \
  --data "strip_path=false" > /dev/null
echo "  ✅ /api/account/* -> transaction-service"

# Report routes (protected)
curl -s -X POST $KONG_ADMIN_URL/services/report-service/routes \
  --data "name=report-routes" \
  --data "paths[]=/api/reports" \
  --data "strip_path=true" > /dev/null
echo "  ✅ /api/reports/* -> report-service"

# Group routes (protected)
curl -s -X POST $KONG_ADMIN_URL/services/group-service/routes \
  --data "name=group-routes" \
  --data "paths[]=/api/groups" \
  --data "strip_path=true" > /dev/null
echo "  ✅ /api/groups/* -> group-service"

# ============================================
# 3. Create Consumer and JWT Credentials
# ============================================
echo ""
echo "👤 Creating Consumer and JWT credentials..."

# Create a consumer for the application
curl -s -X POST $KONG_ADMIN_URL/consumers \
  --data "username=my-finance-app" > /dev/null
echo "  ✅ Consumer 'my-finance-app' created"

# Create JWT credentials with specific key (iss) and secret
curl -s -X POST $KONG_ADMIN_URL/consumers/my-finance-app/jwt \
  --data "key=$JWT_ISSUER" \
  --data "algorithm=HS256" \
  --data "secret=$JWT_SECRET" > /dev/null
echo "  ✅ JWT credentials created"
echo ""
echo "📋 JWT Configuration:"
echo "  Issuer (iss): $JWT_ISSUER"
echo "  Algorithm: HS256"
echo "  Secret: $JWT_SECRET"

# ============================================
# 4. Enable JWT Plugin on protected services
# ============================================
echo ""
echo "🔐 Configuring JWT Authentication..."

# Enable JWT plugin on transaction-service
curl -s -X POST $KONG_ADMIN_URL/services/transaction-service/plugins \
  --data "name=jwt" \
  --data "config.claims_to_verify=exp" > /dev/null
echo "  ✅ JWT enabled for transaction-service"

# Enable JWT plugin on report-service
curl -s -X POST $KONG_ADMIN_URL/services/report-service/plugins \
  --data "name=jwt" \
  --data "config.claims_to_verify=exp" > /dev/null
echo "  ✅ JWT enabled for report-service"

# Enable JWT plugin on group-service
curl -s -X POST $KONG_ADMIN_URL/services/group-service/plugins \
  --data "name=jwt" \
  --data "config.claims_to_verify=exp" > /dev/null
echo "  ✅ JWT enabled for group-service"

# ============================================
# 5. Add Post-Function Plugin to forward user ID
# ============================================
echo ""
echo "🔄 Adding plugins to forward user info..."

# Forward x-consumer-custom-id as x-user-id header
# Kong sẽ tự động thêm x-credential-identifier chứa iss
# Ta cần forward claim 'sub' từ JWT payload

# Transaction service - forward user id from JWT
curl -s -X POST $KONG_ADMIN_URL/services/transaction-service/plugins \
  --data "name=post-function" \
  --data "config.access[1]=local jwt = kong.request.get_header('Authorization'); if jwt then local payload = kong.ctx.shared.authenticated_jwt_token; if payload and payload.claims and payload.claims.sub then kong.service.request.set_header('x-user-id', payload.claims.sub); end; end" > /dev/null 2>&1

# Alternative: Use request-transformer to add header based on authenticated_credential
curl -s -X POST $KONG_ADMIN_URL/services/transaction-service/plugins \
  --data "name=request-transformer" \
  --data "config.add.headers=x-kong-jwt:true" > /dev/null 2>&1

curl -s -X POST $KONG_ADMIN_URL/services/report-service/plugins \
  --data "name=request-transformer" \
  --data "config.add.headers=x-kong-jwt:true" > /dev/null 2>&1

curl -s -X POST $KONG_ADMIN_URL/services/group-service/plugins \
  --data "name=request-transformer" \
  --data "config.add.headers=x-kong-jwt:true" > /dev/null 2>&1

echo "  ✅ Request transformer configured"

# ============================================
# 6. Enable CORS
# ============================================
echo ""
echo "🌐 Enabling CORS..."

curl -s -X POST $KONG_ADMIN_URL/plugins \
  --data "name=cors" \
  --data "config.origins=*" \
  --data "config.methods=GET,POST,PUT,PATCH,DELETE,OPTIONS" \
  --data "config.headers=Accept,Authorization,Content-Type,x-user-id" \
  --data "config.credentials=true" \
  --data "config.max_age=3600" > /dev/null
echo "  ✅ CORS enabled globally"

# ============================================
# Summary
# ============================================
echo ""
echo "============================================"
echo "🎉 Kong Configuration Complete!"
echo "============================================"
echo ""
echo "📌 Endpoints:"
echo "  Kong Proxy:    http://localhost:8000"
echo "  Kong Admin:    http://localhost:8001"
echo "  Kong Manager:  http://localhost:8002"
echo ""
echo "📌 API Routes:"
echo "  POST /api/auth/register    - Register (public)"
echo "  POST /api/auth/login       - Login (public)"
echo "  GET  /api/transactions     - Transactions (JWT required)"
echo "  GET  /api/account/balance  - Account (JWT required)"
echo "  GET  /api/reports/*        - Reports (JWT required)"
echo "  *    /api/groups/*         - Groups (JWT required)"
echo ""
echo "📌 Testing Flow:"
echo ""
echo "  1. Register:"
echo "     curl -X POST http://localhost:8000/api/auth/register \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"username\":\"test\",\"email\":\"test@test.com\",\"password\":\"123456\"}'"
echo ""
echo "  2. Login:"
echo "     curl -X POST http://localhost:8000/api/auth/login \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"username\":\"test\",\"password\":\"123456\"}'"
echo ""
echo "  3. Use protected API:"
echo "     curl http://localhost:8000/api/transactions \\"
echo "       -H 'Authorization: Bearer <your_token>'"
echo ""

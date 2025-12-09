# My Finance Application - Docker Deployment Guide

This guide explains how to deploy the My Finance application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available for containers

## Quick Start

### 1. Production Deployment

```bash
# Clone the repository
git clone <your-repo-url>
cd my-finance

# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Development Environment

```bash
# Start only infrastructure services (PostgreSQL, Redis, RabbitMQ)
docker-compose -f docker-compose.dev.yml up -d

# Run your Node.js services locally
npm run start:dev auth-service
npm run start:dev transaction-service
npm run start:dev report-service
npm run start:dev api-gateway
```

## Services Overview

| Service | Port | Description | Health Check URL |
|---------|------|-------------|------------------|
| API Gateway | 3000 | Main entry point | http://localhost:2999/health |
| Auth Service | 3002 | Authentication | http://localhost:3002/docs |
| Transaction Service | 3001 | Transaction management | http://localhost:3001/docs |
| Report Service | 3003 | Reports & analytics | http://localhost:3003/docs |
| PostgreSQL | 5432 | Primary database | - |
| Redis | 6379 | Caching & sessions | - |
| RabbitMQ | 5672, 15672 | Message broker | http://localhost:15672 |

## Environment Variables

The application uses environment variables for configuration. Key variables:

```bash
# Database
DATABASE_URL=postgresql://myfinance_user:myfinance_pass@postgres:5432/myfinance_db

# Services
AUTH_SERVICE_PORT=3002
TRANSACTION_SERVICE_PORT=3001
REPORT_SERVICE_PORT=3003
API_GATEWAY_PORT=2999

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# External Services
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_URL=amqp://myfinance:myfinance_pass@rabbitmq:5672
```

## Docker Commands

### Production Commands

```bash
# Build and start
docker-compose up -d

# Rebuild services
docker-compose up -d --build

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ destroys data)
docker-compose down -v

# View logs for specific service
docker-compose logs -f auth-service

# Scale a service
docker-compose up -d --scale transaction-service=3

# Update a single service
docker-compose up -d --no-deps transaction-service
```

### Development Commands

```bash
# Start infrastructure only
docker-compose -f docker-compose.dev.yml up -d

# Stop infrastructure
docker-compose -f docker-compose.dev.yml down

# Reset development database
docker-compose -f docker-compose.dev.yml down -v postgres
docker-compose -f docker-compose.dev.yml up -d postgres
```

### Debugging Commands

```bash
# Execute commands inside a container
docker-compose exec auth-service sh
docker-compose exec postgres psql -U myfinance_user -d myfinance_db

# Check container resource usage
docker stats

# Inspect service configuration
docker-compose config

# Follow logs for all services
docker-compose logs -f --tail=100
```

## Database Management

### Access PostgreSQL

```bash
# Via Docker Compose
docker-compose exec postgres psql -U myfinance_user -d myfinance_db

# Direct connection
psql postgresql://myfinance_user:myfinance_pass@localhost:5432/myfinance_db
```

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U myfinance_user myfinance_db > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U myfinance_user -d myfinance_db < backup.sql
```

## Monitoring & Management

### RabbitMQ Management

- URL: http://localhost:15672
- Username: `myfinance` (production) or `guest` (development)
- Password: `myfinance_pass` (production) or `guest` (development)

### Redis Management

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli monitor
```

### Health Checks

All services include health checks. Check status:

```bash
# Overall health
docker-compose ps

# Detailed health info
docker inspect my-finance-auth | jq '.[0].State.Health'
```

## Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   # Check what's using ports
   lsof -i :3000
   netstat -tulpn | grep :3000
   ```

2. **Memory issues**:
   ```bash
   # Check Docker memory usage
   docker stats --no-stream
   ```

3. **Network connectivity**:
   ```bash
   # Test service connectivity
   docker-compose exec auth-service wget -qO- http://transaction-service:3001/docs
   ```

4. **Database connection issues**:
   ```bash
   # Check database logs
   docker-compose logs postgres
   
   # Test connection
   docker-compose exec auth-service node -e "console.log(process.env.DATABASE_URL)"
   ```

### Service Dependencies

The services start in this order:
1. PostgreSQL, Redis, RabbitMQ
2. Transaction Service (depends on PostgreSQL, RabbitMQ)
3. Auth Service (depends on PostgreSQL)
4. Report Service (depends on Redis, RabbitMQ, Transaction Service)
5. API Gateway (depends on all other services)

## Production Considerations

### Security

1. **Change default passwords**:
   ```bash
   # Update in docker-compose.yml
   POSTGRES_PASSWORD=secure-password
   RABBITMQ_DEFAULT_PASS=secure-password
   JWT_SECRET=very-long-random-secret
   ```

2. **Use Docker secrets** for sensitive data in production

3. **Enable HTTPS** with reverse proxy (nginx/traefik)

### Performance

1. **Resource limits**:
   ```yaml
   # Add to service definition
   deploy:
     resources:
       limits:
         memory: 512M
         cpus: '0.5'
   ```

2. **Database optimization**:
   - Use connection pooling
   - Configure PostgreSQL memory settings
   - Set up database monitoring

3. **Caching strategy**:
   - Configure Redis persistence
   - Set appropriate TTL values
   - Monitor cache hit rates

### Monitoring

Consider adding:
- Prometheus + Grafana for metrics
- ELK Stack for log aggregation
- Health check endpoints
- Application performance monitoring (APM)

## Backup & Recovery

### Automated Backups

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec postgres pg_dump -U myfinance_user myfinance_db | gzip > "backup_${DATE}.sql.gz"
```

### Disaster Recovery

1. Regular database backups
2. Volume snapshots
3. Configuration backup
4. Secret management backup

For production deployments, consider using managed database services and implementing proper backup strategies.
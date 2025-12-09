# Environment Configuration

This document describes the environment variables used in the My Finance application.

## Getting Started

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env` according to your environment setup.

## Environment Variables

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database_name`

### Redis Configuration
- `REDIS_HOST`: Redis server hostname (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_PASSWORD`: Redis password (leave empty if no password)

### Service URLs
- `TRANSACTION_SERVICE_URL`: URL for transaction service
- `AUTH_SERVICE_URL`: URL for authentication service
- `REPORT_SERVICE_URL`: URL for report service
- `API_GATEWAY_URL`: URL for API gateway

### HTTP Configuration
- `HTTP_TIMEOUT`: Timeout for HTTP requests in milliseconds (default: 3000)

### Application Configuration
- `DEFAULT_CURRENCY`: Default currency for transactions (default: VND)
- `NODE_ENV`: Application environment (development, production, test)

### Service Ports
- `API_GATEWAY_PORT`: Port for API Gateway service
- `TRANSACTION_SERVICE_PORT`: Port for Transaction service
- `AUTH_SERVICE_PORT`: Port for Authentication service
- `REPORT_SERVICE_PORT`: Port for Report service

### JWT Configuration
- `JWT_SECRET`: Secret key for JWT token generation
- `JWT_EXPIRES_IN`: JWT token expiration time (e.g., "7d", "24h")

### RabbitMQ Configuration
- `RABBITMQ_URL`: RabbitMQ connection URL
- `RABBITMQ_QUEUE_PREFIX`: Prefix for queue names

### Logging
- `LOG_LEVEL`: Application log level (debug, info, warn, error)

## Security Notes

- Never commit the `.env` file to version control
- Use strong, unique values for `JWT_SECRET`
- Ensure database credentials are secure
- Use environment-specific values for different deployment environments

## Docker Configuration

When using Docker, you can:
1. Use the `.env` file directly with `docker-compose`
2. Set environment variables in your `docker-compose.yml` file
3. Use Docker secrets for sensitive values in production
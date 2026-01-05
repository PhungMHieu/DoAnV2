import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TransactionServiceModule } from './transaction-service.module';
import { setupSwagger } from '@app/swagger';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(TransactionServiceModule);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Setup Swagger documentation
  setupSwagger(app, {
    title: 'Transaction Service API',
    description: 'API for managing financial transactions and accounts',
    version: '1.0',
    path: 'docs',
  });

  // Connect gRPC microservice
  const grpcPort = Number(process.env.TRANSACTION_GRPC_PORT || 50051);

  // In Docker: /app/proto/transaction.proto
  // In dev: ../../../proto/transaction.proto
  const protoPath = process.env.NODE_ENV === 'production'
    ? join(process.cwd(), 'proto/transaction.proto')
    : join(__dirname, '../../../proto/transaction.proto');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'transaction',
      protoPath,
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  // Start all microservices
  await app.startAllMicroservices();
  console.log(`Transaction gRPC service listening on port ${grpcPort}`);

  const port = Number(process.env.TRANSACTION_SERVICE_PORT || 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Transaction HTTP service listening on port ${port}`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { TransactionServiceModule } from './transaction-service.module';
import { setupSwagger } from '@app/swagger';

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
    path: 'docs'
  });
  
  const port = Number(process.env.TRANSACTION_SERVICE_PORT || 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Transaction service listening on port ${port}`);
}
bootstrap();

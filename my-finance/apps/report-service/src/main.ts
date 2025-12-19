import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReportServiceModule } from './report-service.module';
import { setupSwagger } from '@app/swagger';

async function bootstrap() {
  const app = await NestFactory.create(ReportServiceModule);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Microservice RMQ để nhận event
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
      queue: process.env.REPORT_QUEUE || 'report_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();

  // Setup Swagger documentation
  setupSwagger(app, {
    title: 'Report Service API',
    description: 'API for generating financial reports and statistics',
    version: '1.0',
    path: 'docs'
  });

  const port = Number(process.env.REPORT_SERVICE_PORT || 3003);
  await app.listen(port, '0.0.0.0');
  console.log(`Report service listening on port ${port}`);
}

bootstrap();

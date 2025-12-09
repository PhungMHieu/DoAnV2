import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReportServiceModule } from './report-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ReportServiceModule);

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

  const port = Number(process.env.REPORT_HTTP_PORT || 3002);
  await app.listen(port);
  console.log(`Report service listening on port ${port}`);
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MlServiceModule } from './ml-service.module';

async function bootstrap() {
  const app = await NestFactory.create(MlServiceModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('ML Service API')
    .setDescription('AI/ML predictions for My Finance application')
    .setVersion('1.0')
    .addTag('ML Predictions')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.ML_SERVICE_PORT || 3005;
  await app.listen(port);
  console.log(`🤖 ML Service is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api`);
}
bootstrap();

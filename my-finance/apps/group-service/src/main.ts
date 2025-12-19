import { NestFactory } from '@nestjs/core';
import { GroupServiceModule } from './group-service.module';
import { setupSwagger } from '@app/swagger';

async function bootstrap() {
  const app = await NestFactory.create(GroupServiceModule);
  
  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
  });
  
  // Setup Swagger documentation
  setupSwagger(app, {
    title: 'Group Service API',
    description: 'API for managing groups and group members',
    version: '1.0',
    path: 'docs'
  });
  
  const port = Number(process.env.GROUP_SERVICE_PORT || 3004);
  await app.listen(port, '0.0.0.0');
  console.log(`Group service listening on port ${port}`);
}
bootstrap();

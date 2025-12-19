import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { setupSwagger } from '@app/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  
  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
  });
  
  setupSwagger(app, {
    title: 'Auth Service',
    description: 'Auth service API',
    path: 'docs', // → /docs
  });
  const port = Number(process.env.AUTH_SERVICE_PORT || 3002);
  await app.listen(port, '0.0.0.0');
  console.log(`Auth service listening on port ${port}`);
}
bootstrap();

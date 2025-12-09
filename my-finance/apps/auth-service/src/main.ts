import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { setupSwagger } from '@app/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  setupSwagger(app, {
    title: 'Auth Service',
    description: 'Auth service API',
    path: 'docs', // → /docs
  });
  await app.listen(process.env.port ?? 3000);
}
bootstrap();

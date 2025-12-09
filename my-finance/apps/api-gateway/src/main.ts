import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const port = Number(2999);
  await app.listen(port, '0.0.0.0');
  console.log(`API Gateway listening on port ${port}`);
}
bootstrap();

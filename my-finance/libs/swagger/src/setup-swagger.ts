// libs/swagger/src/lib/setup-swagger.ts
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export interface SwaggerConfig {
  title: string;
  description?: string;
  version?: string;
  path?: string; // đường dẫn docs, mặc định /docs
}

export function setupSwagger(app: INestApplication, config: SwaggerConfig) {
  const docBuilder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description ?? `${config.title} API docs`)
    .setVersion(config.version ?? '1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token', // tên security key
    )
    .build();

  const document = SwaggerModule.createDocument(app, docBuilder);

  SwaggerModule.setup(config.path ?? 'docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // nhớ token sau khi reload
    },
  });
}

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);
  const isProduction = config.get('isProduction', { infer: true });
  const apiPrefix = config.get('apiPrefix', { infer: true });

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('cors.origins', { infer: true }),
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ============================================================
  // Swagger — enabled in dev, disabled in production by default.
  // Set ENABLE_SWAGGER=true in prod if you ever want it public.
  // ============================================================
  const enableSwagger =
    !isProduction || process.env.ENABLE_SWAGGER === 'true';

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Karrali POS API')
      .setDescription(
        'Point-of-Sale backend. All endpoints under /' +
        apiPrefix +
        '. Authentication uses HttpOnly cookies (karrali_access, karrali_refresh).',
      )
      .setVersion('1.0.0')
      .addCookieAuth(
        'karrali_access',
        {
          type: 'apiKey',
          in: 'cookie',
          name: 'karrali_access',
        },
        'cookie-auth',
      )
      .addTag('auth', 'Authentication & session management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        withCredentials: true,
      },
      customSiteTitle: 'Karrali POS API Docs',
    });
  }

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port);
}

void bootstrap();
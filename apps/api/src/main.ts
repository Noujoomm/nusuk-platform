// Application Insights must be initialized before any other imports
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appInsights = require('applicationinsights');
  appInsights
    .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .start();
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  const config = app.get(ConfigService);
  const port = parseInt(process.env.PORT || config.get<string>('API_PORT', '4000'), 10);
  const origins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Trust proxy for Azure App Service / reverse proxies
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

  // CORS
  const allowedOrigins = origins.split(',').map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API running on port ${port} [${isProduction ? 'production' : 'development'}]`,
    'Bootstrap',
  );
}
bootstrap();

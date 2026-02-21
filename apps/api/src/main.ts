import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn', 'debug'] });
  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 4000);
  const origins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000');

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  app.enableCors({
    origin: origins.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
  Logger.log(`API running on http://0.0.0.0:${port}`, 'Bootstrap');
}
bootstrap();

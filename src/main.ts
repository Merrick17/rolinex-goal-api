import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  assertProductionEnvironment,
  getCorsOrigins,
} from './config/production-guard';

dotenv.config();
assertProductionEnvironment();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { RedisIoAdapter } = await import('./game/redis-io.adapter');
      const redisIoAdapter = new RedisIoAdapter(app);
      await redisIoAdapter.connectToRedis();
      app.useWebSocketAdapter(redisIoAdapter);
      console.log('Socket.IO: Redis adapter enabled');
    } catch (err) {
      console.warn(
        'Redis unavailable — continuing without Socket.IO Redis adapter (fine for single-instance local dev).',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const port = process.env.PORT ?? 3001;
  const enableSwagger =
    process.env.ENABLE_SWAGGER === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('ProlinexGoal API')
      .setDescription('Real-time crash/multiplier game backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Admin-Key', in: 'header' }, 'admin-key')
      .addApiKey(
        { type: 'apiKey', name: 'X-Payment-Webhook-Secret', in: 'header' },
        'payment-webhook',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get('/api/docs/json', (_req, res) => {
      res.type('application/json').send(JSON.stringify(document));
    });
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  const base = `http://localhost:${port}`;
  console.log(`Application is running on: ${base}`);
  if (enableSwagger) {
    console.log(`Swagger UI: ${base}/api/docs`);
  }
  if (process.env.GAME_ENGINE_ENABLED === 'false') {
    console.log('Game engine lifecycle disabled (GAME_ENGINE_ENABLED=false)');
  }
  if (process.env.SENTINELGATE_API_KEY) {
    const sim = process.env.PAYMENT_SIMULATION_INSTANT === 'true';
    if (sim) {
      console.warn(
        'Payments: SentinelGate is configured but PAYMENT_SIMULATION_INSTANT=true — card deposits will NOT use hosted checkout',
      );
    } else {
      console.log('Payments: SentinelGate hosted checkout enabled for card deposits');
    }
  }
}

void bootstrap();

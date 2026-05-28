import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentWebhookService } from './payment-webhook.service';

describe('PaymentWebhookController', () => {
  let app: INestApplication;
  const webhookSecret = 'test-webhook-secret-32chars!!';

  const mockWebhooks = {
    handleDepositConfirmed: jest.fn(),
    handleDepositFailed: jest.fn(),
    handleWithdrawConfirmed: jest.fn(),
    handleWithdrawFailed: jest.fn(),
  };

  const validBody = {
    transactionId: 'tx-1234567890',
    eventId: 'evt-12345678',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ PAYMENT_WEBHOOK_SECRET: webhookSecret })],
        }),
      ],
      controllers: [PaymentWebhookController],
      providers: [
        { provide: PaymentWebhookService, useValue: mockWebhooks },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/webhooks/payment/deposit-confirmed', () => {
    it('rejects missing webhook secret header', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/payment/deposit-confirmed')
        .send(validBody)
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toBe('Invalid webhook secret');
        });

      expect(mockWebhooks.handleDepositConfirmed).not.toHaveBeenCalled();
    });

    it('rejects incorrect webhook secret header', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/payment/deposit-confirmed')
        .set('x-payment-webhook-secret', 'wrong-secret-value')
        .send(validBody)
        .expect(400);

      expect(mockWebhooks.handleDepositConfirmed).not.toHaveBeenCalled();
    });

    it('returns idempotent duplicate response from service', async () => {
      mockWebhooks.handleDepositConfirmed.mockResolvedValue({
        ok: true,
        duplicate: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/webhooks/payment/deposit-confirmed')
        .set('x-payment-webhook-secret', webhookSecret)
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual({ ok: true, duplicate: true });
      expect(mockWebhooks.handleDepositConfirmed).toHaveBeenCalledWith(
        validBody.eventId,
        validBody.transactionId,
      );
    });
  });
});

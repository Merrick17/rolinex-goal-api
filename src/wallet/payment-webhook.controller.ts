import {
  Body,
  Controller,
  Headers,
  Post,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PaymentWebhookService } from './payment-webhook.service';
import { DepositWebhookDto } from './dto/deposit-webhook.dto';

@Controller('api/webhooks')
@SkipThrottle()
export class PaymentWebhookController {
  constructor(
    private readonly webhooks: PaymentWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Post('payment/deposit-confirmed')
  @HttpCode(HttpStatus.OK)
  async depositConfirmed(
    @Headers('x-payment-webhook-secret') secret: string | undefined,
    @Body() body: DepositWebhookDto,
  ) {
    const expected = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Payment webhooks are not configured (PAYMENT_WEBHOOK_SECRET)',
      );
    }
    if (!secret || secret !== expected) {
      throw new BadRequestException('Invalid webhook secret');
    }
    return this.webhooks.handleDepositConfirmed(body.eventId, body.transactionId);
  }

  @Post('payment/deposit-failed')
  @HttpCode(HttpStatus.OK)
  async depositFailed(
    @Headers('x-payment-webhook-secret') secret: string | undefined,
    @Body() body: DepositWebhookDto,
  ) {
    const expected = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Payment webhooks are not configured (PAYMENT_WEBHOOK_SECRET)',
      );
    }
    if (!secret || secret !== expected) {
      throw new BadRequestException('Invalid webhook secret');
    }
    return this.webhooks.handleDepositFailed(body.eventId, body.transactionId);
  }

  @Post('payment/withdraw-confirmed')
  @HttpCode(HttpStatus.OK)
  async withdrawConfirmed(
    @Headers('x-payment-webhook-secret') secret: string | undefined,
    @Body() body: DepositWebhookDto,
  ) {
    const expected = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Payment webhooks are not configured (PAYMENT_WEBHOOK_SECRET)',
      );
    }
    if (!secret || secret !== expected) {
      throw new BadRequestException('Invalid webhook secret');
    }
    return this.webhooks.handleWithdrawConfirmed(
      body.eventId,
      body.transactionId,
    );
  }

  @Post('payment/withdraw-failed')
  @HttpCode(HttpStatus.OK)
  async withdrawFailed(
    @Headers('x-payment-webhook-secret') secret: string | undefined,
    @Body() body: DepositWebhookDto,
  ) {
    const expected = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Payment webhooks are not configured (PAYMENT_WEBHOOK_SECRET)',
      );
    }
    if (!secret || secret !== expected) {
      throw new BadRequestException('Invalid webhook secret');
    }
    return this.webhooks.handleWithdrawFailed(body.eventId, body.transactionId);
  }
}

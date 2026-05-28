import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentWebhookService } from './payment-webhook.service';
import { SentinelGateService } from './sentinelgate.service';

@Controller('api/webhooks')
@SkipThrottle()
export class SentinelGateWebhookController {
  constructor(
    private readonly sentinelgate: SentinelGateService,
    private readonly payments: PaymentWebhookService,
  ) {}

  @Post('sentinelgate')
  @HttpCode(HttpStatus.OK)
  async handleSentinelGate(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-sentinel-signature') signature: string | undefined,
  ) {
    const raw = req.rawBody;
    if (!raw?.length) {
      return { received: false, reason: 'empty_body' };
    }

    if (!this.sentinelgate.verifyWebhookSignature(raw, signature)) {
      throw new UnauthorizedException('Invalid SentinelGate webhook signature');
    }

    const payload = this.sentinelgate.parseWebhookPayload(raw);
    const transactionId = this.sentinelgate.resolveTransactionId(payload);
    if (!transactionId) {
      return { received: true, ignored: 'no_order_id' };
    }

    const eventId = this.sentinelgate.webhookEventKey(payload);

    switch (payload.status) {
      case 'captured': {
        const paidAmount =
          payload.amount !== undefined ? Number(payload.amount) : undefined;
        await this.payments.handleDepositConfirmed(
          eventId,
          transactionId,
          paidAmount,
        );
        break;
      }
      case 'failed':
        await this.payments.handleDepositFailed(eventId, transactionId);
        break;
      case 'refunded': {
        const refundAmount = Number(payload.amount ?? 0);
        if (refundAmount > 0) {
          await this.payments.handleDepositRefunded(
            eventId,
            transactionId,
            refundAmount,
          );
        }
        break;
      }
      default:
        break;
    }

    return { received: true };
  }
}

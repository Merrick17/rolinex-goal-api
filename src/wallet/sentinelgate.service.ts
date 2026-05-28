import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type SentinelGateHostedSession = {
  sentinel_transaction_id: string;
  transaction_id?: string;
  session_id?: string;
  redirect_url?: string;
  hosted_url?: string;
  status?: string;
};

export type SentinelGateWebhookPayload = {
  sentinel_transaction_id: string;
  wc_order_id?: string;
  status: 'captured' | 'failed' | 'refunded' | string;
  amount?: number;
  currency?: string;
  provider?: string;
  provider_reference?: string;
  gateway_response?: string;
  channel?: string;
};

@Injectable()
export class SentinelGateService {
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SENTINELGATE_API_KEY')?.trim();
    this.apiSecret = this.config.get<string>('SENTINELGATE_API_SECRET')?.trim();
    this.baseUrl = (
      this.config.get<string>('SENTINELGATE_BASE_URL') ?? 'https://sentinelgate.biz'
    ).replace(/\/$/, '');
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  /** Hosted checkout currency: USD unless `SENTINELGATE_CURRENCY` is set (see SentinelGate supported currencies). */
  resolveCheckoutCurrency(): string {
    const override = this.config.get<string>('SENTINELGATE_CURRENCY')?.trim();
    return (override ?? 'USD').toUpperCase();
  }

  async createHostedCheckoutSession(input: {
    userId: string;
    email: string;
    transactionId: string;
    amount: number;
  }): Promise<SentinelGateHostedSession> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('SentinelGate is not configured');
    }

    if (input.amount < 0.01) {
      throw new BadRequestException('Deposit amount is too small for SentinelGate');
    }

    const currency = this.resolveCheckoutCurrency();
    const callbackUrl = this.getCallbackUrl();
    const returnUrl =
      this.config.get<string>('SENTINELGATE_SUCCESS_URL') ??
      'http://localhost:3000/wallet/deposit/success';
    const cancelUrl =
      this.config.get<string>('SENTINELGATE_CANCEL_URL') ??
      'http://localhost:3000/wallet/deposit/cancel';

    const body = {
      amount: input.amount.toFixed(2),
      currency,
      order_id: input.transactionId,
      description: `ProlinexGoal wallet deposit (${input.amount} ${currency})`,
      customer_email: input.email,
      callback_url: callbackUrl,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    };

    const res = await fetch(`${this.baseUrl}/v1/hosted/create`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey!,
        'X-API-Secret': this.apiSecret!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as SentinelGateHostedSession & {
      error?: string;
      message?: string;
    };

    if (!res.ok) {
      const detail = data.message ?? data.error ?? res.statusText;
      throw new BadRequestException(
        `SentinelGate hosted checkout failed: ${detail}`,
      );
    }

    const redirectUrl = data.redirect_url ?? data.hosted_url;
    if (!redirectUrl) {
      throw new ServiceUnavailableException(
        'SentinelGate did not return a checkout URL',
      );
    }

    const txnId =
      data.sentinel_transaction_id ?? data.transaction_id ?? data.session_id;
    if (!txnId) {
      throw new ServiceUnavailableException(
        'SentinelGate did not return a transaction id',
      );
    }

    return {
      ...data,
      sentinel_transaction_id: txnId,
      redirect_url: redirectUrl,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.config.get<string>('SENTINELGATE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'SENTINELGATE_WEBHOOK_SECRET is not configured',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing X-Sentinel-Signature header');
    }

    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  parseWebhookPayload(rawBody: Buffer): SentinelGateWebhookPayload {
    try {
      return JSON.parse(rawBody.toString('utf8')) as SentinelGateWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid SentinelGate webhook JSON');
    }
  }

  resolveTransactionId(payload: SentinelGateWebhookPayload): string | null {
    return payload.wc_order_id?.trim() || null;
  }

  webhookEventKey(payload: SentinelGateWebhookPayload): string {
    return `sentinelgate:${payload.sentinel_transaction_id}:${payload.status}`;
  }

  private getCallbackUrl(): string {
    const explicit = this.config.get<string>('SENTINELGATE_CALLBACK_URL')?.trim();
    if (explicit) return explicit.replace(/\/$/, '');

    const apiPublic = this.config.get<string>('API_PUBLIC_URL')?.trim();
    if (apiPublic) {
      return `${apiPublic.replace(/\/$/, '')}/api/webhooks/sentinelgate`;
    }

    throw new ServiceUnavailableException(
      'Set SENTINELGATE_CALLBACK_URL or API_PUBLIC_URL for deposit webhooks',
    );
  }
}

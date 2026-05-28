import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentWebhookService } from './payment-webhook.service';
import { SentinelGateWebhookController } from './sentinelgate-webhook.controller';
import { SentinelGateService } from './sentinelgate.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WalletService, PaymentWebhookService, SentinelGateService],
  controllers: [
    WalletController,
    PaymentWebhookController,
    SentinelGateWebhookController,
  ],
})
export class WalletModule {}

import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { GetUser } from '../auth/get-user.decorator';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('api/wallet')
@UseGuards(AuthGuard('jwt'))
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async balance(@GetUser() user: { userId: string }) {
    return this.walletService.getBalance(user.userId);
  }

  @Post('deposit')
  async deposit(@GetUser() user: { userId: string }, @Body() dto: DepositDto) {
    return this.walletService.deposit(
      user.userId,
      dto.amount,
      dto.paymentMethod,
    );
  }

  @Post('withdraw')
  async withdraw(
    @GetUser() user: { userId: string },
    @Body() dto: WithdrawDto,
  ) {
    return this.walletService.withdraw(
      user.userId,
      dto.amount,
      dto.payoutMethod,
    );
  }

  @Get('transactions')
  async transactions(
    @GetUser() user: { userId: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: string,
  ) {
    return this.walletService.getTransactions(
      user.userId,
      Number(page),
      Number(limit),
      type,
    );
  }
}

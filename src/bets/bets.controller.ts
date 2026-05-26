import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BetsService } from './bets.service';
import { RoundsService } from '../rounds/rounds.service';
import { GetUser } from '../auth/get-user.decorator';
import { PlaceBetDto } from './dto/place-bet.dto';
import { CashoutDto } from './dto/cashout.dto';

@Controller('api/bets')
@UseGuards(AuthGuard('jwt'))
export class BetsController {
  constructor(
    private readonly betsService: BetsService,
    private readonly roundsService: RoundsService,
  ) {}

  @Post('place')
  async place(@GetUser() user: { userId: string }, @Body() dto: PlaceBetDto) {
    return this.betsService.placeBet(
      user.userId,
      dto.roundId,
      dto.amount,
      dto.autoCashout,
    );
  }

  @Post('cashout')
  async cashout(@GetUser() user: { userId: string }, @Body() dto: CashoutDto) {
    const multiplier = this.roundsService.currentMultiplier;
    return this.betsService.cashout(user.userId, dto.betId, multiplier);
  }

  @Get('mine')
  async mine(
    @GetUser() user: { userId: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.betsService.getUserBets(
      user.userId,
      Number(page),
      Number(limit),
      status,
    );
  }
}

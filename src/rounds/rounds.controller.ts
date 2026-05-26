import { Controller, Get, Param, Query } from '@nestjs/common';
import { RoundsService } from './rounds.service';

@Controller('api/rounds')
export class RoundsController {
  constructor(private readonly roundsService: RoundsService) {}

  @Get('current')
  async current() {
    const round = await this.roundsService.getCurrentRound();
    if (!round) return { roundId: null, phase: null, multiplier: null };
    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      phase: round.status,
      multiplier:
        round.status === 'flying' ? this.roundsService.currentMultiplier : null,
      startedAt: round.startedAt,
      crashPoint: null,
    };
  }

  @Get('history')
  async history(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.roundsService.getHistory(Number(page), Number(limit));
  }

  @Get(':roundId')
  async details(@Param('roundId') roundId: string) {
    return this.roundsService.getRoundDetails(roundId);
  }
}

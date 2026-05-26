import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LeaderboardService } from './leaderboard.service';
import { GetUser } from '../auth/get-user.decorator';

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('weekly')
  async weekly(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.leaderboardService.weekly(Number(page), Number(limit));
  }

  @Get('all-time')
  async allTime(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.leaderboardService.allTime(Number(page), Number(limit));
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@GetUser() user: { userId: string }) {
    return this.leaderboardService.me(user.userId);
  }
}

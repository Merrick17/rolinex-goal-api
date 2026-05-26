import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReferralsService } from './referrals.service';
import { GetUser } from '../auth/get-user.decorator';

@Controller('api/referrals')
@UseGuards(AuthGuard('jwt'))
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post('generate')
  async generate(@GetUser() user: { userId: string }) {
    return this.referralsService.generateCode(user.userId);
  }

  @Get('stats')
  async stats(@GetUser() user: { userId: string }) {
    return this.referralsService.stats(user.userId);
  }
}

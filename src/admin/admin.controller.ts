import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminService } from './admin.service';
import { AdminPatchUserDto } from './dto/admin.dto';

@Controller('api/admin')
@SkipThrottle()
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users/:userId')
  async getUser(@Param('userId') userId: string) {
    return this.admin.getUser(userId);
  }

  @Patch('users/:userId')
  async patchUser(
    @Param('userId') userId: string,
    @Body() dto: AdminPatchUserDto,
  ) {
    return this.admin.patchUser(userId, {
      accountFrozen: dto.accountFrozen,
      balanceDelta: dto.balanceDelta,
      reason: dto.reason,
    });
  }
}

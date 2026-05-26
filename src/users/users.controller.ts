import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { GetUser } from '../auth/get-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('api/users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@GetUser() user: { userId: string }) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  async updateMe(
    @GetUser() user: { userId: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }
}

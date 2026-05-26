import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException(
        'User with this email or username already exists',
      );
    }

    let referrerId: string | undefined;
    if (dto.referralCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: dto.referralCode },
      });
      if (!referrer) throw new NotFoundException('Invalid referral code');
      referrerId = referrer.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        referredBy: referrerId,
      },
    });

    const tokens = await this.generateTokens(user.id);
    return {
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id);
    return {
      user: { id: user.id, username: user.username },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload: { sub: string } = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const stored = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          tokenHash: refreshToken,
          expiresAt: { gt: new Date() },
        },
      });
      if (!stored) throw new UnauthorizedException('Invalid refresh token');

      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      return this.generateTokens(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: refreshToken },
    });
    if (!stored) return;
    if (stored.userId !== userId) {
      throw new UnauthorizedException('Token does not belong to user');
    }
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: refreshToken },
    });
  }

  async logoutByRefreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: refreshToken },
    });
    if (stored) {
      await this.prisma.refreshToken.deleteMany({
        where: { tokenHash: refreshToken },
      });
    }
  }

  private async generateTokens(userId: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRY'),
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRY'),
      },
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshToken,
        expiresAt,
      },
    });
    return { accessToken, refreshToken };
  }
}

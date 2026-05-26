import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCode(userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!existing) {
      throw new Error('User not found');
    }
    const referralCode =
      existing.referralCode ?? `PROLINEX-${nanoid(8).toUpperCase()}`;
    if (!existing.referralCode) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { referralCode },
      });
    }
    return {
      referralCode,
      referralUrl: `https://prolinexgoal.com/ref/${referralCode}`,
    };
  }

  async stats(userId: string) {
    const referrals = await this.prisma.user.findMany({
      where: { referredBy: userId },
    });
    const activeReferrals = referrals.filter(
      (r) => Number(r.balance) > 0,
    ).length;
    return {
      totalReferrals: referrals.length,
      activeReferrals,
      bonusEntries: referrals.length * 2,
      referrals: referrals.map((r) => ({
        username: r.username,
        joinedAt: r.createdAt,
        status: Number(r.balance) > 0 ? 'active' : 'inactive',
      })),
    };
  }
}

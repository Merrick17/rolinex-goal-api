import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        balance: true,
        currency: true,
        accountFrozen: true,
        createdAt: true,
        referralCode: true,
        referredBy: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      balance: Number(user.balance),
    };
  }

  async patchUser(
    userId: string,
    body: {
      accountFrozen?: boolean;
      balanceDelta?: number;
      reason?: string;
    },
  ) {
    let current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException('User not found');

    if (body.accountFrozen !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { accountFrozen: body.accountFrozen },
      });
      current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }

    if (body.balanceDelta !== undefined && body.balanceDelta !== 0) {
      const delta = body.balanceDelta;
      const bal = Number(current.balance);
      const next = +(bal + delta).toFixed(2);
      if (next < 0) {
        throw new BadRequestException('Balance would become negative');
      }
      const type = delta > 0 ? ('admin_credit' as const) : ('admin_debit' as const);
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { balance: next },
        }),
        this.prisma.transaction.create({
          data: {
            userId,
            type,
            amount: delta,
            balanceAfter: next,
            referenceId: body.reason?.slice(0, 200) ?? 'admin_adjustment',
            txStatus: 'completed',
          },
        }),
      ]);
    }

    return this.getUser(userId);
  }
}

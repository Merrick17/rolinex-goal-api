import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY');
    if (!expected) {
      throw new UnauthorizedException('Admin API is not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.header('x-admin-key');
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}

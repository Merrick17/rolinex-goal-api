import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: { user?: { userId: string } } = ctx
      .switchToHttp()
      .getRequest();
    return request.user;
  },
);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  username: string;
  email: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData | null => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) return null;

    return {
      userId: request.user.userId,
      username: request.user.username,
      email: request.user.email,
      roles: request.user.roles,
    };
  },
);

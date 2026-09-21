import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../constants.js';
import type { RequestWithUser } from '../types/request-with-user.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user as JwtPayload;
  },
);

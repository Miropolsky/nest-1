import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type JwtPayload = {
  sub: number;
  username: string;
  type: 'access' | 'refresh';
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

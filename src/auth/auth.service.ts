import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { StringValue } from 'ms';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import type { AuthUser } from '../users/users.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthTokens, JwtPayload } from './constants.js';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signIn(login: string, pass: string): Promise<AuthTokens> {
    const user = await this.usersService.validateCredentials(login, pass);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async register(signUpDto: CreateUserDto): Promise<AuthTokens> {
    if (await this.usersService.existsByLogin(signUpDto.login)) {
      throw new ConflictException('Login already taken');
    }

    if (await this.usersService.existsByEmail(signUpDto.email)) {
      throw new ConflictException('Email already taken');
    }

    const user = await this.usersService.create(signUpDto);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const storedHash = await this.usersService.getRefreshTokenHash(
        payload.sub,
      );
      if (!storedHash || storedHash !== this.hashToken(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.usersService.findOne(payload.sub);
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async issueTokens(user: AuthUser): Promise<AuthTokens> {
    const base = { sub: user.id, username: user.login };

    const accessExpiresIn = this.configService.getOrThrow<string>(
      'jwt.expiresIn',
    ) as StringValue;
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    ) as StringValue;

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(
        { ...base, type: 'access' },
        {
          secret: this.configService.getOrThrow<string>('jwt.secret'),
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...base, type: 'refresh' },
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    await this.usersService.setRefreshTokenHash(
      user.id,
      this.hashToken(refresh_token),
    );

    return { access_token, refresh_token };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

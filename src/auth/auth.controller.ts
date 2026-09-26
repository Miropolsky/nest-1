import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from './constants.js';
import { AuthTokensDto } from './dto/auth-tokens.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { SignInDto } from './dto/sign-in.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Вход в систему' })
  @ApiResponse({
    status: 200,
    description: 'Вход выполнен',
    type: AuthTokensDto,
  })
  @ApiResponse({ status: 401, description: 'Неверные учётные данные' })
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.login, signInDto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('register')
  @ApiOperation({ summary: 'Регистрация пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Регистрация выполнена',
    type: AuthTokensDto,
  })
  @ApiResponse({ status: 409, description: 'Логин или email уже заняты' })
  register(@Body() signUpDto: CreateUserDto) {
    return this.authService.register(signUpDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Обновление токена' })
  @ApiResponse({
    status: 200,
    description: 'Токены обновлены',
    type: AuthTokensDto,
  })
  @ApiResponse({ status: 401, description: 'Невалидный refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }
}

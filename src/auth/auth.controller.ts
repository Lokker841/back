import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Вход в админ-панель',
    description: 'Возвращает JWT access token.',
  })
  @ApiResponse({
    status: 201,
    schema: { example: { access_token: 'jwt-token' } },
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }
}


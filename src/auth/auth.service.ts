import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private getAdminUsername(): string {
    return this.config.get<string>('ADMIN_USERNAME', 'admin');
  }

  private getPasswordHash(): string {
    const hash = this.config.get<string>('ADMIN_PASSWORD_HASH', '');
    if (!hash) {
      throw new Error('ADMIN_PASSWORD_HASH is not set');
    }
    return hash;
  }

  private getPasswordSalt(): string {
    const salt = this.config.get<string>('AUTH_PASSWORD_SALT', '');
    if (!salt) {
      throw new Error('AUTH_PASSWORD_SALT is not set');
    }
    return salt;
  }

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const expectedUsername = this.getAdminUsername();
    if (username !== expectedUsername) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const peppered = password + this.getPasswordSalt();
    const ok = await bcrypt.compare(peppered, this.getPasswordHash());
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: 'admin',
      username: expectedUsername,
      role: 'admin',
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}


import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) {}

    async login(dto: LoginDto) {
        const admin = await this.prisma.adminUser.findUnique({
            where: { email: dto.email },
        });

        if (!admin || !admin.isActive) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordMatches = await bcrypt.compare(dto.password, admin.password);

        if (!passwordMatches) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const accessToken = await this.jwtService.signAsync({ 
            sub: admin.id, 
            email: admin.email,
            role: admin.role,
        });

        return {
            accessToken,
            user: {
                id: admin.id,
                email: admin.email,
                role: admin.role,
            },
        };
    }
}

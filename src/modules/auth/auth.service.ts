import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from 'src/modules/users/dto/register.dto';
import { LoginDto } from 'src/modules/users/dto/login.dto';
import { User } from 'src/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import {
    JwtPayload,
    LoginResponse,
    RegisterResponse,
} from './auth-response.interface';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) {}

    async register(
        dto: RegisterDto & { role?: UserRole },
    ): Promise<RegisterResponse> {
        const existing: User | null = await this.usersService.findByEmail(
            dto.email,
        );
        if (existing)
            throw new UnauthorizedException('Email already registered');

        const hashed: string = await bcrypt.hash(dto.password, 10);
        const user: User = await this.usersService.create({
            name: dto.name,
            email: dto.email,
            passwordHash: hashed,
            role: dto.role ?? UserRole.USER,
        });

        return { message: 'User registered', user };
    }

    async login(dto: LoginDto): Promise<LoginResponse> {
        const user: User | null = await this.usersService.findByEmail(
            dto.email,
        );
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid: boolean = await bcrypt.compare(
            dto.password,
            user.passwordHash,
        );
        if (!valid) throw new UnauthorizedException('Invalid credentials');

        const payload: JwtPayload = {
            sub: user.id,
            role: user.role,
            email: user.email,
        };
        const token: string = await this.jwtService.signAsync(payload);

        return { access_token: token, user };
    }

    async validateUser(id: string) {
        return this.usersService.findOne(id);
    }
}

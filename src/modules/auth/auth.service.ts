import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../user/users.service';
import { RegisterDto } from 'src/modules/user/dto/register.dto';
import { LoginDto } from 'src/modules/user/dto/login.dto';
import { User } from 'src/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import {
    JwtPayload,
    LoginResponse,
    RegisterResponse,
} from './auth-response.interface';

// Type for sanitized user (without passwordHash)
type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) {}

    /**
     * Helper to sanitize user (remove passwordHash from response)
     * Only returns essential user information
     */
    private sanitizeUser(user: User): SanitizedUser {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    async register(
        dto: RegisterDto & { role?: UserRole },
    ): Promise<RegisterResponse> {
        const existing: User | null = await this.usersService.findByEmail(
            dto.email,
        );
        if (existing) {
            throw new UnauthorizedException('Email already registered');
        }

        const hashed: string = await bcrypt.hash(dto.password, 10);
        const user: User = await this.usersService.create({
            name: dto.name,
            email: dto.email,
            passwordHash: hashed,
            role: dto.role ?? UserRole.USER,
        });

        return {
            message: 'User registered successfully',
            user: this.sanitizeUser(user),
        };
    }

    async login(dto: LoginDto): Promise<LoginResponse> {
        // Find user with passwordHash for verification
        const user: User | null = await this.usersService.findByEmail(
            dto.email,
        );
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verify password
        const valid: boolean = await bcrypt.compare(
            dto.password,
            user.passwordHash,
        );
        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Create JWT payload with minimal data
        const payload: JwtPayload = {
            sub: user.id,
            role: user.role,
            email: user.email,
        };
        const token: string = await this.jwtService.signAsync(payload);

        return {
            access_token: token,
            user: this.sanitizeUser(user),
        };
    }

    /**
     * Validate user from JWT token
     * Used by JwtStrategy for request authentication
     */
    async validateUser(id: string): Promise<SanitizedUser | null> {
        return this.usersService.findOne(id);
    }
}

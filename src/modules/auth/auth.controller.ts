import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from 'src/modules/user/dto/register.dto';
import { LoginDto } from 'src/modules/user/dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserRole } from 'src/common/enums/user-role.enum';
import { User } from 'src/entities/user.entity';
import type { RequestWithUser, SanitizedUser } from './auth-response.interface';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    /**
     * Helper method to sanitize user object
     * Removes sensitive data like passwordHash
     */
    private sanitizeUser(user: User): SanitizedUser {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // This implements admin register - NOT SECURE, disable in production
    @Post('admin-register')
    async registerAdmin(@Body() dto: RegisterDto) {
        return this.authService.register({ ...dto, role: UserRole.ADMIN });
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getProfile(@Request() req: RequestWithUser): SanitizedUser {
        return this.sanitizeUser(req.user);
    }
}

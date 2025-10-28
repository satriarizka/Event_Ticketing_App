import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from 'src/modules/users/dto/register.dto';
import { LoginDto } from 'src/modules/users/dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserRole } from 'src/common/enums/user-role.enum';
import { User } from 'src/entities/user.entity';
import type { RequestWithUser } from './auth-response.interface';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // this implement admin regist not secure, please off in production
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
    getProfile(@Request() req: RequestWithUser): User {
        return req.user;
    }
}

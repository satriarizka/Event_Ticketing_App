import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
    DefaultValuePipe,
    ParseIntPipe,
} from '@nestjs/common';
import {
    ApiQuery,
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateUserDto } from 'src/modules/user/dto/update-user.dto';
import { User } from 'src/entities/user.entity';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SanitizedUser } from '../auth/auth-response.interface'; // ← Import from shared location

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    /**
     * Get current user profile
     * BEST PRACTICE: Dedicated endpoint for authenticated user's own data
     * Frontend calls this after login to get fresh user data
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    @ApiOperation({
        summary: 'Get current user profile',
        description: "Returns the authenticated user's profile data",
    })
    async getCurrentUser(
        @CurrentUser() user: User,
    ): Promise<SanitizedUser | null> {
        return this.usersService.findOne(user.id);
    }

    /**
     * Update current user profile
     * BEST PRACTICE: Users can only update their own profile
     */
    @UseGuards(JwtAuthGuard)
    @Patch('me')
    @ApiOperation({
        summary: 'Update current user profile',
        description: 'Allows authenticated user to update their own profile',
    })
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => {
                console.error('Validation failed with errors:', errors);
                return new BadRequestException(errors);
            },
        }),
    )
    async updateCurrentUser(
        @CurrentUser() user: User,
        @Body() dto: UpdateUserDto,
    ): Promise<SanitizedUser | null> {
        return this.usersService.update(user.id, dto);
    }

    @Get()
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ): Promise<{
        data: SanitizedUser[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        // Validate pagination parameters
        if (page < 1) {
            throw new BadRequestException('Page must be greater than 0');
        }
        if (limit < 1 || limit > 100) {
            throw new BadRequestException('Limit must be between 1 and 100');
        }

        return this.usersService.findAllWithPagination(page, limit);
    }

    @Get('role/admin')
    async admin(): Promise<SanitizedUser[]> {
        return this.usersService.findByRole(UserRole.ADMIN);
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<SanitizedUser | null> {
        return this.usersService.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => {
                console.error('Validation failed with errors:', errors);
                return new BadRequestException(errors);
            },
        }),
    )
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
    ): Promise<SanitizedUser | null> {
        return this.usersService.update(id, dto);
    }
}

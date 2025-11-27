import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
    ParseUUIDPipe,
    DefaultValuePipe,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { validate as isUUID } from 'uuid';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => new BadRequestException(errors),
        }),
    )
    @Post()
    create(@Body() dto: CreateEventDto, @CurrentUser() user: User) {
        return this.eventsService.create(dto, user);
    }

    @Get('/public')
    @ApiQuery({
        name: 'categoryId',
        required: false,
        description: 'Filter by category UUID',
        type: String,
    })
    @ApiQuery({
        name: 'search',
        required: false,
        description: 'Search in title and description',
        type: String,
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    findPublic(
        @Query('categoryId') categoryId?: string,
        @Query('search') search?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
        limit: number = 10,
    ) {
        // Validate pagination parameters
        if (page < 1) {
            throw new BadRequestException('Page must be greater than 0');
        }
        if (limit < 1 || limit > 100) {
            throw new BadRequestException('Limit must be between 1 and 100');
        }

        // Validate categoryId if provided
        if (categoryId && !isUUID(categoryId)) {
            throw new BadRequestException(
                'Invalid categoryId format. Must be a valid UUID',
            );
        }

        // Clean up parameters - convert empty strings to undefined
        const cleanCategoryId =
            categoryId && categoryId.trim() !== '' ? categoryId : undefined;
        const cleanSearch = search && search.trim() !== '' ? search : undefined;

        return this.eventsService.findPublic(
            cleanCategoryId,
            cleanSearch,
            page,
            limit,
        );
    }

    @Get('/public/:id')
    findPublicEventById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.eventsService.findPublicById(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Get()
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        // Validate pagination parameters
        if (page < 1) {
            throw new BadRequestException('Page must be greater than 0');
        }
        if (limit < 1 || limit > 100) {
            throw new BadRequestException('Limit must be between 1 and 100');
        }

        return this.eventsService.findAllWithPagination(page, limit);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.eventsService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateEventDto,
    ) {
        return this.eventsService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Delete(':id')
    remove(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.eventsService.remove(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Patch(':id/publish')
    @HttpCode(HttpStatus.OK)
    async togglePublish(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body('publish') publish: boolean,
    ) {
        if (typeof publish !== 'boolean') {
            throw new BadRequestException('Publish flag must be a boolean');
        }
        return this.eventsService.togglePublish(id, publish);
    }
}

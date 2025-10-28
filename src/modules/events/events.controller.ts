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
    Request,
    UseGuards,
    UsePipes,
    ValidationPipe,
    ParseUUIDPipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';

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
    create(@Body() dto: CreateEventDto, @Request() req) {
        return this.eventsService.create(dto, req.user);
    }

    @Get('/public')
    findPublic(
        @Query('categoryId') categoryId?: string,
        @Query('search') search?: string,
        @Query('page') page = '1',
        @Query('limit') limit = '10',
    ) {
        return this.eventsService.findPublic(
            categoryId,
            search,
            parseInt(page, 10),
            parseInt(limit, 10),
        );
    }

    @Get('/public/:id')
    findPublicEventById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.eventsService.findPublicById(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Get()
    findAll() {
        return this.eventsService.findAll();
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

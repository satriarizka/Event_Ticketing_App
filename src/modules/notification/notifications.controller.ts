import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { Notification } from '../../entities/notification.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all notifications for current user' })
    @ApiResponse({
        status: 200,
        description: 'Notifications retrieved successfully',
        type: [Notification],
    })
    async getUserNotifications(
        @CurrentUser() user: User,
    ): Promise<Notification[]> {
        return this.notificationsService.getUserNotifications(user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get notification by ID' })
    @ApiResponse({
        status: 200,
        description: 'Notification status updated successfully',
        type: Notification,
    })
    async getNotificationById(
        @Param('id') id: string,
        @CurrentUser() user: User,
    ): Promise<Notification> {
        return this.notificationsService.getNotificationById(id, user.id);
    }
}

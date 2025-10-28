import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { Notification } from '../../entities/notification.entity';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification, Event, Order]),
        ScheduleModule.forRoot(),
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, EmailService],
    exports: [NotificationsService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from 'src/entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NotificationsModule } from '../notification/notifications.module';
import { TicketsValidationService } from './tickets.validation.service';

@Module({
    imports: [TypeOrmModule.forFeature([Ticket]), NotificationsModule],
    controllers: [TicketsController],
    providers: [TicketsService, TicketsValidationService],
    exports: [TicketsService, TicketsValidationService],
})
export class TicketsModule {}

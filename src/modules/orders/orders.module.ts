import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Ticket } from 'src/entities/ticket.entity';
import { Event } from 'src/entities/event.entity';
import { User } from 'src/entities/user.entity';
import { XenditModule } from '../xendit/xendit.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Order, Ticket, Event, User]),
        XenditModule,
        forwardRef(() => TicketsModule),
        NotificationsModule,
    ],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule {}

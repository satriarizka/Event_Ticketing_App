import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventCategoryModule } from './modules/event-categories/event-categories.module';
import { EventsModule } from './modules/events/events.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import typeormConfig from './config/typeorm.config';
import { XenditModule } from './modules/xendit/xendit.module';
import { Order } from './entities/order.entity';
import { Notification } from './entities/notification.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),

        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: typeormConfig,
        }),

        UsersModule,

        AuthModule,

        EventCategoryModule,

        EventsModule,

        XenditModule,

        TypeOrmModule.forFeature([Order, Notification]),

        ScheduleModule.forRoot(),

        OrdersModule,

        TicketsModule,

        NotificationsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/user/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventCategoryModule } from './modules/event-category/event-categories.module';
import { EventsModule } from './modules/event/events.module';
import { OrdersModule } from './modules/order/orders.module';
import { TicketsModule } from './modules/ticket/tickets.module';
import { NotificationsModule } from './modules/notification/notifications.module';
import typeormConfig from './config/typeorm.config';
import { XenditModule } from './modules/xendit/xendit.module';
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

        ScheduleModule.forRoot(),

        OrdersModule,

        TicketsModule,

        NotificationsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

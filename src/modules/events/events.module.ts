import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../entities/event.entity';
import { EventCategory } from '../../entities/event-category.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Event, EventCategory])],
    providers: [EventsService],
    controllers: [EventsController],
})
export class EventsModule {}

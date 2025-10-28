import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCategory } from 'src/entities/event-category.entity';
import { EventCategoryService } from './event-categories.service';
import { EventCategoryController } from './event-categories.controller';

@Module({
    imports: [TypeOrmModule.forFeature([EventCategory])],
    controllers: [EventCategoryController],
    providers: [EventCategoryService],
    exports: [EventCategoryService],
})
export class EventCategoryModule {}

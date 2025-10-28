import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../entities/event.entity';
import { EventCategory } from '../../entities/event-category.entity';
import { User } from '../../entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(Event)
        private readonly eventRepo: Repository<Event>,

        @InjectRepository(EventCategory)
        private readonly categoryRepo: Repository<EventCategory>,
    ) {}

    async create(dto: CreateEventDto, creator: User): Promise<Event> {
        const category = dto.categoryId
            ? await this.categoryRepo.findOne({ where: { id: dto.categoryId } })
            : null;

        if (dto.categoryId && !category) {
            throw new NotFoundException(`Category not found`);
        }

        const event = this.eventRepo.create({
            ...dto,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            category,
            createdBy: creator,
        });

        if (new Date(dto.endDate) <= new Date(dto.startDate)) {
            throw new BadRequestException('End date must be after start date');
        }

        return this.eventRepo.save(event);
    }

    async findAll(): Promise<Event[]> {
        return this.eventRepo.find({
            relations: ['category', 'createdBy'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Event> {
        const event = await this.eventRepo.findOne({
            where: { id },
            relations: ['category', 'createdBy'],
        });

        if (!event) throw new NotFoundException(`Event not found`);
        return event;
    }

    async update(id: string, dto: UpdateEventDto): Promise<Event> {
        const event = await this.findOne(id);

        if (dto.categoryId) {
            const category = await this.categoryRepo.findOne({
                where: { id: dto.categoryId },
            });
            if (!category) throw new NotFoundException(`Category not found`);
            event.category = category;
        }

        const { ...safeUpdate } = dto;

        if (dto.startDate) event.startDate = new Date(dto.startDate);
        if (dto.endDate) event.endDate = new Date(dto.endDate);

        Object.assign(event, safeUpdate);
        return this.eventRepo.save(event);
    }

    async remove(id: string): Promise<{ message: string }> {
        const event = await this.findOne(id);
        await this.eventRepo.remove(event);
        return { message: `Event "${event.title}" deleted successfully` };
    }

    async togglePublish(
        id: string,
        publish: boolean,
    ): Promise<{ message: string }> {
        const event = await this.findOne(id);
        event.isPublished = publish;
        await this.eventRepo.save(event);

        const status = publish ? 'published' : 'unpublished';
        return { message: `Event "${event.title}" has been ${status}` };
    }

    async findPublic(
        categoryId?: string,
        search?: string,
        page = 1,
        limit = 10,
    ): Promise<{ data: Event[]; total: number; page: number; limit: number }> {
        const query = this.eventRepo
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.category', 'category')
            .leftJoin('event.createdBy', 'createdBy')
            .where('event.isPublished = :isPublished', { isPublished: true });

        if (categoryId) {
            query.andWhere('category.id = :categoryId', { categoryId });
        }

        if (search) {
            query.andWhere(
                '(LOWER(event.title) LIKE LOWER(:search) OR LOWER(event.description) LIKE LOWER(:search))',
                { search: `%${search}%` },
            );
        }

        query
            .orderBy('event.startDate', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        query.addSelect(['createdBy.id', 'createdBy.name']);

        const [data, total] = await query.getManyAndCount();

        const transformedData = data.map((event) => ({
            ...event,
            price: parseFloat(String(event.price)),
        }));

        return { data: transformedData, total, page, limit };
    }

    async findPublicById(id: string): Promise<Event> {
        const event = await this.eventRepo.findOne({
            where: { id, isPublished: true },
            relations: ['category', 'createdBy'],
        });

        if (!event) throw new NotFoundException('Public event not found');
        return event;
    }
}

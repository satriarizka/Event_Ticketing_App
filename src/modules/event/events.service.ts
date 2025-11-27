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

// Type for sanitized user (without passwordHash)
type SanitizedUser = Omit<User, 'passwordHash'>;

// Type for event with sanitized createdBy
type SanitizedEvent = Omit<Event, 'createdBy'> & {
    createdBy: SanitizedUser | null;
};

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(Event)
        private readonly eventRepo: Repository<Event>,

        @InjectRepository(EventCategory)
        private readonly categoryRepo: Repository<EventCategory>,
    ) {}

    /**
     * Helper to sanitize user data (remove passwordHash)
     */
    private sanitizeUser(user: User | null): SanitizedUser | null {
        if (!user) return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    /**
     * Helper to sanitize event data (remove passwordHash from createdBy)
     */
    private sanitizeEvent(event: Event): SanitizedEvent {
        return {
            ...event,
            createdBy: this.sanitizeUser(event.createdBy),
        };
    }

    /**
     * Helper to sanitize array of events
     */
    private sanitizeEvents(events: Event[]): SanitizedEvent[] {
        return events.map((event) => this.sanitizeEvent(event));
    }

    async create(dto: CreateEventDto, creator: User): Promise<SanitizedEvent> {
        const category = dto.categoryId
            ? await this.categoryRepo.findOne({ where: { id: dto.categoryId } })
            : null;

        if (dto.categoryId && !category) {
            throw new NotFoundException(`Category not found`);
        }

        if (new Date(dto.endDate) <= new Date(dto.startDate)) {
            throw new BadRequestException('End date must be after start date');
        }

        const event = this.eventRepo.create({
            ...dto,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            category,
            createdBy: creator,
        });

        const savedEvent = await this.eventRepo.save(event);
        return this.sanitizeEvent(savedEvent);
    }

    async findAll(): Promise<SanitizedEvent[]> {
        const events = await this.eventRepo.find({
            relations: ['category', 'createdBy'],
            order: { createdAt: 'DESC' },
        });
        return this.sanitizeEvents(events);
    }

    async findOne(id: string): Promise<SanitizedEvent> {
        const event = await this.eventRepo.findOne({
            where: { id },
            relations: ['category', 'createdBy'],
        });

        if (!event) throw new NotFoundException(`Event not found`);
        return this.sanitizeEvent(event);
    }

    async update(id: string, dto: UpdateEventDto): Promise<SanitizedEvent> {
        const event = await this.eventRepo.findOne({
            where: { id },
            relations: ['category', 'createdBy'],
        });

        if (!event) throw new NotFoundException(`Event not found`);

        if (dto.categoryId) {
            const category = await this.categoryRepo.findOne({
                where: { id: dto.categoryId },
            });
            if (!category) throw new NotFoundException(`Category not found`);
            event.category = category;
        }

        if (dto.startDate) event.startDate = new Date(dto.startDate);
        if (dto.endDate) event.endDate = new Date(dto.endDate);
        if (dto.title) event.title = dto.title;
        if (dto.description) event.description = dto.description;
        if (dto.location) event.location = dto.location;
        if (dto.price !== undefined) event.price = dto.price;

        const updatedEvent = await this.eventRepo.save(event);
        return this.sanitizeEvent(updatedEvent);
    }

    async remove(id: string): Promise<{ message: string }> {
        const event = await this.eventRepo.findOne({
            where: { id },
            relations: ['category'],
        });

        if (!event) throw new NotFoundException(`Event not found`);

        const title = event.title;
        await this.eventRepo.remove(event);
        return { message: `Event "${title}" deleted successfully` };
    }

    async togglePublish(
        id: string,
        publish: boolean,
    ): Promise<{ message: string }> {
        const event = await this.eventRepo.findOne({ where: { id } });

        if (!event) throw new NotFoundException(`Event not found`);

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
    ): Promise<{
        data: SanitizedEvent[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const query = this.eventRepo
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.category', 'category')
            .leftJoin('event.createdBy', 'createdBy')
            .addSelect([
                'createdBy.id',
                'createdBy.name',
                'createdBy.email',
                'createdBy.role',
            ])
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

        const [data, total] = await query.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        // Transform and sanitize data
        const transformedData = data.map((event) => ({
            ...event,
            price: parseFloat(String(event.price)),
            createdBy: event.createdBy
                ? {
                      id: event.createdBy.id,
                      name: event.createdBy.name,
                      email: event.createdBy.email,
                      role: event.createdBy.role,
                  }
                : null,
        }));

        return {
            data: transformedData as SanitizedEvent[],
            total,
            page,
            limit,
            totalPages,
        };
    }

    async findPublicById(id: string): Promise<SanitizedEvent> {
        const event = await this.eventRepo.findOne({
            where: { id, isPublished: true },
            relations: ['category', 'createdBy'],
        });

        if (!event) throw new NotFoundException('Public event not found');
        return this.sanitizeEvent(event);
    }

    /**
     * Find all events with pagination (for admin)
     */
    async findAllWithPagination(
        page: number,
        limit: number,
    ): Promise<{
        data: SanitizedEvent[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        const skip = (page - 1) * limit;

        const [events, total] = await this.eventRepo.findAndCount({
            relations: ['category', 'createdBy'],
            order: {
                createdAt: 'DESC',
            },
            skip,
            take: limit,
        });

        const totalPages = Math.ceil(total / limit);

        return {
            data: this.sanitizeEvents(events),
            meta: {
                total,
                page,
                limit,
                totalPages,
            },
        };
    }
}

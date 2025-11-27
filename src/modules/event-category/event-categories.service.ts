import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCategory } from 'src/entities/event-category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from 'src/modules/event-category/dto/update-category.dto';

@Injectable()
export class EventCategoryService {
    constructor(
        @InjectRepository(EventCategory)
        private readonly categoryRepo: Repository<EventCategory>,
    ) {}

    async create(dto: CreateCategoryDto): Promise<EventCategory> {
        const existing = await this.categoryRepo.findOne({
            where: { name: dto.name },
        });
        if (existing) {
            throw new BadRequestException(
                `Category "${dto.name}" already exists`,
            );
        }

        const category = this.categoryRepo.create(dto);
        return await this.categoryRepo.save(category);
    }

    async findAll(): Promise<EventCategory[]> {
        return await this.categoryRepo.find();
    }

    async findOne(id: string): Promise<EventCategory> {
        const category = await this.categoryRepo.findOne({ where: { id } });
        if (!category) throw new NotFoundException('Category not found');
        return category;
    }

    async update(id: string, dto: UpdateCategoryDto): Promise<EventCategory> {
        const category = await this.findOne(id);
        if (dto.name && dto.name !== category.name) {
            const existing = await this.categoryRepo.findOne({
                where: { name: dto.name },
            });
            if (existing) {
                throw new BadRequestException(
                    `Category name "${dto.name}" already exists`,
                );
            }
        }
        Object.assign(category, dto);
        return await this.categoryRepo.save(category);
    }

    async remove(id: string): Promise<{ message: string }> {
        const category = await this.findOne(id);
        await this.categoryRepo.remove(category);
        return { message: `Category "${category.name}" deleted successfully` };
    }
}

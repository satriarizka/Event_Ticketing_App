import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';

@Injectable()
export class TicketsValidationService {
    private readonly logger = new Logger(TicketsValidationService.name);

    constructor(
        @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
    ) {}

    async validateTicket(id: string): Promise<Ticket> {
        const ticket = await this.ticketsRepo.findOne({
            where: { id },
            relations: ['event', 'order', 'order.user'],
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (ticket.isUsed) {
            throw new BadRequestException(`Ticket ${id} is already used`);
        }

        return ticket;
    }

    async validateTicketCode(ticketCode: string): Promise<Ticket> {
        const ticket = await this.ticketsRepo.findOne({
            where: { ticketCode },
            relations: ['event', 'order', 'order.user'],
        });

        if (!ticket) {
            throw new NotFoundException(
                `Ticket with code ${ticketCode} not found`,
            );
        }

        if (ticket.isUsed) {
            throw new BadRequestException(
                `Ticket with code ${ticketCode} is already used`,
            );
        }

        return ticket;
    }

    async checkTicket(id: string): Promise<Ticket> {
        const ticket = await this.ticketsRepo.findOne({
            where: { id },
            relations: ['event', 'order', 'order.user'],
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        return ticket;
    }
}

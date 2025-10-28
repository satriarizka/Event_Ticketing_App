import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
    Res,
    NotFoundException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TicketsService } from './tickets.service';
import { Ticket } from '../../entities/ticket.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { join } from 'path';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
    private readonly logger = new Logger(TicketsController.name);

    constructor(private readonly ticketsService: TicketsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all tickets for the current user' })
    @ApiResponse({
        status: 200,
        description: 'Tickets retrieved successfully',
        type: [Ticket],
    })
    async findAll(@CurrentUser() user: User): Promise<Ticket[]> {
        return this.ticketsService.getTicketsByUserId(user.id);
    }

    @Get('order/:orderId')
    @ApiOperation({ summary: 'Get all tickets for a specific order' })
    @ApiResponse({
        status: 200,
        description: 'Tickets retrieved successfully',
        type: [Ticket],
    })
    async findByOrderId(
        @Param('orderId') orderId: string,
        @CurrentUser() user: User,
    ): Promise<Ticket[]> {
        return this.ticketsService.getTicketsByOrderId(orderId, user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific ticket by ID' })
    @ApiResponse({
        status: 200,
        description: 'Ticket retrieved successfully',
        type: Ticket,
    })
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: User,
    ): Promise<Ticket> {
        const ticket = await this.ticketsService.getTicketById(id);

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (ticket.order.user.id !== user.id) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        return ticket;
    }

    @Get('download/:ticketId')
    @ApiOperation({ summary: 'Download a ticket PDF' })
    @ApiResponse({ status: 200, description: 'PDF downloaded successfully' })
    async downloadTicket(
        @Param('ticketId') ticketId: string,
        @CurrentUser() user: User,
        @Res() res: Response,
    ): Promise<void> {
        const ticket = await this.ticketsService.getTicketById(ticketId);

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        }

        if (ticket.order.user.id !== user.id) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        }

        if (!ticket.pdfUrl) {
            throw new NotFoundException(`PDF for ticket ${ticketId} not found`);
        }

        const pdfPath = join(process.cwd(), 'uploads', ticket.pdfUrl);
        res.download(pdfPath, `ticket-${ticket.ticketCode}.pdf`);
    }

    @Get(':id/qr')
    @ApiOperation({ summary: 'Get QR code for a ticket' })
    @ApiResponse({ status: 200, description: 'QR code retrieved successfully' })
    async getQRCode(
        @Param('id') id: string,
        @CurrentUser() user: User,
        @Res() res: Response,
    ): Promise<void> {
        const ticket = await this.ticketsService.getTicketById(id);

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (ticket.order.user.id !== user.id) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (!ticket.qrCodeUrl) {
            throw new NotFoundException(`QR code for ticket ${id} not found`);
        }

        const qrCodePath = join(process.cwd(), 'uploads', ticket.qrCodeUrl);
        res.sendFile(qrCodePath);
    }

    @Get(':id/pdf')
    @ApiOperation({ summary: 'Get PDF for a ticket' })
    @ApiResponse({ status: 200, description: 'PDF retrieved successfully' })
    async getPDF(
        @Param('id') id: string,
        @CurrentUser() user: User,
        @Res() res: Response,
    ): Promise<void> {
        const ticket = await this.ticketsService.getTicketById(id);

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (ticket.order.user.id !== user.id) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (!ticket.pdfUrl) {
            throw new NotFoundException(`PDF for ticket ${id} not found`);
        }

        const pdfPath = join(process.cwd(), 'uploads', ticket.pdfUrl);
        res.sendFile(pdfPath);
    }

    @Post(':id/validate')
    @ApiOperation({ summary: 'Validate a ticket (mark as used)' })
    @ApiResponse({
        status: 200,
        description: 'Ticket validated successfully',
        type: 'object',
    })
    async validateTicket(
        @Param('id') id: string,
        @CurrentUser() user: User,
    ): Promise<{ message: string }> {
        try {
            const ticket = await this.ticketsService.getTicketById(id);

            if (!ticket) {
                throw new NotFoundException(`Ticket with ID ${id} not found`);
            }

            if (ticket.order.user.id !== user.id) {
                throw new NotFoundException(`Ticket with ID ${id} not found`);
            }

            if (ticket.isUsed) {
                throw new BadRequestException(`Ticket ${id} is already used`);
            }

            await this.ticketsService.markTicketAsUsed(id);

            return { message: 'Ticket validated successfully' };
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }
            throw new BadRequestException('Failed to validate ticket');
        }
    }

    @Get(':id/check')
    @ApiOperation({ summary: 'Check if a ticket is valid' })
    @ApiResponse({
        status: 200,
        description: 'Ticket validation result',
        type: 'object',
    })
    async checkTicket(
        @Param('path') id: string,
        @CurrentUser() user: User,
    ): Promise<{ isValid: boolean; isUsed: boolean }> {
        try {
            const ticket = await this.ticketsService.getTicketById(id);

            if (!ticket) {
                return { isValid: false, isUsed: false };
            }

            if (ticket.order.user.id !== user.id) {
                return { isValid: false, isUsed: false };
            }

            return { isValid: true, isUsed: ticket.isUsed };
        } catch (error) {
            return { isValid: false, isUsed: false };
        }
    }
}

import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
    Res,
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
import { TicketsService } from 'src/modules/tickets/tickets.service';
import { TicketsValidationService } from 'src/modules/tickets/tickets.validation.service';
import { Ticket } from 'src/entities/ticket.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/entities/user.entity';
import { join } from 'path';
import * as common from '@nestjs/common';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/tickets')
export class AdminTicketsController {
    private readonly logger = new Logger(AdminTicketsController.name);

    constructor(
        private readonly ticketsService: TicketsService,
        private readonly ticketsValidationService: TicketsValidationService,
    ) {}

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

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific ticket by ID' })
    @ApiResponse({
        status: 200,
        description: 'Ticket retrieved successfully',
        type: Ticket,
    })
    async findOne(
        @Param('path') id: string,
        @CurrentUser() user: User,
    ): Promise<Ticket> {
        const ticket = await this.ticketsService.getTicketById(id);

        if (!ticket) {
            throw new common.NotFoundException(
                `Ticket with ID ${id} not found`,
            );
        }

        if (ticket.order.user.id !== user.id) {
            throw new common.NotFoundException(
                `Ticket with ID ${id} not found`,
            );
        }

        return ticket;
    }

    @Get(':id/qr')
    @ApiOperation({ summary: 'Get QR code for a ticket' })
    @ApiResponse({
        status: 200,
        description: 'QR code retrieved successfully',
    })
    async getQRCode(
        @Param('path') id: string,
        @CurrentUser() user: User,
        @Res() res: Response,
    ): Promise<void> {
        const ticket = await this.ticketsService.getTicketById(id);

        if (!ticket) {
            throw new common.NotFoundException(
                `Ticket with ID ${id} not found`,
            );
        }

        if (ticket.order.user.id !== user.id) {
            throw new common.NotFoundException(
                `Ticket with ID ${id} not found`,
            );
        }

        if (!ticket.qrCodeUrl) {
            throw new common.NotFoundException(
                `QR code for ticket ${id} not found`,
            );
        }

        const qrCodePath = join(process.cwd(), 'uploads', ticket.qrCodeUrl);
        res.sendFile(qrCodePath);
    }

    @Get(':id/pdf')
    @ApiOperation({ summary: 'Get PDF for a ticket' })
    @ApiResponse({
        status: 200,
        description: 'PDF retrieved successfully',
    })
    async getPDF(
        @Param('path') id: string,
        @CurrentUser() user: User,
        @Res() res: Response,
    ): Promise<void> {
        const ticket = await this.ticketsService.getTicketById(id);

        if (!ticket) {
            throw new common.NotFoundException(
                `Ticket with ID ${id} not found`,
            );
        }

        if (ticket.order.user.id !== user.id) {
            throw new common.NotFoundException(
                `Ticket with ID ${id} not found`,
            );
        }

        if (!ticket.pdfUrl) {
            throw new common.NotFoundException(
                `PDF for ticket ${id} not found`,
            );
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
        @Param('path') id: string,
        @CurrentUser() user: User,
    ): Promise<{ message: string }> {
        try {
            const ticket =
                await this.ticketsValidationService.validateTicket(id);

            if (ticket.order.user.id !== user.id) {
                throw new common.NotFoundException(
                    `Ticket with ID ${id} not found`,
                );
            }

            await this.ticketsService.markTicketAsUsed(id);

            return { message: 'Ticket validated successfully' };
        } catch (error) {
            if (
                error instanceof common.NotFoundException ||
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
            const ticket = await this.ticketsValidationService.checkTicket(id);

            if (ticket.order.user.id !== user.id) {
                return { isValid: false, isUsed: false };
            }

            return { isValid: true, isUsed: ticket.isUsed };
        } catch (error) {
            return { isValid: false, isUsed: false };
        }
    }

    @Get('scan/:ticketCode')
    @ApiOperation({ summary: 'Scan a ticket by ticket code' })
    @ApiResponse({
        status: 200,
        description: 'Ticket found',
        type: Ticket,
    })
    async scanTicket(
        @Param('path') ticketCode: string,
        @CurrentUser() user: User,
    ): Promise<Ticket> {
        const ticket =
            await this.ticketsValidationService.validateTicketCode(ticketCode);

        if (ticket.order.user.id !== user.id) {
            throw new common.NotFoundException(
                `Ticket with code ${ticketCode} not found`,
            );
        }

        return ticket;
    }
}

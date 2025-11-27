import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    Res,
    NotFoundException,
    Logger,
    BadRequestException,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TicketsService } from './tickets.service';
import { TicketsValidationService } from './tickets.validation.service';
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

    constructor(
        private readonly ticketsService: TicketsService,
        private readonly ticketsValidationService: TicketsValidationService,
    ) {}

    @Get()
    @ApiOperation({
        summary: 'Get all tickets for the current user with pagination',
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiResponse({
        status: 200,
        description: 'Tickets retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Ticket' },
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        totalPages: { type: 'number' },
                    },
                },
            },
        },
    })
    async findAll(
        @CurrentUser() user: User,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ): Promise<{
        data: Ticket[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        // Validate pagination parameters
        if (page < 1) {
            throw new BadRequestException('Page must be greater than 0');
        }
        if (limit < 1 || limit > 100) {
            throw new BadRequestException('Limit must be between 1 and 100');
        }

        return this.ticketsService.getTicketsByUserIdWithPagination(
            user.id,
            page,
            limit,
        );
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

    @Get('scan/:ticketCode')
    @ApiOperation({ summary: 'Scan a ticket by ticket code' })
    @ApiResponse({
        status: 200,
        description: 'Ticket found',
        type: Ticket,
    })
    async scanTicket(
        @Param('ticketCode') ticketCode: string,
        @CurrentUser() user: User,
    ): Promise<Ticket> {
        const ticket =
            await this.ticketsValidationService.validateTicketCode(ticketCode);

        if (ticket.order.user.id !== user.id) {
            throw new NotFoundException(
                `Ticket with code ${ticketCode} not found`,
            );
        }

        return ticket;
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

    @Get(':id/qr')
    @ApiOperation({ summary: 'Get QR code for a ticket' })
    @ApiResponse({
        status: 200,
        description: 'QR code retrieved successfully',
    })
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
    @ApiResponse({
        status: 200,
        description: 'PDF retrieved successfully',
    })
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

    @Get('download/:ticketId')
    @ApiOperation({ summary: 'Download a ticket PDF' })
    @ApiResponse({
        status: 200,
        description: 'PDF downloaded successfully',
    })
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
            const ticket =
                await this.ticketsValidationService.validateTicket(id);

            if (ticket.order.user.id !== user.id) {
                throw new NotFoundException(`Ticket with ID ${id} not found`);
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
        @Param('id') id: string,
        @CurrentUser() user: User,
    ): Promise<{ isValid: boolean; isUsed: boolean }> {
        try {
            const ticket = await this.ticketsValidationService.checkTicket(id);

            if (ticket.order.user.id !== user.id) {
                return { isValid: false, isUsed: false };
            }

            return { isValid: true, isUsed: ticket.isUsed };
        } catch {
            // Error is intentionally ignored - return invalid status
            return { isValid: false, isUsed: false };
        }
    }
}

import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Ticket } from '../../entities/ticket.entity';
import { Order } from '../../entities/order.entity';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../notification/notifications.service';
import { User } from 'src/entities/user.entity';

@Injectable()
export class TicketsService {
    private readonly logger = new Logger(TicketsService.name);
    private readonly uploadsDir = join(process.cwd(), 'uploads');

    constructor(
        @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
        private readonly notificationsService: NotificationsService,
    ) {
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    async createTicketsForOrder(order: Order): Promise<Ticket[]> {
        try {
            this.logger.log(
                `Creating ${order.quantity} tickets for order ${order.id}`,
            );

            if (!order.user || !order.event) {
                this.logger.error(
                    `Order ${order.id} is missing user or event relations.`,
                );
                throw new Error('Order data is incomplete.');
            }

            // Create tickets array with proper typing
            const ticketsToCreate: Partial<Ticket>[] = [];

            for (let i = 0; i < order.quantity; i++) {
                const ticketCode = this.generateTicketCode();

                // Generate QR code
                const qrCodeFileName = await this.generateQRCode(ticketCode);

                // Create ticket object
                const ticketData: Partial<Ticket> = {
                    id: uuidv4(),
                    ticketCode,
                    event: order.event,
                    order: order,
                    isUsed: false,
                    issuedAt: new Date(),
                    qrCodeUrl: qrCodeFileName,
                };

                ticketsToCreate.push(ticketData);
            }

            // Save all tickets at once
            const savedTickets = await this.ticketsRepo.save(
                ticketsToCreate as Ticket[],
            );

            // Generate PDFs for all tickets
            const pdfPromises = savedTickets.map(async (ticket) => {
                const pdfFileName = await this.generatePDF(ticket, order.user);
                ticket.pdfUrl = pdfFileName;
                return ticket;
            });

            const ticketsWithPdf = await Promise.all(pdfPromises);

            // Save tickets with PDF URLs
            const finalTickets = await this.ticketsRepo.save(ticketsWithPdf);

            this.logger.log(
                `Successfully created ${finalTickets.length} tickets for order ${order.id}`,
            );

            // Send notifications
            await this.notificationsService.sendTicketEmail(
                order.user,
                order,
                finalTickets,
            );

            await this.notificationsService.scheduleEventReminder(
                order.user,
                order.event,
            );

            return finalTickets;
        } catch (error) {
            this.logger.error(
                `Failed to create tickets for order ${order.id}:`,
                error,
            );
            throw error;
        }
    }

    private async generateQRCode(ticketCode: string): Promise<string> {
        try {
            const qrCodeFileName = `qr-${ticketCode}.png`;
            const qrCodePath = join(this.uploadsDir, qrCodeFileName);

            await QRCode.toFile(qrCodePath, ticketCode, {
                width: 200,
                margin: 1,
                color: { dark: '#000000', light: '#FFFFFF' },
            });

            this.logger.log(`Generated QR code for ticket ${ticketCode}`);
            return qrCodeFileName;
        } catch (error) {
            this.logger.error(
                `Failed to generate QR code for ticket ${ticketCode}:`,
                error,
            );
            throw error;
        }
    }

    private async generatePDF(ticket: Ticket, user: User): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            try {
                const pdfFileName = `ticket-${ticket.ticketCode}.pdf`;
                const pdfPath = join(this.uploadsDir, pdfFileName);

                const doc = new PDFDocument();
                const stream = fs.createWriteStream(pdfPath);
                doc.pipe(stream);

                doc.fontSize(20).text('Event Ticket', { align: 'center' });
                doc.moveDown();
                doc.fontSize(14).text(`Event: ${ticket.event.title}`);
                doc.text(
                    `Date: ${new Date(ticket.event.startDate).toLocaleDateString()}`,
                );
                doc.text(
                    `Time: ${new Date(ticket.event.startDate).toLocaleTimeString()}`,
                );
                doc.text(`Location: ${ticket.event.location}`);
                doc.moveDown();
                doc.text(`Ticket Code: ${ticket.ticketCode}`);
                doc.text(`Attendee: ${user.name || user.email}`);
                doc.moveDown();

                const qrCodePath = join(this.uploadsDir, ticket.qrCodeUrl);
                if (fs.existsSync(qrCodePath)) {
                    doc.image(qrCodePath, {
                        fit: [150, 150],
                        align: 'center',
                    });
                }
                doc.end();

                stream.on('finish', () => {
                    this.logger.log(
                        `Generated PDF for ticket ${ticket.ticketCode}`,
                    );
                    resolve(pdfFileName);
                });

                stream.on('error', (error: Error) => {
                    this.logger.error(
                        `Failed to write PDF for ticket ${ticket.ticketCode}:`,
                        error,
                    );
                    reject(error);
                });
            } catch (error) {
                this.logger.error(
                    `Failed to generate PDF for ticket ${ticket.ticketCode}:`,
                    error,
                );
                reject(
                    error instanceof Error
                        ? error
                        : new Error('Unknown error during PDF generation'),
                );
            }
        });
    }

    async getTicketById(id: string): Promise<Ticket> {
        return this.ticketsRepo.findOne({
            where: { id },
            relations: ['event', 'order', 'order.user'],
        });
    }

    async getTicketsByUserId(userId: string): Promise<Ticket[]> {
        return this.ticketsRepo.find({
            where: { order: { user: { id: userId } } },
            relations: ['event', 'order', 'order.user'],
            order: { issuedAt: 'DESC' },
        });
    }

    async getTicketsByOrderId(
        orderId: string,
        userId: string,
    ): Promise<Ticket[]> {
        return this.ticketsRepo.find({
            where: {
                order: {
                    id: orderId,
                    user: { id: userId },
                },
            },
            relations: ['event', 'order', 'order.user'],
            order: { issuedAt: 'DESC' },
        });
    }

    async markTicketAsUsed(id: string): Promise<void> {
        const ticket = await this.ticketsRepo.findOneBy({ id });
        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (ticket.isUsed) {
            throw new BadRequestException(`Ticket ${id} is already used`);
        }

        ticket.isUsed = true;
        ticket.usedAt = new Date();

        await this.ticketsRepo.save(ticket);
        this.logger.log(`Ticket ${id} marked as used`);
    }

    private generateTicketCode(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 8);
        return `TKT-${timestamp}-${randomPart}`.toUpperCase();
    }

    async getTicketsByUserIdWithPagination(
        userId: string,
        page: number,
        limit: number,
    ): Promise<{
        data: Ticket[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        const skip = (page - 1) * limit;

        const [tickets, total] = await this.ticketsRepo.findAndCount({
            where: {
                order: {
                    user: {
                        id: userId,
                    },
                },
            },
            relations: ['event', 'order', 'order.user'],
            order: {
                issuedAt: 'DESC',
            },
            skip,
            take: limit,
        });

        const totalPages = Math.ceil(total / limit);

        return {
            data: tickets,
            meta: {
                total,
                page,
                limit,
                totalPages,
            },
        };
    }
}

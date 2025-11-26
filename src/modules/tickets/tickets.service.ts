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
import { NotificationsService } from '../notifications/notifications.service';
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

            const tickets = [];
            for (let i = 0; i < order.quantity; i++) {
                const ticket = new Ticket();
                ticket.id = uuidv4();
                ticket.ticketCode = this.generateTicketCode();
                ticket.event = order.event;
                ticket.order = order;
                ticket.isUsed = false;
                ticket.issuedAt = new Date();

                const qrCodeFileName = await this.generateQRCode(
                    ticket.ticketCode,
                );
                ticket.qrCodeUrl = qrCodeFileName;

                const pdfFileName = await this.generatePDF(ticket, order.user);
                ticket.pdfUrl = pdfFileName;

                tickets.push(ticket);
            }

            const savedTickets = await this.ticketsRepo.save(tickets);
            this.logger.log(
                `Successfully created ${savedTickets.length} tickets for order ${order.id}`,
            );

            await this.notificationsService.sendTicketEmail(
                order.user,
                order,
                savedTickets,
            );

            await this.notificationsService.scheduleEventReminder(
                order.user,
                order.event,
            );

            return savedTickets;
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
        return new Promise((resolve, reject) => {
            try {
                const pdfFileName = `ticket-${ticket.ticketCode}.pdf`;
                const pdfPath = join(this.uploadsDir, pdfFileName);

                const doc = new PDFDocument();
                const stream = fs.createWriteStream(pdfPath);
                doc.pipe(stream);

                doc.fontSize(20).text('Event Ticket', { align: 'center' });
                doc.moveDown();
                doc.fontSize(14).text(`Event: ${ticket.event.title}`);
                doc.text(`Date: ${new Date(ticket.event.startDate).toLocaleDateString()}`);
                doc.text(`Time: ${new Date(ticket.event.startDate).toLocaleTimeString()}`);
                doc.text(`Location: ${ticket.event.location}`);
                doc.moveDown();
                doc.text(`Ticket Code: ${ticket.ticketCode}`);
                doc.text(`Attendee: ${user.name || user.email}`); // Gunakan user dari order
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
                    this.logger.log(`Generated PDF for ticket ${ticket.ticketCode}`);
                    resolve(pdfFileName);
                });
                stream.on('error', (error) => reject(error));
            } catch (error) {
                this.logger.error(
                    `Failed to generate PDF for ticket ${ticket.ticketCode}:`,
                    error,
                );
                reject(error);
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
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';
import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';
import { Ticket } from '../../entities/ticket.entity';
import { User } from '../../entities/user.entity';
import { XenditService } from '../xendit/xendit.service';
import { XenditInvoiceResponse } from '../xendit/xendit.types';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);
    private readonly uploadsDir = join(process.cwd(), 'uploads');

    constructor(
        @InjectRepository(Order) private ordersRepo: Repository<Order>,
        @InjectRepository(Event) private eventsRepo: Repository<Event>,
        @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
        private xenditService: XenditService,
        private readonly notificationsService: NotificationsService,
    ) {
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    async create(createOrderDto: CreateOrderDto, user: User): Promise<Order> {
        const { id: userId } = user;
        const { eventId, quantity } = createOrderDto;

        const event = await this.validateEvent(eventId);

        const totalAmount = event.price * quantity;

        const orderId = uuidv4();

        const newOrder = this.ordersRepo.create({
            id: orderId,
            user: { id: userId },
            event: { id: event.id },
            quantity,
            originalPrice: event.price,
            totalAmount,
            paymentStatus: PaymentStatus.PENDING,
        });

        const savedOrder = await this.ordersRepo.save(newOrder);

        this.logger.log(`Saved order with ID: ${savedOrder.id}`);

        try {
            const response: XenditInvoiceResponse =
                await this.xenditService.createInvoice({
                    external_id: savedOrder.id,
                    payer_email: user.email,
                    description: `Purchase of ${quantity} ticket(s) for ${event.title}`,
                    amount: totalAmount,
                    success_redirect_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${savedOrder.id}`,
                    failure_redirect_url: `${process.env.FRONTEND_URL}/payment/failed?orderId=${savedOrder.id}`,
                });

            if (response && response.id) {
                savedOrder.paymentRef = response.id;
                await this.ordersRepo.save(savedOrder);

                this.logger.log(
                    `Order ${savedOrder.id} created with invoice ${response.id}`,
                );

                const orderWithInvoiceUrl = { ...savedOrder };
                (orderWithInvoiceUrl as any).invoiceUrl = response.invoice_url;

                // Jadwalkan timer kadaluarsa
                await this.notificationsService.sendOrderExpiryNotification(
                    savedOrder.id,
                );

                return orderWithInvoiceUrl as Order;
            } else {
                this.logger.error('Invalid response from Xendit:', response);
                throw new Error('Invalid response from payment provider');
            }
        } catch (xenditError) {
            this.logger.error('Failed to create Xendit Invoice:', xenditError);

            if (savedOrder) {
                await this.ordersRepo.delete(savedOrder.id);
            }

            throw new Error('Failed to process payment. Please try again.');
        }
    }

    async findAllForUser(user: User): Promise<Order[]> {
        return this.ordersRepo.find({
            where: { user: { id: user.id } },
            relations: ['event', 'tickets'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string, user: User): Promise<Order> {
        const order = await this.ordersRepo.findOne({
            where: { id, user: { id: user.id } },
            relations: ['event', 'tickets'],
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${id} not found.`);
        }

        return order;
    }

    async updateOrderStatus(
        orderId: string,
        status: PaymentStatus,
        paymentRef?: string,
    ): Promise<void> {
        if (!this.isValidUUID(orderId)) {
            this.logger.warn(
                `Webhook Error: Invalid UUID format for order ID: ${orderId}`,
            );
            return;
        }

        const order = await this.ordersRepo.findOneBy({ id: orderId });
        if (!order) {
            this.logger.warn(
                `Webhook Error: Order with ID ${orderId} not found`,
            );
            return;
        }

        if (order.paymentStatus === status) {
            this.logger.log(
                `Order ${orderId} is already in status ${status}. Skipping update.`,
            );
            return;
        }

        order.paymentStatus = status;
        if (paymentRef) {
            order.paymentRef = paymentRef;
        }

        await this.ordersRepo.save(order);

        this.logger.log(
            `Order ${order.id} status updated to ${status}. Payment Ref: ${paymentRef}`,
        );
    }

    async createTicketsForPaidOrder(orderId: string): Promise<void> {
        if (!this.isValidUUID(orderId)) {
            this.logger.warn(
                `Invalid UUID format for order ID: ${orderId}. Skipping ticket creation.`,
            );
            return;
        }

        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['event', 'user', 'tickets'],
        });

        if (!order) {
            this.logger.error(`Order ${orderId} not found for ticket creation`);
            return;
        }

        if (order.tickets && order.tickets.length > 0) {
            this.logger.log(`Tickets already exist for order ${orderId}`);
            return;
        }

        try {
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

            await this.ticketsRepo.save(tickets);

            await this.notificationsService.sendTicketEmail(
                order.user,
                order,
                tickets,
            );

            await this.notificationsService.scheduleEventReminder(
                order.user,
                order.event,
            );

            this.logger.log(
                `Created ${tickets.length} tickets for order ${orderId}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to create tickets for order ${orderId}:`,
                error,
            );
        }
    }

    private async generateQRCode(ticketCode: string): Promise<string> {
        try {
            const qrCodeFileName = `qr-${ticketCode}.png`;
            const qrCodePath = join(this.uploadsDir, qrCodeFileName);

            await QRCode.toFile(qrCodePath, ticketCode, {
                width: 200,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
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

    private async generatePDF(ticket: Ticket, user: any): Promise<string> {
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

                stream.on('error', (error) => {
                    this.logger.error(
                        `Failed to generate PDF for ticket ${ticket.ticketCode}:`,
                        error,
                    );
                    reject(error);
                });
            } catch (error) {
                this.logger.error(
                    `Failed to generate PDF for ticket ${ticket.ticketCode}:`,
                    error,
                );
                reject(error);
            }
        });
    }

    async findOrderById(id: string): Promise<Order> {
        const order = await this.ordersRepo.findOne({
            where: { id },
            relations: ['event', 'user', 'tickets'],
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${id} not found.`);
        }

        return order;
    }

    private async validateEvent(eventId: string): Promise<Event> {
        const event = await this.eventsRepo.findOneBy({ id: eventId });

        if (!event) {
            throw new NotFoundException(`Event with ID ${eventId} not found.`);
        }

        if (!event.isPublished) {
            throw new NotFoundException(
                `Event with ID ${eventId} is not yet available for purchase.`,
            );
        }

        return event;
    }

    private generateTicketCode(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 8);
        return `TKT-${timestamp}-${randomPart}`.toUpperCase();
    }

    private isValidUUID(uuid: string): boolean {
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}

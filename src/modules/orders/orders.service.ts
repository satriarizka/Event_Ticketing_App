import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';
import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';
import { User } from '../../entities/user.entity';
import { XenditService } from '../xendit/xendit.service';
import { XenditInvoiceResponse } from '../xendit/xendit.types';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../notifications/notifications.service';
import { isValidUUID } from 'src/common/utils/validation.utils';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        @InjectRepository(Order) private ordersRepo: Repository<Order>,
        @InjectRepository(Event) private eventsRepo: Repository<Event>,
        private xenditService: XenditService,
        private readonly notificationsService: NotificationsService,
        private readonly ticketsService: TicketsService,
    ) {}

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
        if (!isValidUUID(orderId)) {
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
        if (!isValidUUID(orderId)) {
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
            this.logger.log(
                `Delegating ticket creation for order ${orderId} to TicketsService.`,
            );
            await this.ticketsService.createTicketsForOrder(order);
        } catch (error) {
            this.logger.error(
                `Failed to create tickets for order ${orderId}:`,
                error,
            );
        }
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
}

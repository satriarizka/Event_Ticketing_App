import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { Notification } from '../../entities/notification.entity';
import { EmailService } from './email.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private readonly emailService: EmailService,
        @InjectRepository(Notification)
        private notificationsRepo: Repository<Notification>,
        @InjectRepository(Event)
        private eventsRepo: Repository<Event>,
        @InjectRepository(Order)
        private ordersRepo: Repository<Order>,
    ) {}

    async sendTicketEmail(
        user: User,
        order: Order,
        tickets: Ticket[],
    ): Promise<void> {
        const data = {
            userName: user.name || user.email,
            eventName: order.event.title,
            eventDate: new Date(order.event.startDate).toLocaleDateString(),
            eventTime: new Date(order.event.startDate).toLocaleTimeString(),
            eventLocation: order.event.location,
            ticketCodes: tickets.map((t) => t.ticketCode),
            orderTotal: order.totalAmount,
        };

        this.logger.log(`📧 Sending ticket email to ${user.email}`);
        await this.emailService.sendTicketEmail(user.email, user.id, data);
    }

    async scheduleEventReminder(user: User, event: Event): Promise<void> {
        const eventDate = new Date(event.startDate);
        const reminderTime = new Date(
            eventDate.getTime() - 24 * 60 * 60 * 1000,
        );

        if (reminderTime > new Date()) {
            this.logger.log(
                `⏰ Reminder scheduled for event ${event.id} at ${reminderTime}`,
            );
        }
    }

    @Cron('0 9 * * * *')
    async sendEventReminders(): Promise<void> {
        this.logger.log('🔔 Checking for event reminders...');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        const events = await this.eventsRepo.find({
            where: {
                startDate: Between(tomorrow, dayAfterTomorrow),
                isPublished: true,
            },
            relations: ['tickets', 'tickets.order', 'tickets.order.user'],
        });

        for (const event of events) {
            const usersMap = new Map<
                string,
                { user: User; tickets: Ticket[] }
            >();

            for (const ticket of event.tickets) {
                if (!usersMap.has(ticket.order.user.id)) {
                    usersMap.set(ticket.order.user.id, {
                        user: ticket.order.user,
                        tickets: [],
                    });
                }
                usersMap.get(ticket.order.user.id).tickets.push(ticket); // Changed from ticket.user to ticket.order.user
            }

            for (const [userId, { user, tickets }] of usersMap) {
                const data = {
                    userName: user.name || user.email,
                    eventName: event.title,
                    eventDate: new Date(event.startDate).toLocaleDateString(),
                    eventTime: new Date(event.startDate).toLocaleTimeString(),
                    eventLocation: event.location,
                    ticketCodes: tickets.map((t) => t.ticketCode),
                };

                this.logger.log(`Sending reminder email to ${user.email}`);
                await this.emailService.sendReminderEmail(
                    user.email,
                    user.id,
                    data,
                );
            }
        }

        this.logger.log(
            `Sent reminders for ${events.length} events on ${tomorrow.toDateString()}`,
        );
    }

    // Kirim email kadaluarsa order
    async sendOrderExpiryNotification(orderId: string): Promise<void> {
        this.logger.log(`Order expiry notification for order ${orderId}`);

        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['user', 'event'],
        });

        if (order) {
            const data = {
                userName: order.user.name || order.user.email,
                orderId: order.id,
                eventName: order.event.title,
                expiryDate: new Date().toISOString(),
            };

            await this.emailService.sendExpiryEmail(
                order.user.email,
                order.user.id,
                data,
            );
        }
    }

    async getUserNotifications(userId: string): Promise<Notification[]> {
        return this.notificationsRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    async getNotificationById(
        id: string,
        userId: string,
    ): Promise<Notification> {
        const notification = await this.notificationsRepo.findOne({
            where: { id, userId },
        });

        if (!notification) {
            throw new NotFoundException(`Notification with ID ${id} not found`);
        }

        return notification;
    }
}

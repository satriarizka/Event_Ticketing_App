import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { join } from 'path';
import * as fs from 'fs';
import { Notification } from '../../entities/notification.entity';
import {
    NotificationStatus,
    NotificationType,
} from '../../entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        @InjectRepository(Notification)
        private notificationsRepo: Repository<Notification>,
    ) {
        this.transporter = nodemailer.createTransport({
            host: 'localhost',
            port: 1025,
            secure: false,
            auth: false,
            tls: {
                rejectUnauthorized: false,
            },
        } as nodemailer.TransportOptions);

        if (process.env.NODE_ENV === 'production') {
            // TODO: akan diupdate dengan konfigurasi SMTP asli
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            } as nodemailer.TransportOptions);
        }
    }

    async sendTicketEmail(
        to: string,
        userId: string,
        data: any,
    ): Promise<void> {
        const htmlContent = this.loadTemplate('ticket.template.html', data);

        const notification = this.notificationsRepo.create({
            userId,
            type: NotificationType.EMAIL,
            subject: `Your Tickets for ${data.eventName}`,
            message: htmlContent,
            status: NotificationStatus.QUEUED,
        });

        const savedNotification =
            await this.notificationsRepo.save(notification);

        try {
            await this.transporter.sendMail({
                from: `"Event Ticketing" <${process.env.EMAIL_FROM || 'noreply@eventticketing.com'}>`,
                to,
                subject: `Your Tickets for ${data.eventName}`,
                html: htmlContent,
            });

            await this.notificationsRepo.update(savedNotification.id, {
                status: NotificationStatus.SENT,
            });

            this.logger.log(`Ticket email sent to ${to}`);
            this.logger.log(`Check Mailpit at http://localhost:8025`);
        } catch (error) {
            // Update status menjadi FAILED
            await this.notificationsRepo.update(savedNotification.id, {
                status: NotificationStatus.FAILED,
                message: error.message,
            });

            this.logger.error(`Failed to send ticket email: ${error.message}`);
            throw error;
        }
    }

    async sendReminderEmail(
        to: string,
        userId: string,
        data: any,
    ): Promise<void> {
        const htmlContent = this.loadTemplate('reminder.template.html', data);

        const notification = this.notificationsRepo.create({
            userId,
            type: NotificationType.REMINDER,
            subject: `Reminder: ${data.eventName} is tomorrow!`,
            message: this.loadTemplate('reminder.template.html', data),
            status: NotificationStatus.QUEUED,
        });

        const savedNotification =
            await this.notificationsRepo.save(notification);

        try {
            await this.transporter.sendMail({
                from: `"Event Ticketing" <${process.env.EMAIL_FROM || 'noreply@eventticketing.com'}>`,
                to,
                subject: `Reminder: ${data.eventName} is tomorrow!`,
                html: this.loadTemplate('reminder.template.html', data),
            });

            await this.notificationsRepo.update(savedNotification.id, {
                status: NotificationStatus.SENT,
            });

            this.logger.log(`Reminder email sent to ${to}`);
            this.logger.log(`Check Mailpit at http://localhost:8025`);
        } catch (error) {
            await this.notificationsRepo.update(savedNotification.id, {
                status: NotificationStatus.FAILED,
                message: error.message,
            });

            this.logger.error(
                `Failed to send reminder email: ${error.message}`,
            );
            throw error;
        }
    }

    async sendExpiryEmail(
        to: string,
        userId: string,
        data: any,
    ): Promise<void> {
        const htmlContent = this.loadTemplate('expiry.template.html', data);

        const notification = this.notificationsRepo.create({
            userId,
            type: NotificationType.EMAIL,
            subject: `Order Expired: ${data.eventName}`,
            message: htmlContent,
            status: NotificationStatus.QUEUED,
        });

        const savedNotification =
            await this.notificationsRepo.save(notification);

        try {
            await this.transporter.sendMail({
                from: `"Event Ticketing" <${process.env.EMAIL_FROM || 'noreply@eventticketing.com'}>`,
                to,
                subject: `Order Expired: ${data.eventName}`,
                html: htmlContent,
            });

            await this.notificationsRepo.update(savedNotification.id, {
                status: NotificationStatus.SENT,
            });

            this.logger.log(`Expiry email sent to ${to}`);
            this.logger.log(`Check Mailpit at http://localhost:8025`);
        } catch (error) {
            await this.notificationsRepo.update(savedNotification.id, {
                status: NotificationStatus.FAILED,
                message: error.message,
            });

            this.logger.error(`Failed to send expiry email: ${error.message}`);
            throw error;
        }
    }

    private loadTemplate(templateName: string, data: any): string {
        const templatePath = join(
            __dirname,
            '..',
            '..',
            '..',
            'src',
            'modules',
            'notifications',
            'templates',
            templateName,
        );

        if (!fs.existsSync(templatePath)) {
            this.logger.error(`Template not found: ${templatePath}`);

            if (templateName === 'expiry.template.html') {
                return `
                    <h1>Order Expired</h1>
                    <p>Dear ${data.userName},</p>
                    <p>Your order for ${data.eventName} has expired.</p>
                    <p>Order ID: ${data.orderId}</p>
                    <p>Expiry Date: ${new Date(data.expiryDate).toLocaleDateString()}</p>
                    <p>If you'd like to attend this event, please place a new order.</p>
                    <p>Thank you!</p>
                `;
            }

            return `<h1>Email Template Not Found</h1>`;
        }

        let template = fs.readFileSync(templatePath, 'utf8');

        for (const key in data) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, data[key]);
        }

        return template;
    }
}

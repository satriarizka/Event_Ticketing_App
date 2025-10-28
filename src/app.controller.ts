import {
    Controller,
    Post,
    Res,
    HttpStatus,
    Headers,
    Logger,
    ValidationPipe,
    Req,
    Body,
    Get,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { OrdersService } from './modules/orders/orders.service';
import { XenditService } from './modules/xendit/xendit.service';
import { PaymentStatus } from './common/enums/payment-status.enum';
import type { Response } from 'express';
import type { XenditInvoiceWebhookPayload } from './modules/xendit/xendit.types';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(
        private readonly appService: AppService,
        private readonly ordersService: OrdersService,
        private readonly xenditService: XenditService,
    ) {}

    @Get()
    getHello(): string {
        return 'Event Ticketing API is running!';
    }

    @Post('webhook')
    @ApiOperation({ summary: 'Handle Xendit payment webhook' })
    @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
    async handlePaymentWebhook(
        @Body(ValidationPipe) payload: XenditInvoiceWebhookPayload,
        @Headers('x-callback-token') callbackToken: string,
        @Res() res: Response,
        @Req() req: Request,
    ) {
        this.logger.log('Root webhook request URL:', req.url);
        this.logger.log('Root webhook request method:', req.method);
        this.logger.log(
            'Root webhook request headers:',
            JSON.stringify(req.headers, null, 2),
        );

        const expectedToken = this.xenditService.getWebhookToken();

        this.logger.log(
            'Received webhook payload at root:',
            JSON.stringify(payload, null, 2),
        );

        if (callbackToken !== expectedToken) {
            this.logger.error('Webhook received with invalid token.');
            return res.status(HttpStatus.UNAUTHORIZED).send('Invalid token');
        }

        this.logger.log(
            `Received webhook for order ${payload.external_id} with status ${payload.status}`,
        );

        if (!payload.external_id) {
            this.logger.error('Webhook payload missing external_id');
            return res
                .status(HttpStatus.BAD_REQUEST)
                .send('Missing external_id');
        }

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(payload.external_id)) {
            this.logger.warn(
                `Invalid UUID format for external_id: ${payload.external_id}. Ignoring webhook.`,
            );
            return res.status(HttpStatus.OK).send('Webhook received');
        }

        let newStatus: PaymentStatus;
        if (payload.status === 'PAID') {
            newStatus = PaymentStatus.PAID;
        } else if (payload.status === 'EXPIRED') {
            newStatus = PaymentStatus.EXPIRED;
        } else if (payload.status === 'PENDING') {
            newStatus = PaymentStatus.PENDING;
        } else {
            this.logger.log(
                `Received unhandled status: ${payload.status} for order ${payload.external_id}`,
            );
            return res.status(HttpStatus.OK).send('Webhook received');
        }

        await this.appService.updateOrderStatus(
            payload.external_id,
            newStatus,
            payload.id,
        );

        if (newStatus === PaymentStatus.PAID) {
            this.logger.log(
                `Payment successful for order ${payload.external_id} via ${payload.payment_method} at ${payload.paid_at}. Creating tickets.`,
            );
            await this.ordersService.createTicketsForPaidOrder(
                payload.external_id,
            );
        }

        res.status(HttpStatus.OK).send('Webhook received');
    }
}

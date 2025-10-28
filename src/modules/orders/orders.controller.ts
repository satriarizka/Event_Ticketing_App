import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Res,
    HttpStatus,
    Headers,
    Logger,
    ValidationPipe,
    Req,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';
import { XenditService } from '../xendit/xendit.service';
import type { Response } from 'express';
import type { XenditInvoiceWebhookPayload } from '../xendit/xendit.types';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    private readonly logger = new Logger(OrdersController.name);

    constructor(
        private readonly ordersService: OrdersService,
        private readonly xenditService: XenditService,
        private readonly notificationsService: NotificationsService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a new order' })
    @ApiResponse({
        status: 201,
        description: 'Order created successfully',
        type: Order,
    })
    async create(
        @Body() createOrderDto: CreateOrderDto,
        @CurrentUser() user: User,
    ): Promise<Order> {
        return this.ordersService.create(createOrderDto, user);
    }

    @Get('my')
    @ApiOperation({ summary: 'Get all orders for the current user' })
    @ApiResponse({
        status: 200,
        description: 'Orders retrieved successfully',
        type: [Order],
    })
    async findAllForUser(@CurrentUser() user: User): Promise<Order[]> {
        return this.ordersService.findAllForUser(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific order by ID' })
    @ApiResponse({
        status: 200,
        description: 'Order retrieved successfully',
        type: Order,
    })
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: User,
    ): Promise<Order> {
        return this.ordersService.findOne(id, user);
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
        this.logger.log('Webhook request URL:', req.url);
        this.logger.log('Webhook request method:', req.method);
        this.logger.log(
            'Webhook request headers:',
            JSON.stringify(req.headers, null, 2),
        );

        const expectedToken = this.xenditService.getWebhookToken();

        this.logger.log(
            'Received webhook payload:',
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

        await this.ordersService.updateOrderStatus(
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

            const order = await this.ordersService.findOrderById(
                payload.external_id,
            );

            if (order && order.tickets && order.tickets.length > 0) {
                await this.notificationsService.sendTicketEmail(
                    order.user,
                    order,
                    order.tickets,
                );

                await this.notificationsService.scheduleEventReminder(
                    order.user,
                    order.event,
                );
            }
        }

        res.status(HttpStatus.OK).send('Webhook received');
    }
}

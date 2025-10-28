import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { PaymentStatus } from './common/enums/payment-status.enum';

@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name);

    constructor(
        @InjectRepository(Order) private ordersRepo: Repository<Order>,
    ) {}

    async updateOrderStatus(
        orderId: string,
        status: PaymentStatus,
        paymentRef?: string,
    ): Promise<void> {
        try {
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
        } catch (error) {
            this.logger.error(`Error updating order ${orderId}:`, error);
            throw error;
        }
    }

    private isValidUUID(uuid: string): boolean {
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}

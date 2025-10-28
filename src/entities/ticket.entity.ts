import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Event } from './event.entity';

@Entity('tickets')
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'order_id' })
    orderId: string;

    @Column({ name: 'event_id' })
    eventId: string;

    @Column({ name: 'ticket_code', unique: true })
    ticketCode: string;

    @Column({ name: 'qr_code_url', nullable: true })
    qrCodeUrl: string;

    @Column({ name: 'pdf_url', nullable: true })
    pdfUrl: string;

    @Column({ name: 'issued_at', type: 'timestamp' })
    issuedAt: Date;

    @Column({ name: 'is_used', default: false })
    isUsed: boolean;

    @Column({ name: 'used_at', type: 'timestamp', nullable: true })
    usedAt: Date;

    @ManyToOne(() => Order, (order) => order.tickets)
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @ManyToOne(() => Event, (event) => event.tickets)
    @JoinColumn({ name: 'event_id' })
    event: Event;
    user: any;
}

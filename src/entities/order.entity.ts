import {
    Entity,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';
import { Ticket } from './ticket.entity';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';

@Entity('orders')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({ type: 'int' })
    quantity: number;

    @Column({
        name: 'original_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
    })
    originalPrice: number;

    @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
    totalAmount: number;

    @Column({
        name: 'payment_status',
        type: 'varchar',
        length: 10,
        default: PaymentStatus.PENDING,
    })
    paymentStatus: PaymentStatus;

    @Column({ name: 'payment_ref', length: 100, nullable: true })
    paymentRef?: string;

    @OneToMany(() => Ticket, (ticket) => ticket.order)
    tickets: Ticket[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

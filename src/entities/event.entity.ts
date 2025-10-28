import {
    Entity,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    PrimaryColumn,
} from 'typeorm';
import { EventCategory } from './event-category.entity';
import { User } from './user.entity';
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';

@Entity('events')
export class Event {
    @PrimaryColumn('uuid')
    id: string;

    @ManyToOne(() => EventCategory, (category) => category.events, {
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'category_id' })
    category: EventCategory;

    @Column({ length: 150 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ length: 255, nullable: true })
    location?: string;

    @Column({ name: 'start_date', type: 'timestamp' })
    startDate: Date;

    @Column({ name: 'end_date', type: 'timestamp' })
    endDate: Date;

    @Column({ type: 'numeric', precision: 12, scale: 2 })
    price: number;

    @Column({ name: 'is_published', type: 'boolean', default: false })
    isPublished: boolean;

    @ManyToOne(() => User, (user) => user.events, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by' })
    createdBy: User;

    @OneToMany(() => Order, (order) => order.event)
    orders: Order[];

    @OneToMany(() => Ticket, (ticket) => ticket.event)
    tickets: Ticket[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
function IsEndDateAfterStartDate(
    arg0: string,
): (target: Event, propertyKey: 'endDate') => void {
    throw new Error('Function not implemented.');
}

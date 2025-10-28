import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
    EMAIL = 'EMAIL',
    REMINDER = 'REMINDER',
    PAYMENT = 'PAYMENT',
    EXPIRY = 'EXPIRY',
}

export enum NotificationStatus {
    QUEUED = 'QUEUED',
    SENT = 'SENT',
    FAILED = 'FAILED',
}

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ type: 'varchar', length: 20 })
    type: NotificationType;

    @Column({ type: 'varchar', length: 150 })
    subject: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'varchar', length: 10, default: NotificationStatus.QUEUED })
    status: NotificationStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => User, (user) => user.notifications)
    @JoinColumn({ name: 'user_id' })
    user: User;
}

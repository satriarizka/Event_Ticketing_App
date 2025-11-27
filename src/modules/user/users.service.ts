import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UpdateUserDto } from './dto/update-user.dto';

// Type for sanitized user (without sensitive fields)
type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    /**
     * Sanitize user data by removing sensitive fields
     */
    private sanitizeUser(user: User): SanitizedUser {
        // Destructure to remove passwordHash
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    /**
     * Find all users without pagination (legacy method)
     */
    async findAll(): Promise<SanitizedUser[]> {
        const users = await this.userRepo.find({
            order: { createdAt: 'DESC' },
        });
        return users.map((user) => this.sanitizeUser(user));
    }

    /**
     * Find all users with pagination
     */
    async findAllWithPagination(
        page: number,
        limit: number,
    ): Promise<{
        data: SanitizedUser[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        const skip = (page - 1) * limit;

        const [users, total] = await this.userRepo.findAndCount({
            order: {
                createdAt: 'DESC',
            },
            skip,
            take: limit,
        });

        // Remove sensitive data (passwordHash)
        const sanitizedUsers = users.map((user) => this.sanitizeUser(user));

        const totalPages = Math.ceil(total / limit);

        return {
            data: sanitizedUsers,
            meta: {
                total,
                page,
                limit,
                totalPages,
            },
        };
    }

    /**
     * Find user by ID (for public use - returns sanitized)
     */
    async findOne(id: string): Promise<SanitizedUser | null> {
        const user = await this.userRepo.findOne({ where: { id } });
        return user ? this.sanitizeUser(user) : null;
    }

    /**
     * Find user by ID (internal use - returns full user with passwordHash)
     */
    async findOneInternal(id: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { id } });
    }

    /**
     * Find user by email (used for authentication - returns full user)
     */
    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { email } });
    }

    /**
     * Find users by role (returns sanitized)
     */
    async findByRole(role: UserRole): Promise<SanitizedUser[]> {
        const users = await this.userRepo.find({
            where: { role },
            order: { createdAt: 'DESC' },
        });
        return users.map((user) => this.sanitizeUser(user));
    }

    /**
     * Update user
     */
    async update(
        id: string,
        dto: UpdateUserDto,
    ): Promise<SanitizedUser | null> {
        const user = await this.userRepo.findOne({ where: { id } });

        if (!user) {
            return null;
        }

        // Merge update data
        Object.assign(user, dto);

        const updatedUser = await this.userRepo.save(user);
        return this.sanitizeUser(updatedUser);
    }

    /**
     * Create user (used by auth service - returns full user)
     */
    async create(userData: Partial<User>): Promise<User> {
        const user = this.userRepo.create(userData);
        return this.userRepo.save(user);
    }

    /**
     * Save user (for auth purposes - returns full user with passwordHash)
     */
    async save(user: User): Promise<User> {
        return this.userRepo.save(user);
    }
}

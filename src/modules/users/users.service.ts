import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { UpdateUserDto } from 'src/modules/users/dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    findAll() {
        return this.userRepo.find();
    }

    findOne(id: string) {
        return this.userRepo.findOne({ where: { id } });
    }

    findByEmail(email: string) {
        return this.userRepo.findOne({ where: { email } });
    }

    findByRole(role: UserRole) {
        return this.userRepo.find({ where: { role }})
    }

    create(userData: Partial<User>) {
        const user = this.userRepo.create(userData);
        return this.userRepo.save(user);
    }

    async update(id: string, updateUserDto: UpdateUserDto) {
        const user = await this.findOne(id);
        if (!user) return null;

        Object.assign(user, updateUserDto);
        return this.userRepo.save(user);
    }
}

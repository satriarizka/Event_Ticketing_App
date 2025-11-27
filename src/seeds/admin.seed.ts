import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/user/users.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/common/enums/user-role.enum';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    const adminEmail = 'admin@example.com';
    const existing = await usersService.findByEmail(adminEmail);

    if (!existing) {
        const hash = await bcrypt.hash('adminsedangngantuk', 10);
        await usersService.create({
            name: 'Super Admin',
            email: adminEmail,
            passwordHash: hash,
            role: UserRole.ADMIN,
        });
        console.log('=> Admin user created <=');
    } else {
        console.log('=> Admin already exists <=');
    }

    await app.close();
}
bootstrap();

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { XenditService } from './xendit.service';

@Module({
    imports: [ConfigModule],
    providers: [XenditService],
    exports: [XenditService],
})
export class XenditModule {}

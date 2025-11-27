import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Logger,
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
import { XenditService } from '../xendit/xendit.service';
import { NotificationsService } from '../notification/notifications.service';

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
}

import { IsUUID, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateOrderDto {
    @IsUUID()
    @IsNotEmpty()
    eventId: string;

    @IsInt()
    @Min(1)
    quantity: number;
}

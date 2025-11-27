import {
    IsUUID,
    IsNotEmpty,
    IsString,
    IsOptional,
    IsDateString,
    IsNumber,
    Min,
    IsBoolean,
} from 'class-validator';
import { IsEndDateAfterStartDate } from 'src/common/decorators/end-date.decorator';

export class CreateEventDto {
    @IsUUID()
    @IsOptional()
    categoryId?: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    @IsNotEmpty()
    description?: string;

    @IsString()
    @IsOptional()
    @IsNotEmpty()
    location?: string;

    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @IsDateString()
    @IsNotEmpty()
    @IsEndDateAfterStartDate('startDate')
    endDate: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsBoolean()
    @IsOptional()
    isPublished?: boolean;
}

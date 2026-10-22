import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class DailyMetricInput {
  @IsIn(['CURRENT', 'PREVIOUS'])
  period!: 'CURRENT' | 'PREVIOUS';

  @IsDateString()
  businessDate!: string;

  @IsOptional()
  @IsNumber()
  posRevenue?: number;

  @IsOptional()
  @IsNumber()
  eatclubRevenue?: number;

  @IsOptional()
  @IsNumber()
  directRevenue?: number;

  @IsOptional()
  @IsNumber()
  totalRevenue?: number;

  @IsOptional()
  @IsNumber()
  labourCosts?: number;

  @IsOptional()
  @IsInt()
  covers?: number;
}

class DashboardEventInput {
  @IsDateString()
  eventDate!: string;

  @IsString()
  label!: string;

  @IsIn(['POSITIVE', 'NEGATIVE'])
  direction!: 'POSITIVE' | 'NEGATIVE';
}

export class CreateDashboardDto {
  @IsDateString()
  weekStart!: string;

  @IsDateString()
  previousWeekStart!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyMetricInput)
  metrics!: DailyMetricInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardEventInput)
  events?: DashboardEventInput[];
}
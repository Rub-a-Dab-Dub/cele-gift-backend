import { IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class TimeRangeDto {
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;
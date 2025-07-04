import { IsOptional, IsString, IsDateString, IsArray, IsEnum, IsNumber, Min, Max } from "class-validator"
import { Transform, Type } from "class-transformer"
import { ApiProperty } from "@nestjs/swagger"

export enum TimeRange {
  HOUR = "1h",
  DAY = "1d",
  WEEK = "1w",
  MONTH = "1m",
  QUARTER = "3m",
  YEAR = "1y",
}

export enum MetricType {
  FOLLOWERS = "followers",
  ENGAGEMENT = "engagement",
  MENTIONS = "mentions",
  SENTIMENT = "sentiment",
  REACH = "reach",
  IMPRESSIONS = "impressions",
}

export class DashboardQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  celebrityId?: string

  @ApiProperty({ enum: TimeRange, required: false })
  @IsOptional()
  @IsEnum(TimeRange)
  timeRange?: TimeRange = TimeRange.DAY

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiProperty({ enum: MetricType, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(MetricType, { each: true })
  metrics?: MetricType[]

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[]

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === "true")
  includeComparisons?: boolean = false
}

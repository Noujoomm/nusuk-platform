import { IsString, IsOptional, IsEnum, IsNumber, IsObject, IsDateString, Min, Max, MinLength } from 'class-validator';

export class CreateRecordDto {
  @IsString()
  trackId: string;

  @IsString()
  @MinLength(2, { message: 'العنوان يجب أن يكون حرفين على الأقل' })
  title: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsEnum(['draft', 'active', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  extraFields?: any;
}

export class UpdateRecordDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsEnum(['draft', 'active', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  extraFields?: any;

  @IsNumber()
  version: number; // Required for optimistic concurrency
}

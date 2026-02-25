import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsInt, MinLength } from 'class-validator';

export class CreateSubtaskDto {
  @IsString()
  recordId: string;

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
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateSubtaskDto {
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
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateChecklistItemDto {
  @IsString()
  recordId: string;

  @IsString()
  @MinLength(1, { message: 'النص مطلوب' })
  text: string;

  @IsOptional()
  @IsString()
  textAr?: string;
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  textAr?: string;

  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;
}

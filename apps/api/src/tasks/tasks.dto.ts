import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsDateString, Min, Max, MinLength, ValidateIf } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(2, { message: 'العنوان يجب أن يكون حرفين على الأقل' })
  title: string;

  @IsString()
  @MinLength(2, { message: 'العنوان بالعربية مطلوب' })
  titleAr: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Polymorphic assignment
  @IsEnum(['TRACK', 'USER', 'HR', 'GLOBAL'], { message: 'نوع التعيين غير صالح' })
  assigneeType: string;

  @ValidateIf((o) => o.assigneeType === 'TRACK')
  @IsString({ message: 'معرف المسار مطلوب عند التعيين لمسار' })
  assigneeTrackId?: string;

  @ValidateIf((o) => o.assigneeType === 'USER')
  @IsString({ message: 'معرف المستخدم مطلوب عند التعيين لموظف' })
  assigneeUserId?: string;

  // Legacy: keep for backward compat but optional
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  // Polymorphic assignment (optional on update)
  @IsOptional()
  @IsEnum(['TRACK', 'USER', 'HR', 'GLOBAL'], { message: 'نوع التعيين غير صالح' })
  assigneeType?: string;

  @IsOptional()
  @IsString()
  assigneeTrackId?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}

export class UpdateTaskStatusDto {
  @IsEnum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled'])
  status: string;
}

export class AssignTaskDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

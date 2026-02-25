import { IsString, IsOptional, IsBoolean, IsEnum, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsEnum([
    'assignment',
    'mention',
    'comment',
    'status_change',
    'deadline_approaching',
    'deadline_overdue',
    'record_created',
    'record_updated',
    'system',
  ])
  type: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  titleAr: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  bodyAr?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  senderId?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  assignmentAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  commentAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  mentionAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  deadlineAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  statusChangeAlert?: boolean;
}

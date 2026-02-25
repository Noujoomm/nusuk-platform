import { IsString, IsOptional, IsBoolean, MinLength, IsIn } from 'class-validator';

export class CreateDailyUpdateDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(2)
  titleAr: string;

  @IsString()
  @MinLength(2)
  content: string;

  @IsOptional()
  @IsString()
  contentAr?: string;

  @IsOptional()
  @IsString()
  @IsIn(['global', 'track', 'department'])
  type?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['normal', 'important', 'urgent'])
  priority?: string;
}

export class UpdateDailyUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  titleAr?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  contentAr?: string;

  @IsOptional()
  @IsString()
  @IsIn(['global', 'track', 'department'])
  type?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['normal', 'important', 'urgent'])
  priority?: string;
}

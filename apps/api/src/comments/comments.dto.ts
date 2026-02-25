import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  @MinLength(1, { message: 'نص التعليق مطلوب' })
  body: string;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: 'نص التعليق مطلوب' })
  body: string;
}

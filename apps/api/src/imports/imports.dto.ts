import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class ImportDataDto {
  @IsString()
  entityType: string; // employee, deliverable, penalty, scope, track_kpi

  @IsArray()
  mapping: Array<{ excelColumn: string; dbField: string }>;

  @IsArray()
  rows: any[];

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

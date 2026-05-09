import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EnhanceTextDto {
  @IsString({ message: 'النص مطلوب.' })
  @MinLength(1, { message: 'النص فارغ.' })
  @MaxLength(10_000, { message: 'النص يتجاوز الحد المسموح (10,000 حرف).' })
  text!: string;

  @IsString({ message: 'معرّف المسار مطلوب.' })
  trackId!: string;

  /** Optional label for the originating field (e.g. "الإنجازات") — only
   *  used for the audit log, never injected into the prompt. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fieldContext?: string;
}

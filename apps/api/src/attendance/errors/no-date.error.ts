import { BadRequestException } from '@nestjs/common';

/**
 * يُرمى عند تعذّر استخراج تاريخ التقرير من الـ PDF وعدم توفّر تاريخ يدوي.
 *
 * يرث BadRequestException بدلاً من Error العادي حتى يُعيد NestJS تلقائياً
 * استجابة 400 بهيكل `{ message, errorCode: 'no_date' }` فتعرف الواجهة
 * بدقّة أن الملف يحتاج تاريخاً يدوياً (status 'needs_date') لا "فشل عام".
 */
export class NoDateError extends BadRequestException {
  constructor(message = 'تعذّر استخراج تاريخ التقرير من الملف، يرجى تحديده يدوياً') {
    super({ message, errorCode: 'no_date' });
  }
}

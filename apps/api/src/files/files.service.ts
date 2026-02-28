import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { readFileSync } from 'fs';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private prisma: PrismaService,
    private openai: OpenAIService,
  ) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    trackId?: string;
    category?: string;
    status?: string;
  }) {
    const { page = 1, pageSize = 25, trackId, category, status } = params;
    const where: any = {};
    if (trackId) where.trackId = trackId;
    if (category) where.category = category;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.uploadedFile.findMany({
        where,
        include: {
          uploadedBy: { select: { id: true, name: true, nameAr: true } },
          track: { select: { id: true, nameAr: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.uploadedFile.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findById(id: string) {
    return this.prisma.uploadedFile.findUnique({ where: { id } });
  }

  async create(data: {
    trackId?: string;
    uploadedById: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    filePath: string;
    category?: string;
    notes?: string;
  }) {
    return this.prisma.uploadedFile.create({
      data,
      include: {
        uploadedBy: { select: { id: true, name: true, nameAr: true } },
        track: { select: { id: true, nameAr: true } },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('الملف غير موجود');
    return this.prisma.uploadedFile.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async delete(id: string) {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('الملف غير موجود');
    await this.prisma.uploadedFile.delete({ where: { id } });
    return { message: 'تم حذف الملف' };
  }

  async getStats() {
    const [total, byCategory, byStatus] = await Promise.all([
      this.prisma.uploadedFile.count(),
      this.prisma.uploadedFile.groupBy({ by: ['category'], _count: true }),
      this.prisma.uploadedFile.groupBy({ by: ['status'], _count: true }),
    ]);

    return {
      total,
      byCategory: byCategory.reduce((acc, r) => ({ ...acc, [r.category]: r._count }), {}),
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {}),
    };
  }

  // ─── AI File Analysis ───────────────────────────────
  async analyzeFile(filePath: string, fileName: string, mimeType: string, analysisType: string) {
    let fileContent = '';

    try {
      // Read text-based files
      if (
        mimeType.includes('text') ||
        mimeType.includes('csv') ||
        mimeType.includes('json') ||
        fileName.endsWith('.txt') ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.json')
      ) {
        fileContent = readFileSync(filePath, 'utf-8');
      } else if (
        mimeType.includes('spreadsheet') ||
        mimeType.includes('excel') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls')
      ) {
        // Parse Excel
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const rows: string[] = [];
        workbook.eachSheet((sheet) => {
          rows.push(`--- ورقة: ${sheet.name} ---`);
          sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber <= 100) { // Limit rows sent to AI
              const values = row.values as any[];
              rows.push(values.slice(1).map((v) => (v?.result ?? v ?? '')).join(' | '));
            }
          });
        });
        fileContent = rows.join('\n');
      } else {
        // For binary files, just note the file type
        fileContent = `[ملف بصيغة ${mimeType} - اسم الملف: ${fileName}]`;
      }
    } catch (error) {
      this.logger.error(`Error reading file ${filePath}`, error);
      fileContent = `[خطأ في قراءة الملف: ${fileName}]`;
    }

    // Truncate to avoid token limits
    if (fileContent.length > 15000) {
      fileContent = fileContent.substring(0, 15000) + '\n... [تم اقتطاع المحتوى]';
    }

    const prompts: Record<string, string> = {
      extract: `أنت محلل بيانات متخصص. قم بتحليل المحتوى التالي واستخرج جميع البيانات المهيكلة منه.

أعد النتيجة كـ JSON بالشكل التالي:
{
  "summary": "ملخص المحتوى بالعربية",
  "entityType": "نوع الكيان المكتشف (مثل: employees, deliverables, penalties, contracts, scopes, kpis, أو other)",
  "columns": ["اسم العمود 1", "اسم العمود 2", ...],
  "rows": [{"العمود1": "القيمة1", "العمود2": "القيمة2"}, ...],
  "insights": ["ملاحظة 1", "ملاحظة 2", ...]
}

المحتوى:
${fileContent}`,

      summarize: `أنت محلل تقارير محترف. قم بتحليل المحتوى التالي وتقديم ملخص شامل بالعربية.

أعد النتيجة كـ JSON بالشكل التالي:
{
  "title": "عنوان الملخص",
  "summary": "ملخص تفصيلي بالعربية",
  "keyPoints": ["نقطة رئيسية 1", "نقطة رئيسية 2", ...],
  "statistics": {"إحصائية1": "قيمة1", "إحصائية2": "قيمة2"},
  "recommendations": ["توصية 1", "توصية 2", ...]
}

المحتوى:
${fileContent}`,

      classify: `أنت متخصص في تصنيف الملفات والمستندات. قم بتحليل المحتوى التالي وتصنيفه.

أعد النتيجة كـ JSON بالشكل التالي:
{
  "category": "التصنيف الرئيسي",
  "subcategory": "التصنيف الفرعي",
  "language": "لغة المحتوى",
  "topics": ["موضوع 1", "موضوع 2"],
  "relevantTrackType": "نوع المسار المناسب (مثل: بنية تحتية، تقنية، تعليم...)",
  "suggestedTags": ["وسم 1", "وسم 2"],
  "confidence": 0.95
}

المحتوى:
${fileContent}`,
    };

    const prompt = prompts[analysisType] || prompts.extract;

    const response = await this.openai.chat([
      { role: 'system', content: 'أنت مساعد ذكي متخصص في تحليل واستخراج البيانات. أجب دائماً بصيغة JSON صالحة فقط.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2, maxTokens: 4096 });

    // Try to parse JSON from response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse AI response as JSON');
    }

    return { summary: response, raw: true };
  }
}

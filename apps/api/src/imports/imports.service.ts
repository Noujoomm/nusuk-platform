import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as ExcelJS from 'exceljs';
import { ImportDataDto } from './imports.dto';

// Field definitions for each entity type
const ENTITY_FIELDS: Record<string, Array<{ field: string; label: string; labelAr: string; required?: boolean }>> = {
  employee: [
    { field: 'fullNameAr', label: 'Full Name (Arabic)', labelAr: 'الاسم بالعربي', required: true },
    { field: 'fullName', label: 'Full Name (English)', labelAr: 'الاسم بالإنجليزي', required: true },
    { field: 'positionAr', label: 'Position (Arabic)', labelAr: 'المنصب بالعربي' },
    { field: 'position', label: 'Position (English)', labelAr: 'المنصب بالإنجليزي' },
    { field: 'contractType', label: 'Contract Type', labelAr: 'نوع العقد' },
    { field: 'email', label: 'Email', labelAr: 'البريد الإلكتروني' },
    { field: 'phone', label: 'Phone', labelAr: 'رقم الجوال' },
    { field: 'department', label: 'Department', labelAr: 'القسم' },
    { field: 'status', label: 'Status', labelAr: 'الحالة' },
    { field: 'nationalId', label: 'National ID', labelAr: 'رقم الهوية' },
    { field: 'notes', label: 'Notes', labelAr: 'ملاحظات' },
  ],
  deliverable: [
    { field: 'nameAr', label: 'Name (Arabic)', labelAr: 'الاسم بالعربي', required: true },
    { field: 'name', label: 'Name (English)', labelAr: 'الاسم بالإنجليزي', required: true },
    { field: 'outputs', label: 'Outputs', labelAr: 'المخرجات' },
    { field: 'deliveryIndicators', label: 'Delivery Indicators', labelAr: 'مؤشرات التسليم' },
  ],
  penalty: [
    { field: 'violationAr', label: 'Violation (Arabic)', labelAr: 'المخالفة بالعربي', required: true },
    { field: 'violation', label: 'Violation (English)', labelAr: 'المخالفة بالإنجليزي', required: true },
    { field: 'severity', label: 'Severity', labelAr: 'الخطورة' },
    { field: 'impactScore', label: 'Impact Score', labelAr: 'درجة التأثير' },
  ],
  scope: [
    { field: 'titleAr', label: 'Title (Arabic)', labelAr: 'العنوان بالعربي', required: true },
    { field: 'title', label: 'Title (English)', labelAr: 'العنوان بالإنجليزي', required: true },
    { field: 'description', label: 'Description', labelAr: 'الوصف' },
  ],
  track_kpi: [
    { field: 'nameAr', label: 'Name (Arabic)', labelAr: 'الاسم بالعربي', required: true },
    { field: 'name', label: 'Name (English)', labelAr: 'الاسم بالإنجليزي', required: true },
  ],
};

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  getEntityFields(entityType: string) {
    const fields = ENTITY_FIELDS[entityType];
    if (!fields) throw new BadRequestException('نوع البيانات غير مدعوم');
    return fields;
  }

  async parseExcel(filePath: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = workbook.worksheets.map((ws) => {
      const headers: string[] = [];
      const firstRow = ws.getRow(1);
      firstRow.eachCell((cell, colNumber) => {
        headers.push(String(cell.value || `Column ${colNumber}`));
      });

      const previewRows: any[] = [];
      for (let i = 2; i <= Math.min(ws.rowCount, 6); i++) {
        const row = ws.getRow(i);
        const rowData: Record<string, any> = {};
        headers.forEach((header, idx) => {
          const cell = row.getCell(idx + 1);
          rowData[header] = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
        });
        previewRows.push(rowData);
      }

      return {
        name: ws.name,
        rowCount: ws.rowCount - 1, // exclude header
        headers,
        preview: previewRows,
      };
    });

    return { sheets };
  }

  async parseSheet(filePath: string, sheetName: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) throw new BadRequestException('الورقة غير موجودة');

    const headers: string[] = [];
    const firstRow = ws.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      headers.push(String(cell.value || `Column ${colNumber}`));
    });

    const rows: Record<string, any>[] = [];
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const rowData: Record<string, any> = {};
      let hasData = false;
      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        const val = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
        rowData[header] = val;
        if (val) hasData = true;
      });
      if (hasData) rows.push(rowData);
    }

    return { headers, rows, totalRows: rows.length };
  }

  async importData(dto: ImportDataDto, userId: string) {
    const { entityType, mapping, rows, trackId, fileName } = dto;

    if (!ENTITY_FIELDS[entityType]) {
      throw new BadRequestException('نوع البيانات غير مدعوم');
    }

    let inserted = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const record: Record<string, any> = {};
        for (const map of mapping) {
          if (map.dbField && map.excelColumn && rows[i][map.excelColumn] !== undefined) {
            let value: any = rows[i][map.excelColumn];
            // Type conversions
            if (map.dbField === 'impactScore') {
              value = parseFloat(value) || 0;
            }
            record[map.dbField] = value;
          }
        }

        if (Object.keys(record).length === 0) {
          skipped++;
          continue;
        }

        // Add trackId if provided
        if (trackId) record.trackId = trackId;

        switch (entityType) {
          case 'employee':
            if (!record.fullNameAr || !record.fullName) { skipped++; continue; }
            await this.prisma.employee.create({ data: record as any });
            break;
          case 'deliverable':
            if (!record.nameAr || !record.name || !record.trackId) { skipped++; continue; }
            await this.prisma.deliverable.create({ data: record as any });
            break;
          case 'penalty':
            if (!record.violationAr || !record.violation || !record.trackId) { skipped++; continue; }
            await this.prisma.penalty.create({ data: record as any });
            break;
          case 'scope':
            if (!record.titleAr || !record.title || !record.trackId) { skipped++; continue; }
            await this.prisma.scope.create({ data: record as any });
            break;
          case 'track_kpi':
            if (!record.nameAr || !record.name || !record.trackId) { skipped++; continue; }
            await this.prisma.trackKPI.create({ data: record as any });
            break;
        }
        inserted++;
      } catch (err: any) {
        errors.push({ row: i + 2, error: err.message });
        skipped++;
      }
    }

    // Log import history
    await this.prisma.importHistory.create({
      data: {
        fileName: fileName || 'import.xlsx',
        fileSize: 0,
        importedBy: userId,
        status: errors.length > 0 ? (inserted > 0 ? 'completed' : 'failed') : 'completed',
        summary: { inserted, skipped, errors: errors.length, total: rows.length },
        errorLog: errors,
      },
    });

    return { inserted, skipped, errors: errors.length, total: rows.length, errorDetails: errors.slice(0, 10) };
  }

  async getHistory(params?: { page?: number; pageSize?: number }) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;

    const [data, total] = await Promise.all([
      this.prisma.importHistory.findMany({
        include: {
          author: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.importHistory.count(),
    ]);

    return { data, total, page, pageSize };
  }
}

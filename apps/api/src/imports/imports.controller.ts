import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile as UpFile } from '@nestjs/common';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { Request } from 'express';
import { ImportsService } from './imports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ImportDataDto } from './imports.dto';

@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(
    private service: ImportsService,
    private audit: AuditService,
  ) {}

  @Get('fields')
  getFields(@Query('entityType') entityType: string) {
    return this.service.getEntityFields(entityType);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'hr')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'imports'),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'import-' + uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  async upload(@UpFile() file: Express.Multer.File) {
    if (!file) return { error: 'الملف غير مدعوم. يرجى رفع ملف Excel (.xlsx)' };
    const result = await this.service.parseExcel(file.path);
    return { ...result, filePath: file.path, fileName: file.originalname };
  }

  @Post('parse-sheet')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'hr')
  async parseSheet(@Body() body: { filePath: string; sheetName: string }) {
    return this.service.parseSheet(body.filePath, body.sheetName);
  }

  @Post('execute')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'hr')
  async executeImport(@Body() dto: ImportDataDto, @CurrentUser() user: any, @Req() req: Request) {
    const result = await this.service.importData(dto, user.id);
    await this.audit.log({
      actorId: user.id,
      actionType: 'import',
      entityType: dto.entityType,
      afterData: { ...result, fileName: dto.fileName } as any,
      ip: req.ip,
    });
    return result;
  }

  @Get('history')
  getHistory(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.service.getHistory({ page, pageSize });
  }
}

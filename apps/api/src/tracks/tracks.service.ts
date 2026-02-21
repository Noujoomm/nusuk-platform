import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTrackDto, UpdateTrackDto } from './tracks.dto';

@Injectable()
export class TracksService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, role: string) {
    // Admin and PM can see all tracks
    if (role === 'admin' || role === 'pm') {
      return this.prisma.track.findMany({
        where: { isActive: true },
        include: { _count: { select: { records: true } } },
        orderBy: { sortOrder: 'asc' },
      });
    }

    // Others see only tracks they have permission for
    const permissions = await this.prisma.trackPermission.findMany({
      where: { userId, permissions: { hasSome: ['view'] } },
      select: { trackId: true },
    });

    return this.prisma.track.findMany({
      where: { id: { in: permissions.map((p) => p.trackId) }, isActive: true },
      include: { _count: { select: { records: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    const track = await this.prisma.track.findUnique({
      where: { id },
      include: {
        _count: { select: { records: true } },
        permissions: {
          include: { user: { select: { id: true, name: true, nameAr: true, role: true } } },
        },
      },
    });
    if (!track) throw new NotFoundException('المسار غير موجود');
    return track;
  }

  async create(dto: CreateTrackDto) {
    return this.prisma.track.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateTrackDto) {
    await this.findById(id);
    return this.prisma.track.update({
      where: { id },
      data: dto as any,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.track.delete({ where: { id } });
    return { message: 'تم حذف المسار' };
  }

  async checkPermission(userId: string, trackId: string, permission: string, role: string) {
    if (role === 'admin') return true;

    const tp = await this.prisma.trackPermission.findUnique({
      where: { userId_trackId: { userId, trackId } },
    });

    if (!tp || !tp.permissions.includes(permission)) {
      throw new ForbiddenException('ليس لديك صلاحية لهذا الإجراء');
    }
    return true;
  }
}

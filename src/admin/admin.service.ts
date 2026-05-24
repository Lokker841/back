import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { Prisma, SportObjectStatus } from '@prisma/client';

const VALID_TRANSITIONS: Record<SportObjectStatus, SportObjectStatus[]> = {
  [SportObjectStatus.DRAFT]: [SportObjectStatus.PENDING_REVIEW],
  [SportObjectStatus.PENDING_REVIEW]: [
    SportObjectStatus.PUBLISHED,
    SportObjectStatus.DRAFT,
  ],
  [SportObjectStatus.PUBLISHED]: [SportObjectStatus.ARCHIVED],
  [SportObjectStatus.ARCHIVED]: [SportObjectStatus.DRAFT],
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
  ) {}

  // ─── Dashboard ───────────────────────────────────────────────

  async getStats() {
    const [totalObjects, totalAreas, byDistrict, byStatus, bySport, totalSports] =
      await Promise.all([
        this.prisma.sportObject.count(),
        this.prisma.sportArea.count(),
        this.prisma.sportObject.groupBy({
          by: ['district'],
          _count: { id: true },
        }),
        this.prisma.sportObject.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        this.prisma.sportArea.groupBy({
          by: ['sportType'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.sportArea
          .groupBy({
            by: ['sportType'],
          })
          .then((rows) => rows.length),
      ]);

    return {
      totalObjects,
      totalAreas,
      totalSports,
      byDistrict: byDistrict.map((d) => ({
        district: d.district,
        count: d._count.id,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      topSports: bySport.map((s) => ({
        sportType: s.sportType,
        count: s._count.id,
      })),
    };
  }

  // ─── SportObject CRUD ─────────────────────────────────────────

  async findAllObjects(params: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = params;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sportObject.findMany({
        include: { areas: true, images: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.sportObject.count(),
    ]);
    return { items, total, limit, offset };
  }

  async findOneObject(id: string) {
    const object = await this.prisma.sportObject.findUnique({
      where: { id },
      include: { areas: true, images: true },
    });
    if (!object) throw new NotFoundException(`Объект ${id} не найден`);
    return object;
  }

  async createObject(dto: CreateObjectDto) {
    const { imageUrls, ...objectData } = dto;
    const object = await this.prisma.sportObject.create({
      data: {
        ...objectData,
        images:
          imageUrls && imageUrls.length
            ? {
                create: imageUrls.map((url) => ({
                  url,
                  // key пока не используется в UI, поэтому дублируем url для совместимости схемы
                  key: url,
                })),
              }
            : undefined,
      },
    });

    if (!dto.latitude || !dto.longitude) {
      void this.geoService.geocodeObject(object.id);
    }

    return object;
  }

  async updateObject(id: string, dto: UpdateObjectDto) {
    const current = await this.findOneObject(id);

    if (dto.status) {
      if (!VALID_TRANSITIONS[current.status].includes(dto.status)) {
        throw new BadRequestException(
          `Переход из ${current.status} в ${dto.status} запрещён`,
        );
      }
    }

    const addressChanged =
      dto.address !== undefined && dto.address !== current.address;

    const { imageUrls, ...objectData } = dto;

    await this.prisma.$transaction(async (tx) => {
      if (imageUrls !== undefined) {
        await tx.media.deleteMany({ where: { objectId: id } });
        if (imageUrls.length) {
          await tx.media.createMany({
            data: imageUrls.map((url) => ({
              objectId: id,
              url,
              key: url,
            })),
          });
        }
      }

      await tx.sportObject.update({
        where: { id },
        data: {
          ...objectData,
          // При смене адреса сбрасываем старые координаты — они больше не актуальны
          ...(addressChanged && { latitude: null, longitude: null }),
        },
      });
    });

    const updated = await this.findOneObject(id);

    if (addressChanged) {
      void this.geoService.geocodeObject(id);
    }

    return updated;
  }

  async deleteObject(id: string) {
    await this.findOneObject(id);
    await this.prisma.sportObject.delete({ where: { id } });
    return { message: `Объект ${id} удалён` };
  }

  // ─── SportArea CRUD ───────────────────────────────────────────

  async findAllAreas(objectId?: string) {
    return this.prisma.sportArea.findMany({
      where: objectId ? { objectId } : undefined,
      include: { object: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneArea(id: string) {
    const area = await this.prisma.sportArea.findUnique({
      where: { id },
      include: { object: true },
    });
    if (!area) throw new NotFoundException(`Площадка ${id} не найдена`);
    return area;
  }

  async createArea(dto: CreateAreaDto) {
    await this.findOneObject(dto.objectId);
    return this.prisma.sportArea.create({
      data: {
        objectId: dto.objectId,
        name: dto.name,
        sportType: dto.sportType,
        pricePerHour: dto.pricePerHour,
        schedule: (dto.schedule ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateArea(id: string, dto: UpdateAreaDto) {
    await this.findOneArea(id);
    return this.prisma.sportArea.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sportType !== undefined && { sportType: dto.sportType }),
        ...(dto.pricePerHour !== undefined && {
          pricePerHour: dto.pricePerHour,
        }),
        ...(dto.schedule !== undefined && {
          schedule: dto.schedule as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async deleteArea(id: string) {
    await this.findOneArea(id);
    await this.prisma.sportArea.delete({ where: { id } });
    return { message: `Площадка ${id} удалена` };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { SportObjectStatus } from '@prisma/client';
import { sportObjectInclude } from '../common/prisma/includes';
import {
  normalizeSportObject,
  normalizeSportObjects,
} from '../common/serializers/sport-object.serializer';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CatalogQueryDto) {
    const { limit = 20, offset = 0 } = query;

    const where = {
      status: SportObjectStatus.PUBLISHED,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sportObject.findMany({
        where,
        include: sportObjectInclude,
        orderBy: { rating: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.sportObject.count({ where }),
    ]);

    return {
      items: normalizeSportObjects(items),
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string) {
    const object = await this.prisma.sportObject.findFirst({
      where: { id, status: SportObjectStatus.PUBLISHED },
      include: sportObjectInclude,
    });
    if (!object) {
      throw new NotFoundException(`Объект с id ${id} не найден`);
    }
    return normalizeSportObject(object);
  }

  async findSports() {
    const rows = await this.prisma.sportArea.findMany({
      where: {
        object: {
          status: SportObjectStatus.PUBLISHED,
        },
      },
      select: {
        sportType: true,
      },
      distinct: ['sportType'],
      orderBy: {
        sportType: 'asc',
      },
    });

    return rows.map((r) => r.sportType);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { SportObjectStatus } from '@prisma/client';

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
        include: {
          areas: true,
          images: true,
        },
        orderBy: { rating: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.sportObject.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: string) {
    return this.prisma.sportObject.findUnique({
      where: { id },
      include: { areas: true, images: true },
    });
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

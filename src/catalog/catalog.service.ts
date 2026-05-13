import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { District, SportObjectStatus } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CatalogQueryDto) {
    const { district, sport, limit = 20, offset = 0 } = query;

    const where: {
      status: SportObjectStatus;
      district?: District;
      areas?: { some: { sportType: { contains: string; mode: 'insensitive' } } };
    } = {
      status: SportObjectStatus.PUBLISHED,
    };

    if (district) {
      where.district = district;
    }

    if (sport) {
      where.areas = {
        some: { sportType: { contains: sport, mode: 'insensitive' } },
      };
    }

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
}
